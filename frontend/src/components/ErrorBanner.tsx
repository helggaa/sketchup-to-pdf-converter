import { useAppContext } from '../context/AppContext';

/**
 * Displays the current `parseError` or `exportError` from AppContext when set.
 * Renders nothing when both are null.
 *
 * Requirements: 1.2, 1.5, 1.7, 6.5
 */
function ErrorBanner() {
  const { state, dispatch } = useAppContext();

  // Prefer parse error; fall back to export error.
  const message = state.parseError ?? state.exportError;

  if (!message) {
    return null;
  }

  function handleDismiss() {
    if (state.parseError) {
      dispatch({ type: 'SET_PARSE_ERROR', error: null });
    } else {
      dispatch({ type: 'SET_EXPORT_ERROR', error: null });
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fca5a5',
        borderRadius: '0.375rem',
        color: '#b91c1c',
        marginBottom: '1rem',
      }}
    >
      <span>{message}</span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss error"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#b91c1c',
          fontSize: '1rem',
          padding: '0 0.25rem',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default ErrorBanner;
