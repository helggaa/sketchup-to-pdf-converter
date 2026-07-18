import { useAppContext } from '../context/AppContext';
import type { PresetViewName } from '../types';

/**
 * AnnotationPanel lets the user enable/disable per-page PDF annotations and
 * configure a title and optional scale label for each selected view.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
function AnnotationPanel(): React.ReactElement {
  const { state, dispatch } = useAppContext();
  const { annotationEnabled, annotations, selectedViews } = state;

  function handleToggleEnabled(e: React.ChangeEvent<HTMLInputElement>) {
    dispatch({ type: 'SET_ANNOTATION_ENABLED', enabled: e.target.checked });
  }

  function handleTitleChange(viewName: PresetViewName, value: string) {
    dispatch({
      type: 'SET_ANNOTATION',
      viewName,
      annotation: { ...annotations[viewName], title: value },
    });
  }

  function handleScaleLabelChange(viewName: PresetViewName, value: string) {
    dispatch({
      type: 'SET_ANNOTATION',
      viewName,
      annotation: { ...annotations[viewName], scaleLabel: value },
    });
  }

  const selectedViewList = Array.from(selectedViews) as PresetViewName[];

  return (
    <section aria-label="PDF Annotations" style={{ marginBottom: '1rem' }}>
      {/* Enable/disable toggle — Req 5.1 */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={annotationEnabled}
            onChange={handleToggleEnabled}
            aria-label="Enable PDF annotations"
          />
          <span>Add annotations to PDF</span>
        </label>
      </div>

      {/* Per-view annotation fields — shown only when enabled and views are selected */}
      {annotationEnabled && selectedViewList.length > 0 && (
        <div>
          {selectedViewList.map((viewName) => {
            const annotation = annotations[viewName];
            return (
              <div
                key={viewName}
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                }}
              >
                {/* Section header — view name */}
                <p
                  style={{
                    margin: '0 0 0.5rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  {viewName}
                </p>

                {/* Title field — Req 5.2, 5.3 */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <label
                    htmlFor={`title-${viewName}`}
                    style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}
                  >
                    Title
                  </label>
                  <input
                    id={`title-${viewName}`}
                    type="text"
                    value={annotation.title}
                    onChange={(e) => handleTitleChange(viewName, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Scale label field — Req 5.4, 5.5 */}
                <div>
                  <label
                    htmlFor={`scale-${viewName}`}
                    style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}
                  >
                    Scale label
                  </label>
                  <input
                    id={`scale-${viewName}`}
                    type="text"
                    value={annotation.scaleLabel}
                    onChange={(e) => handleScaleLabelChange(viewName, e.target.value)}
                    placeholder="e.g. 1:100"
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AnnotationPanel;
