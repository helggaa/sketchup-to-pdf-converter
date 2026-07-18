import * as THREE from 'three';
import type { PresetView } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** A4 at 300 dpi: 8.27 in × 11.69 in × 300 dpi = 2480 × 3508 px */
const HR_WIDTH = 2480;
const HR_HEIGHT = 3508;

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
  camera.lookAt(center);

  // Keep "up" meaningful for every orthogonal-ish axis.
  // For Top/Bottom the default up (0,1,0) is collinear with the direction,
  // so we use (0,0,-1) instead.
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(up)) > 0.99) {
    up.set(0, 0, -1);
  }
  camera.up.copy(up);
  camera.lookAt(center); // re-apply after setting up
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a single preset view of the given scene at full A4/300-dpi
 * resolution (2480 × 3508 px) using an offscreen WebGLRenderer.
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
 * Satisfies: Req 6.1 — minimum 2480 × 3508 px per exported view.
 */
export async function renderViewHighRes(
  scene: THREE.Scene,
  view: PresetView,
  boundingBox: THREE.Box3
): Promise<string> {
  // Create an offscreen renderer with a backing canvas of the target size.
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1); // ensure pixel-exact 2480 × 3508 output
  renderer.setSize(HR_WIDTH, HR_HEIGHT);
  renderer.setClearColor(0xffffff);

  try {
    // Set up a perspective camera sized for the output aspect ratio.
    const camera = new THREE.PerspectiveCamera(
      FOV_DEGREES,
      HR_WIDTH / HR_HEIGHT,
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
