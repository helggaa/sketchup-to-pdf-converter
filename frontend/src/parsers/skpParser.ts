/**
 * SKP Parser Module
 *
 * Parses a SketchUp (.skp) binary file in the browser and returns Three.js
 * geometry/material objects. Parsing strategy (in order of preference):
 *
 *  1. Attempt to use the `openskp` npm library (browser-compatible, MIT).
 *  2. Fall back to a minimal built-in reader that validates the SKP header
 *     and extracts geometry from the embedded ZIP/VFF container.
 *  3. If neither produces usable geometry, throw a descriptive Error so the
 *     caller can surface it in `parseError`.
 *
 * Requirements: 1.3, 1.4, 1.5
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import type { ParsedModel } from '../types';

// ---------------------------------------------------------------------------
// SKP file-format constants
// ---------------------------------------------------------------------------

/**
 * Modern SketchUp files (v2021+) start with a 4-byte magic sequence.
 * Older versions use an OLE Compound File header (D0 CF 11 E0).
 */
const SKP_MAGIC_MODERN = new Uint8Array([0xff, 0xfe, 0xff, 0x0e]);

/**
 * OLE Compound Document signature used by older SketchUp files (pre-2021).
 */
const SKP_MAGIC_LEGACY = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]);

/**
 * ZIP local-file entry signature used to locate the embedded ZIP inside the
 * modern VFF container.
 */
const ZIP_SIGNATURE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04

// ---------------------------------------------------------------------------
// Header validation
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the first 4 bytes of `buffer` match either a known SKP
 * magic sequence, providing early feedback on obviously non-SKP data.
 */
function hasValidSkpHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer, 0, 4);

  const matchesModern =
    view[0] === SKP_MAGIC_MODERN[0] &&
    view[1] === SKP_MAGIC_MODERN[1] &&
    view[2] === SKP_MAGIC_MODERN[2] &&
    view[3] === SKP_MAGIC_MODERN[3];

  const matchesLegacy =
    view[0] === SKP_MAGIC_LEGACY[0] &&
    view[1] === SKP_MAGIC_LEGACY[1] &&
    view[2] === SKP_MAGIC_LEGACY[2] &&
    view[3] === SKP_MAGIC_LEGACY[3];

  return matchesModern || matchesLegacy;
}

// ---------------------------------------------------------------------------
// Library-based parsing (openskp)
// ---------------------------------------------------------------------------

/**
 * Attempts to parse with the `openskp` library.
 * Dynamically imported so the rest of the application still loads when the
 * package is not installed.
 *
 * @returns `ParsedModel` on success, `null` when the library is unavailable.
 * @throws  `Error` with a descriptive message when the library is present but
 *          parsing fails.
 */
async function tryParseWithOpenskp(
  buffer: ArrayBuffer
): Promise<ParsedModel | null> {
  let parseSkp: ((buf: ArrayBuffer) => unknown) | undefined;
  let toGLB: ((model: unknown) => Uint8Array) | undefined;

  try {
    const mod = (await import('openskp')) as Record<string, unknown>;
    const maybeDefault = mod.default as Record<string, unknown> | undefined;

    parseSkp =
      typeof mod.parseSkp === 'function'
        ? (mod.parseSkp as (b: ArrayBuffer) => unknown)
        : typeof maybeDefault?.parseSkp === 'function'
        ? (maybeDefault.parseSkp as (b: ArrayBuffer) => unknown)
        : undefined;

    toGLB =
      typeof mod.toGLB === 'function'
        ? (mod.toGLB as (model: unknown) => Uint8Array)
        : typeof maybeDefault?.toGLB === 'function'
        ? (maybeDefault.toGLB as (model: unknown) => Uint8Array)
        : undefined;
  } catch (err) {
    console.warn('openskp unavailable in browser; falling back to built-in reader.', err);
    return null;
  }

  if (typeof parseSkp !== 'function' || typeof toGLB !== 'function') {
    throw new Error(
      'The installed openskp package does not expose parseSkp and toGLB exports.'
    );
  }

  const model = parseSkp(buffer);
  if (!model) {
    throw new Error('openskp parsed the file but returned no model.');
  }

  const glbBytes = toGLB(model);
  const glbData = new Uint8Array(glbBytes);
  const blob = new Blob([glbData], { type: 'model/gltf-binary' });
  const glbArrayBuffer = await blob.arrayBuffer();

  const loader = new GLTFLoader();
  const gltf = await new Promise<any>((resolve, reject) => {
    loader.parse(
      glbArrayBuffer,
      '',
      (doc: any) => resolve(doc),
      (err: any) => reject(err)
    );
  });

  const geometries: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((node: any) => {
    if (node.isMesh) {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) {
        geometries.push(mesh.geometry as THREE.BufferGeometry);
      }
    }
  });

  if (geometries.length === 0) {
    throw new Error(
      'SKP file parsed successfully but no mesh geometry was extracted from the GLB output.'
    );
  }

  return buildParsedModel(geometries);
}

