import type { PresetViewName } from '../types';

interface ViewLabelProps {
  viewName: PresetViewName;
}

/**
 * Displays the name of the currently active Preset View inside the viewport.
 * Satisfies Requirement 2.4.
 */
export function ViewLabel({ viewName }: ViewLabelProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        padding: '4px 10px',
        background: 'rgba(0, 0, 0, 0.55)',
        color: '#ffffff',
        borderRadius: '4px',
        fontSize: '13px',
        fontFamily: 'sans-serif',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 1,
      }}
      aria-live="polite"
      aria-label={`Active view: ${viewName}`}
    >
      {viewName}
    </div>
  );
}

export default ViewLabel;
