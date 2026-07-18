import { useAppContext } from '../context/AppContext';

/**
 * Full-screen overlay displayed while parsing or exporting is in progress.
 *
 * Visible when:
 *  - `parseStatus === 'parsing'`    (Req 1.3)
 *  - `exportStatus === 'rendering'` (Req 6.4)
 *  - `exportStatus === 'uploading'` (Req 6.4)
 *
 * Renders nothing otherwise.
 */
function LoadingOverlay() {
  const { state } = useAppContext();

  const isParsing = state.parseStatus === 'parsing';
  const isExporting =
    state.exportStatus === 'rendering' || state.exportStatus === 'uploading';

  if (!isParsing && !isExporting) {
    return null;
  }

  const label = isParsing
    ? 'Parsing SKP file, please wait'
    : state.exportStatus === 'rendering'
      ? 'Rendering views, please wait'
      : 'Uploading to PDF service, please wait';

  const message = isParsing
    ? 'Parsing SKP file\u2026'
    : state.exportStatus === 'rendering'
      ? 'Rendering views\u2026'
      : 'Generating PDF\u2026';

  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        color: '#ffffff',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '3rem',
          height: '3rem',
          border: '4px solid rgba(255,255,255,0.3)',
          borderTopColor: '#ffffff',
          borderRadius: '50%',
          animation: 'skp-spin 0.8s linear infinite',
          marginBottom: '1rem',
        }}
      />
      <style>{`
        @keyframes skp-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
}

export default LoadingOverlay;
