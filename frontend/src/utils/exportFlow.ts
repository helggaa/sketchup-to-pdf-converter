import * as React from 'react';
import * as THREE from 'three';
import type { AppAction } from '../context/AppContext';
import type { AppState, ParsedModel, AnnotationData, PresetViewName } from '../types';
import { PRESET_VIEWS, ORDERED_VIEWS } from '../types';
import { derivePdfFilename } from './filename';
import { renderViewHighRes } from '../renderers/highResRenderer';

type BackendViewPayload = {
  view_name: PresetViewName;
  image_data: string;
  annotation: AnnotationData | null;
};

function buildSceneFromModel(model: ParsedModel): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(1, 2, 3);
  scene.add(directional);

  for (let i = 0; i < model.geometries.length; i += 1) {
    const geometry = model.geometries[i];
    const material = model.materials[i] ?? new THREE.MeshStandardMaterial({ color: 0xc8c8c8 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
  }

  return scene;
}

export async function performExport(
  state: AppState,
  dispatch: React.Dispatch<AppAction> | ((action: AppAction) => void)
): Promise<void> {
  if (!state.model) {
    dispatch({ type: 'SET_EXPORT_ERROR', error: 'No parsed model is available for export.' });
    dispatch({ type: 'SET_EXPORT_STATUS', status: 'error' });
    return;
  }

  if (state.selectedViews.size === 0) {
    dispatch({ type: 'SET_EXPORT_ERROR', error: 'Please select at least one view before exporting.' });
    dispatch({ type: 'SET_EXPORT_STATUS', status: 'error' });
    return;
  }

  dispatch({ type: 'SET_EXPORT_ERROR', error: null });
  dispatch({ type: 'SET_EXPORT_STATUS', status: 'rendering' });

  const scene = buildSceneFromModel(state.model);
  const orderedViewNames = ORDERED_VIEWS.filter((viewName) => state.selectedViews.has(viewName));
  const payloadViews: BackendViewPayload[] = [];

  try {
    for (const viewName of orderedViewNames) {
      const view = PRESET_VIEWS[viewName];
      const imageData = await renderViewHighRes(state.model ? scene : scene, view, state.model.boundingBox);
      const annotation = state.annotationEnabled ? state.annotations[viewName] : null;
      payloadViews.push({ view_name: viewName, image_data: imageData, annotation });
    }

    dispatch({ type: 'SET_EXPORT_STATUS', status: 'uploading' });

    const filename = state.uploadedFile ? derivePdfFilename(state.uploadedFile.name) : 'model-views.pdf';

    const response = await fetch('/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ views: payloadViews, filename }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PDF service error: ${response.status} ${response.statusText} ${body}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    dispatch({ type: 'SET_EXPORT_STATUS', status: 'done' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred while exporting.';
    dispatch({ type: 'SET_EXPORT_ERROR', error: message });
    dispatch({ type: 'SET_EXPORT_STATUS', status: 'error' });
  }
}
