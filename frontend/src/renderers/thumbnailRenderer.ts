import * as THREE from 'three';
import type { PresetView } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Thumbnail dimensions maintain A4 portrait ratio (1:√2). */
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 453;

const FOV_DEGREES = 45;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Compute the camera distance needed to fit the model's bounding sphere
 * within the given field-of-view angle, with a small margin.
 */
function computeCameraDistance(
  boundingBox: THREE.Box3,
  fovDegrees: number
): number {
  const sphere = new THREE.Sphere();
  boundingBox.getBoundingSphere(sphere);
  const radius = sphere.radius || 1;
  return (radius / Math.sin((fovDegrees * Math.PI) / 360)) * 1.2;
}

/**
 * Position a PerspectiveCamera for the given preset view so the whole model
 * is visible. The camera looks at the bounding-box centre.
 *
 * Handles the up-vector edge case: for Top/Bottom views the default up
 * vector (0, 1, 0) is collinear with the camera direction, so (0, 0, -1)
 * is used instead.
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

  // Keep "up" meaningful for every orthogonal-ish axis.
  // For Top/Bottom the default up (0, 1, 0) is collinear with the direction,
  // so we use (0, 0, -1) instead.
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(up)) > 0.99) {
    up.set(0, 0, -1);
  }
  camera.up.copy(up);
  camera.lookAt(center);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a single preset view of the given scene at thumbnail resolution
 * (320 × 453 px, maintaining A4 portrait ratio) using an offscreen
 * WebGLRenderer.
 *
 * A fresh renderer is created per call to avoid conflicts with the
 * interactive viewport. It is disposed immediately after the PNG is
 * captured to free GPU resources.
 *
 * @param scene       The populated Three.js scene to render.
 * @param view        The preset camera configuration (direction + name).
 * @param boundingBox Axis-aligned bounding box of the model geometry.
 * @returns           A base64 data URL: `data:image/png;base64,...`
 *
 * Satisfies: Req 4.1 — thumbnail preview per selected view.
 */
export async function renderThumbnail(
  scene: THREE.Scene,
  view: PresetView,
  boundingBox: THREE.Box3
): Promise<string> {
  // Create an offscreen renderer with a backing canvas of the target size.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1); // ensure pixel-exact 320 × 453 output
  renderer.setSize(THUMB_WIDTH, THUMB_HEIGHT);
  renderer.setClearColor(0xffffff);

  try {
    // Set up a perspective camera sized for the thumbnail aspect ratio.
    const camera = new THREE.PerspectiveCamera(
      FOV_DEGREES,
      THUMB_WIDTH / THUMB_HEIGHT,
      0.01,
      100000
    );

    positionCamera(camera, view, boundingBox);
    camera.updateProjectionMatrix();

    // Render a single frame.
    renderer.render(scene, camera);

    // Capture and return the PNG data URL.
    return renderer.domElement.toDataURL('image/png');
  } finally {
    // Always dispose to release GPU memory.
    renderer.dispose();
  }
}
