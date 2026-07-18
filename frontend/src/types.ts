import type * as THREE from 'three';

// ---------------------------------------------------------------------------
// Preset Views
// ---------------------------------------------------------------------------

export type PresetViewName =
  | 'Top'
  | 'Bottom'
  | 'Front'
  | 'Back'
  | 'Left'
  | 'Right'
  | 'Isometric';

export interface PresetView {
  name: PresetViewName;
  /** Unit-vector direction from the target to the camera position. */
  cameraDirection: [number, number, number];
  orthographic: boolean;
}

export const PRESET_VIEWS: Record<PresetViewName, PresetView> = {
  Top: { name: 'Top', cameraDirection: [0, 1, 0], orthographic: true },
  Bottom: { name: 'Bottom', cameraDirection: [0, -1, 0], orthographic: true },
  Front: { name: 'Front', cameraDirection: [0, 0, 1], orthographic: true },
  Back: { name: 'Back', cameraDirection: [0, 0, -1], orthographic: true },
  Left: { name: 'Left', cameraDirection: [-1, 0, 0], orthographic: true },
  Right: { name: 'Right', cameraDirection: [1, 0, 0], orthographic: true },
  Isometric: {
    name: 'Isometric',
    cameraDirection: [1, 1, 1],
    orthographic: false,
  },
};

export const ORDERED_VIEWS: PresetViewName[] = [
  'Top',
  'Bottom',
  'Front',
  'Back',
  'Left',
  'Right',
  'Isometric',
];

// ---------------------------------------------------------------------------
// Parsed Model
// ---------------------------------------------------------------------------

export interface ParsedModel {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  boundingBox: THREE.Box3;
}

// ---------------------------------------------------------------------------
// Annotation
// ---------------------------------------------------------------------------

export interface AnnotationData {
  title: string;
  scaleLabel: string;
}

// ---------------------------------------------------------------------------
// Render Payload (Client → Server)
// ---------------------------------------------------------------------------

export interface ViewPayload {
  viewName: PresetViewName;
  /** Base64-encoded PNG at 2480 × 3508 px. */
  imageData: string;
  annotation: AnnotationData | null;
}

export interface RenderPayload {
  /** Ordered list of views; 1–7 items. */
  views: ViewPayload[];
  /** Base SKP filename without extension — used to name the download. */
  filename: string;
}

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------

export interface AppState {
  // File & parse state
  uploadedFile: File | null;
  parseStatus: 'idle' | 'parsing' | 'success' | 'error';
  parseError: string | null;
  model: ParsedModel | null;

  // View selection
  selectedViews: Set<PresetViewName>;
  activePreviewView: PresetViewName;

  // Annotation
  annotationEnabled: boolean;
  annotations: Record<PresetViewName, AnnotationData>;

  // Thumbnails — data URLs keyed by view name
  thumbnails: Record<PresetViewName, string>;

  // Export
  exportStatus: 'idle' | 'rendering' | 'uploading' | 'done' | 'error';
  exportError: string | null;
}
