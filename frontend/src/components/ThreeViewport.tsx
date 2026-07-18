import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useAppContext } from '../context/AppContext';
import { PRESET_VIEWS } from '../types';
import type { PresetView, ParsedModel } from '../types';
import { ViewLabel } from './ViewLabel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the camera distance needed to fit the model's bounding sphere
 * within the given field-of-view angle.
 */
function computeCameraDistance(
  boundingBox: THREE.Box3,
  fovDegrees: number
): number {
  const sphere = new THREE.Sphere();
  boundingBox.getBoundingSphere(sphere);
  const radius = sphere.radius || 1;
  // Distance so the sphere fits vertically in the frustum with a small margin
  return (radius / Math.sin((fovDegrees * Math.PI) / 360)) * 1.2;
}

/**
 * Position a PerspectiveCamera for the given preset view so the whole model
 * is visible. The camera looks at the bounding-box centre.
 */
function positionCamera(
  camera: THREE.PerspectiveCamera,
  view: PresetView,
  boundingBox: THREE.Box3
): void {
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);

  const distance = computeCameraDistance(boundingBox, camera.fov);

  const dir = new THREE.Vector3(...view.cameraDirection).normalize();
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.lookAt(center);

  // Keep "up" meaningful for every orthogonal-ish axis.
  // For Top/Bottom the default up (0,1,0) is collinear with the direction, so
  // we use (0,0,-1) instead.
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(up)) > 0.99) {
    up.set(0, 0, -1);
  }
  camera.up.copy(up);
  camera.lookAt(center); // re-apply after setting up
}

/**
 * Build Three.js Mesh objects from a ParsedModel and add them to a scene.
 * Returns the added meshes so they can be removed later.
 */
function addModelToScene(
  scene: THREE.Scene,
  model: ParsedModel
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  const { geometries, materials } = model;

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i];
    const material = materials[i] ?? new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshes.push(mesh);
  }

  return meshes;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CameraTween {
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  /** Bounding-box centre — camera looks at this throughout the tween. */
  center: THREE.Vector3;
  /** Normalised progress in [0, 1]. */
  progress: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Interactive Three.js viewport.
 *
 * Satisfies:
 *   - Req 2.1  Renders the model when loaded.
 *   - Req 2.2  Initial view is Isometric.
 *   - Req 2.3  Camera transitions complete within 500 ms (≤16 frames × ~16 ms).
 *   - Req 2.4  ViewLabel shows active view name.
 *   - Req 2.5  requestAnimationFrame loop; no heavy postprocessing (≥30 fps).
 */
export function ThreeViewport(): React.ReactElement {
  const { state } = useAppContext();
  const { model, activePreviewView } = state;

  // DOM container that the renderer's canvas is appended to
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js objects kept in refs so they persist across renders without
  // triggering React re-renders
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameIdRef = useRef<number>(0);
  const modelMeshesRef = useRef<THREE.Mesh[]>([]);

  // Camera tween state — mutated directly in the rAF loop for performance
  const tweenRef = useRef<CameraTween | null>(null);

  // ---------------------------------------------------------------------------
  // Initialise renderer, scene, camera, lights — once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0xf0f0f0);

    // Apply accessibility attributes to the canvas
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-label', '3D model preview');
    canvas.setAttribute('role', 'img');
    canvas.style.display = 'block';

    container.appendChild(canvas);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);

    // Camera — perspective with a 45° FoV
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      10000
    );
    // Default Isometric position before any model is loaded
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Render loop — satisfies Req 2.5 (requestAnimationFrame, ≥30 fps)
    // Also advances camera tween each frame — satisfies Req 2.3 (≤500 ms)
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      // Advance camera tween if active
      const tween = tweenRef.current;
      if (tween?.active) {
        // Advance by 1/16 per frame → ~16 frames ≈ 267 ms at 60 fps, well within 500 ms
        tween.progress = Math.min(tween.progress + 1 / 16, 1);
        const t = tween.progress;

        camera.position.set(
          THREE.MathUtils.lerp(tween.startPos.x, tween.targetPos.x, t),
          THREE.MathUtils.lerp(tween.startPos.y, tween.targetPos.y, t),
          THREE.MathUtils.lerp(tween.startPos.z, tween.targetPos.z, t)
        );
        camera.lookAt(tween.center);

        if (tween.progress >= 1) {
          // Snap exactly to target and stop
          camera.position.copy(tween.targetPos);
          camera.lookAt(tween.center);
          tween.active = false;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      canvas.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — initialise once

  // ---------------------------------------------------------------------------
  // Sync model into scene whenever `model` changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    // Remove previously added meshes
    for (const mesh of modelMeshesRef.current) {
      scene.remove(mesh);
    }
    modelMeshesRef.current = [];

    if (!model) return;

    const meshes = addModelToScene(scene, model);
    modelMeshesRef.current = meshes;

    // Position camera for the current active preset view
    const view = PRESET_VIEWS[activePreviewView];
    positionCamera(camera, view, model.boundingBox);
    camera.updateProjectionMatrix();
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Update camera whenever the active preset view changes — starts a smooth
  // tween to the new camera position (Req 2.3: completes within 500 ms).
  // ---------------------------------------------------------------------------
  const updateCameraForView = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera || !model) return;

    const view = PRESET_VIEWS[activePreviewView];

    // Compute target position using a temporary camera so positionCamera's
    // side-effects (position, lookAt, up) don't immediately snap the real camera.
    const tempCamera = camera.clone() as THREE.PerspectiveCamera;
    positionCamera(tempCamera, view, model.boundingBox);
    const targetPos = tempCamera.position.clone();

    // Compute bounding-box centre for lookAt during tween
    const center = new THREE.Vector3();
    model.boundingBox.getCenter(center);

    // Copy the camera's "up" vector from the temp camera so lookAt stays correct
    camera.up.copy(tempCamera.up);

    // Start the tween
    tweenRef.current = {
      startPos: camera.position.clone(),
      targetPos,
      center,
      progress: 0,
      active: true,
    };

    camera.updateProjectionMatrix();
  }, [activePreviewView, model]);

  useEffect(() => {
    updateCameraForView();
  }, [updateCameraForView]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#f0f0f0',
      }}
    >
      {/* ViewLabel overlay — Req 2.4 */}
      <ViewLabel viewName={activePreviewView} />
    </div>
  );
}

export default ThreeViewport;
