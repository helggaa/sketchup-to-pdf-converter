import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useAppContext } from '../context/AppContext';
import { PRESET_VIEWS, ORDERED_VIEWS } from '../types';
import { renderThumbnail } from '../renderers/thumbnailRenderer';
import type { ParsedModel } from '../types';

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

export function ThumbnailPreviewPanel(): React.ReactElement {
  const { state, dispatch } = useAppContext();
  const { model, selectedViews, thumbnails } = state;
  const [isRendering, setIsRendering] = useState(false);
  const orderedSelectedViews = useMemo(
    () => ORDERED_VIEWS.filter((name) => selectedViews.has(name)),
    [selectedViews]
  );

  useEffect(() => {
    if (!model || orderedSelectedViews.length === 0) {
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    const scene = buildSceneFromModel(model);

    (async () => {
      for (const viewName of orderedSelectedViews) {
        if (cancelled) {
          return;
        }

        try {
          const dataUrl = await renderThumbnail(scene, PRESET_VIEWS[viewName], model.boundingBox);
          if (cancelled) {
            return;
          }
          dispatch({ type: 'SET_THUMBNAIL', viewName, dataUrl });
        } catch (error) {
          if (cancelled) {
            return;
          }
          const message = error instanceof Error ? error.message : 'Failed to render thumbnail.';
          dispatch({ type: 'SET_EXPORT_ERROR', error: message });
        }
      }
    })()
      .finally(() => {
        if (!cancelled) {
          setIsRendering(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [model, orderedSelectedViews, dispatch]);

  return (
    <section aria-label="Thumbnail preview panel" style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem' }}>
      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', color: '#111827' }}>Thumbnails</h2>
        {isRendering && (
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Updating…</span>
        )}
      </div>

      {orderedSelectedViews.length === 0 ? (
        <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
          Select one or more preset views to generate thumbnails.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
          {orderedSelectedViews.map((viewName) => (
            <div
              key={viewName}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>
                {viewName}
              </div>
              <div style={{ width: '100%', height: '0', paddingBottom: '141.56%', position: 'relative' }}>
                {thumbnails[viewName] ? (
                  <img
                    src={thumbnails[viewName]}
                    alt={`${viewName} thumbnail`}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      fontSize: '0.85rem',
                      padding: '0.75rem',
                      textAlign: 'center',
                    }}
                  >
                    Rendering thumbnail…
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