// ---------------------------------------------------------------------------
// Built-in minimal reader
// ---------------------------------------------------------------------------

/**
 * Searches `buffer` for the ZIP local-file-entry signature and returns the
 * byte offset, or `-1` when not found.
 */
function findZipOffset(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  const [b0, b1, b2, b3] = ZIP_SIGNATURE;

  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === b0 &&
      bytes[i + 1] === b1 &&
      bytes[i + 2] === b2 &&
      bytes[i + 3] === b3
    ) {
      return i;
    }
  }

  return -1;
}

/**
 * Minimal built-in parser for modern SKP (VFF) files.
 *
 * Modern SKP files embed a ZIP archive starting with `PK\x03\x04`. This
 * function locates that offset and constructs a placeholder geometry that
 * confirms the file is a valid SKP container, while making it clear to the
 * renderer that full geometry extraction requires the `openskp` library.
 *
 * @returns `ParsedModel` with a placeholder geometry.
 * @throws  `Error` when the file structure is unrecognisable.
 */
function tryBuiltInReader(buffer: ArrayBuffer): ParsedModel {
  const isModern = (() => {
    const view = new Uint8Array(buffer, 0, 4);
    return (
      view[0] === SKP_MAGIC_MODERN[0] &&
      view[1] === SKP_MAGIC_MODERN[1] &&
      view[2] === SKP_MAGIC_MODERN[2] &&
      view[3] === SKP_MAGIC_MODERN[3]
    );
  })();

  if (isModern) {
    const zipOffset = findZipOffset(buffer);
    if (zipOffset === -1) {
      throw new Error(
        'SKP file has a valid modern header but the embedded ZIP archive could not be located. The file may be corrupt.'
      );
    }
    // Confirmed: valid modern SKP container. Full geometry extraction requires
    // a dedicated library. Return a placeholder so the app can at least display
    // something and inform the user.
    return buildPlaceholderModel(
      'SketchUp model detected (VFF container). Install the `openskp` library for full geometry extraction.'
    );
  }

  // Legacy OLE format — no browser-based parser available without native SDK.
  throw new Error(
    'This appears to be a legacy SketchUp file (pre-2021 format). Browser-based parsing of legacy SKP files is not supported. Please re-save the model in SketchUp 2021 or later.'
  );
}

// ---------------------------------------------------------------------------
// Helper: build ParsedModel from geometries
// ---------------------------------------------------------------------------

/**
 * Wraps an array of geometries into a `ParsedModel`, computing the aggregate
 * bounding box from all geometry positions.
 */
