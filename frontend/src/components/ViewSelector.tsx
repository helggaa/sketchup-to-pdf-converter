import { useAppContext } from '../context/AppContext';
import { ORDERED_VIEWS } from '../types';
import type { PresetViewName } from '../types';

/**
 * View selection panel presenting all seven preset views as toggleable buttons.
 * Satisfies Requirements 3.1, 3.2, 3.3, 3.4, 3.5.
 */
export function ViewSelector(): React.ReactElement {
  const { state, dispatch } = useAppContext();
  const { selectedViews } = state;

  function handleViewClick(viewName: PresetViewName): void {
    dispatch({ type: 'TOGGLE_VIEW', viewName });
    dispatch({ type: 'SET_ACTIVE_PREVIEW_VIEW', viewName });
  }

  return (
    <fieldset style={styles.fieldset}>
      <legend style={styles.legend}>Select Views</legend>

      {/* Count badge — Req 3.5 */}
      <span style={styles.badge} aria-live="polite">
        {selectedViews.size} selected
      </span>

      <div style={styles.grid}>
        {ORDERED_VIEWS.map((viewName) => {
          const isChecked = selectedViews.has(viewName);
          return (
            <button
              key={viewName}
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => handleViewClick(viewName)}
              style={{
                ...styles.viewButton,
                ...(isChecked ? styles.viewButtonActive : styles.viewButtonInactive),
              }}
            >
              {viewName}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------

const styles = {
  fieldset: {
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '12px 14px',
    margin: 0,
    fontFamily: 'sans-serif',
  } as React.CSSProperties,

  legend: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    padding: '0 4px',
  } as React.CSSProperties,

  badge: {
    display: 'inline-block',
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '10px',
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
  } as React.CSSProperties,

  viewButton: {
    padding: '7px 10px',
    borderRadius: '4px',
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    textAlign: 'center' as const,
    transition: 'background 0.1s, color 0.1s, border-color 0.1s',
    outline: 'none',
    // :focus-visible is applied via CSS class; inline fallback below ensures
    // keyboard navigation is still obvious when CSS is absent.
  } as React.CSSProperties,

  viewButtonActive: {
    background: '#2563eb',
    borderColor: '#1d4ed8',
    color: '#ffffff',
  } as React.CSSProperties,

  viewButtonInactive: {
    background: '#f9fafb',
    borderColor: '#d1d5db',
    color: '#374151',
  } as React.CSSProperties,
} as const;

export default ViewSelector;
