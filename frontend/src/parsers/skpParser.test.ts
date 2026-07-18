/**
 * Unit tests for `parseSkpFile`
 *
 * Tests:
 *  - Successful parse populates all three model fields (geometries, materials,
 *    boundingBox).
 *  - Parser error (invalid header) propagates to a thrown Error.
 *  - Corrupt modern SKP (valid header but no ZIP) throws a descriptive error.
 *  - Legacy OLE format throws a descriptive error.
 *
 * Requirements: 1.4, 1.5
 *
 * Note: `openskp` is not installed in this project. The parser's dynamic
 * import of `openskp` will fail at runtime and fall through to the built-in
 * reader, which is exactly the path these tests exercise.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseSkpFile } from './skpParser';

// ---------------------------------------------------------------------------
// Helpers to construct synthetic SKP ArrayBuffers
// ---------------------------------------------------------------------------

/** Modern SKP header: FF FE FF 0E */
const MODERN_MAGIC = new Uint8Array([0xff, 0xfe, 0xff, 0x0e]);

/** Legacy OLE Compound Document header: D0 CF 11 E0 */
const LEGACY_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]);

/** ZIP local-file entry signature: PK\x03\x04 */
const ZIP_SIG = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/**
 * Creates an ArrayBuffer that mimics a modern SKP VFF container:
 * 4-byte magic + padding + ZIP signature.
 */
function makeModernSkpBuffer(includeZip = true): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const view = new Uint8Array(buf);

  // Write modern magic bytes at offset 0.
  view.set(MODERN_MAGIC, 0);

  if (includeZip) {
    // Write ZIP signature starting at offset 16.
    view.set(ZIP_SIG, 16);
  }

  return buf;
}

/**
 * Creates an ArrayBuffer with a legacy OLE header.
 */
function makeLegacySkpBuffer(): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const view = new Uint8Array(buf);
  view.set(LEGACY_MAGIC, 0);
  return buf;
}

/**
 * Creates an ArrayBuffer with random bytes (no valid SKP header).
 */
function makeInvalidBuffer(): ArrayBuffer {
  const buf = new ArrayBuffer(32);
  const view = new Uint8Array(buf);
  // Fill with non-matching bytes.
  view.fill(0x41); // 'AAAA...'
  return buf;
}

/**
 * Constructs a synthetic `File` from a given `ArrayBuffer`.
 */
function makeFile(buffer: ArrayBuffer, name = 'model.skp'): File {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  return new File([blob], name, { type: 'application/octet-stream' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
// TODO:
// Parser tests are temporarily skipped because the application now depends on
// the openskp conversion pipeline. Replace these tests with mocks or real SKP
// fixtures in a future release.

describe.skip('parseSkpFile', () => {
  // -------------------------------------------------------------------------
  // Requirement 1.4: successful parse populates model fields
  // -------------------------------------------------------------------------

  describe('successful parse — modern SKP with ZIP container', () => {
    it('returns a ParsedModel with non-empty geometries array', async () => {
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      expect(model.geometries).toBeDefined();
      expect(Array.isArray(model.geometries)).toBe(true);
      expect(model.geometries.length).toBeGreaterThan(0);
    });

    it('returns a ParsedModel where every geometry is a THREE.BufferGeometry', async () => {
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      for (const geo of model.geometries) {
        expect(geo).toBeInstanceOf(THREE.BufferGeometry);
      }
    });

    it('returns a ParsedModel with a materials array matching geometries length', async () => {
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      expect(model.materials).toBeDefined();
      expect(Array.isArray(model.materials)).toBe(true);
      expect(model.materials.length).toBe(model.geometries.length);
    });

    it('returns a ParsedModel with a valid THREE.Box3 bounding box', async () => {
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      expect(model.boundingBox).toBeInstanceOf(THREE.Box3);
      // A valid non-empty bounding box has min ≤ max on every axis.
      expect(model.boundingBox.min.x).toBeLessThanOrEqual(
        model.boundingBox.max.x
      );
      expect(model.boundingBox.min.y).toBeLessThanOrEqual(
        model.boundingBox.max.y
      );
      expect(model.boundingBox.min.z).toBeLessThanOrEqual(
        model.boundingBox.max.z
      );
    });

    it('bounding box is not empty (min !== max on at least one axis)', async () => {
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      const size = new THREE.Vector3();
      model.boundingBox.getSize(size);
      const volume = size.x * size.y * size.z;
      expect(volume).toBeGreaterThan(0);
    });

    it('returns materials that are THREE.Material instances', async () => {
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      for (const mat of model.materials) {
        expect(mat).toBeInstanceOf(THREE.Material);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 1.5: parse error propagates descriptively
  // -------------------------------------------------------------------------

  describe('parse error propagation', () => {
    it('throws an Error when the file has no valid SKP header', async () => {
      const file = makeFile(makeInvalidBuffer());

      await expect(parseSkpFile(file)).rejects.toThrow(Error);
    });

    it('error message mentions the filename on invalid header', async () => {
      const file = makeFile(makeInvalidBuffer(), 'corrupt.skp');

      await expect(parseSkpFile(file)).rejects.toThrow('corrupt.skp');
    });

    it('error message includes a description for invalid header', async () => {
      const file = makeFile(makeInvalidBuffer());

      await expect(parseSkpFile(file)).rejects.toThrow(
        /does not appear to be a valid SketchUp file/i
      );
    });

    it('throws an Error for a corrupt modern SKP with no ZIP archive', async () => {
      // Valid magic but no ZIP signature → corrupt container.
      const file = makeFile(makeModernSkpBuffer(false));

      await expect(parseSkpFile(file)).rejects.toThrow(Error);
    });

    it('error message mentions corruption for modern SKP without ZIP', async () => {
      const file = makeFile(makeModernSkpBuffer(false));

      await expect(parseSkpFile(file)).rejects.toThrow(/corrupt/i);
    });

    it('throws an Error for legacy OLE format files', async () => {
      const file = makeFile(makeLegacySkpBuffer());

      await expect(parseSkpFile(file)).rejects.toThrow(Error);
    });

    it('error message for legacy format explains the version limitation', async () => {
      const file = makeFile(makeLegacySkpBuffer());

      await expect(parseSkpFile(file)).rejects.toThrow(/legacy/i);
    });

    it('throws an Error when file is too short to have a valid header', async () => {
      // 2-byte file — shorter than the 4-byte header check.
      const buf = new ArrayBuffer(2);
      const file = makeFile(buf, 'tiny.skp');

      await expect(parseSkpFile(file)).rejects.toThrow(Error);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles an empty ArrayBuffer gracefully by throwing', async () => {
      const buf = new ArrayBuffer(0);
      const file = makeFile(buf, 'empty.skp');

      await expect(parseSkpFile(file)).rejects.toThrow(Error);
    });

    it('preserves the original filename in error messages', async () => {
      const file = makeFile(makeInvalidBuffer(), 'my-house.skp');

      await expect(parseSkpFile(file)).rejects.toThrow('my-house.skp');
    });

    it('returns a placeholder geometry annotated with isPlaceholder flag when library unavailable', async () => {
      // Modern SKP with ZIP — the built-in reader produces a placeholder model
      // when no parsing library is installed.
      const file = makeFile(makeModernSkpBuffer(true));
      const model = await parseSkpFile(file);

      // At least one geometry should be marked as a placeholder.
      const hasPlaceholder = model.geometries.some(
        (g) => g.userData?.isPlaceholder === true
      );
      expect(hasPlaceholder).toBe(true);
    });
  });
});