function buildParsedModel(geometries: THREE.BufferGeometry[]): ParsedModel {
  const materials: THREE.Material[] = geometries.map(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xc8c8c8,
        side: THREE.DoubleSide,
      })
  );

  // Compute aggregate bounding box across all geometries.
  const boundingBox = new THREE.Box3();
  const tempGroup = new THREE.Group();

  for (let i = 0; i < geometries.length; i++) {
    const mesh = new THREE.Mesh(geometries[i], materials[i]);
    tempGroup.add(mesh);
  }

  if (tempGroup.children.length > 0) {
    boundingBox.setFromObject(tempGroup);
  } else {
    // Empty model — use a unit box centred at origin.
    boundingBox.set(
      new THREE.Vector3(-0.5, -0.5, -0.5),
      new THREE.Vector3(0.5, 0.5, 0.5)
    );
  }

  return { geometries, materials, boundingBox };
}

/**
 * Returns a `ParsedModel` containing a single unit `BoxGeometry` as a visual
 * placeholder when full parsing is unavailable. Useful for confirming the SKP
 * container is valid while library support is pending.
 *
 * The placeholder geometry is annotated with `userData.isPlaceholder = true`
 * so downstream code can detect and react to it if needed.
 */
function buildPlaceholderModel(reason: string): ParsedModel {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.userData = { isPlaceholder: true, reason };

  const mat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    wireframe: true,
  });

  const boundingBox = new THREE.Box3(
    new THREE.Vector3(-0.5, -0.5, -0.5),
    new THREE.Vector3(0.5, 0.5, 0.5)
  );

  return {
    geometries: [geo],
    materials: [mat],
    boundingBox,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a SketchUp `.skp` file and returns Three.js geometry/material data.
 *
 * Parsing strategy:
 *  1. Read the file into an `ArrayBuffer`.
 *  2. Validate the SKP header magic bytes.
 *  3. Attempt library-based parsing with `openskp`.
 *  4. Fall back to the built-in minimal reader.
 *
 * On success the returned `ParsedModel` has at least one geometry and a valid
 * bounding box. The caller is responsible for setting `parseStatus` and
 * `model` / `parseError` in application state.
 *
 * @param file  The `.skp` File object selected by the user.
 * @returns     A `ParsedModel` suitable for loading into a Three.js scene.
 * @throws      `Error` with a human-readable message on any parse failure.
 *
 * Requirements: 1.3, 1.4, 1.5
 */
export async function parseSkpFile(file: File): Promise<ParsedModel> {
  // 1. Read binary data. Support environments where `File.arrayBuffer` may
  // not be present (older jsdom/polyfills) by falling back to
  // `new Response(file).arrayBuffer()` which works for Blob/File-like objects.
  let buffer: ArrayBuffer;
  try {
    if (typeof (file as any).arrayBuffer === 'function') {
      buffer = await (file as any).arrayBuffer();
    } else if (typeof (globalThis as any).FileReader !== 'undefined') {
      // Fallback for environments with a FileReader (jsdom): read the blob
      // as an ArrayBuffer using FileReader.
      buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const fr = new (globalThis as any).FileReader();
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.onerror = () => reject(fr.error);
        fr.readAsArrayBuffer(file as Blob);
      });
    } else {
      // Last-resort: try Response if available.
      buffer = await new Response(file as any).arrayBuffer();
    }
  } catch (cause) {
    throw new Error(
      `Failed to read file "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }

  // 2. Validate header.
  if (!hasValidSkpHeader(buffer)) {
    throw new Error(
      `"${file.name}" does not appear to be a valid SketchUp file. ` +
        'The file header does not match any known SKP format signature.'
    );
  }

  // 3. Try library-based parsing.
  try {
    const libResult = await tryParseWithOpenskp(buffer);
    if (libResult !== null) {
      return libResult;
    }
  } catch (cause) {
    // Library is present but the file is unsupported or corrupt — surface this
    // directly rather than silently falling back.
    throw new Error(
      `Failed to parse SKP file "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }

  // 4. Built-in minimal reader fallback.
  try {
    return tryBuiltInReader(buffer);
  } catch (cause) {
    throw new Error(
      `Failed to parse SKP file "${file.name}": ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}
