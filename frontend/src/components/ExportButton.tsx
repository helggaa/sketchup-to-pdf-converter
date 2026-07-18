import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { performExport } from '../utils/exportFlow';

function ExportButton(): React.ReactElement {
  const { state, dispatch } = useAppContext();
  const [localError, setLocalError] = useState<string | null>(null);
  const isBusy = state.exportStatus === 'rendering' || state.exportStatus === 'uploading';
  const hasModel = state.model !== null && state.parseStatus === 'success';
  const isDisabled = isBusy || !hasModel || state.selectedViews.size === 0;

  async function handleExport() {
    if (!state.model) {
      setLocalError('Upload and parse a SketchUp model before exporting.');
      return;
    }

    if (state.selectedViews.size === 0) {
      setLocalError('Please select at least one view before exporting.');
      return;
    }

    setLocalError(null);
    await performExport(state, dispatch);
  }

  return (
    <section aria-label="Export controls" style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>
            Export PDF
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
            Selected views will be exported as an A4 PDF.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={isDisabled}
        aria-busy={isBusy}
        aria-disabled={isDisabled}
        style={{
          width: '100%',
          display: 'inline-flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.9rem 1rem',
          borderRadius: '0.75rem',
          border: 'none',
          backgroundColor: isDisabled ? '#cbd5e1' : '#2563eb',
          color: '#ffffff',
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          fontSize: '0.95rem',
        }}
      >
        {isBusy ? 'Preparing PDF…' : 'Export PDF'}
      </button>

      {localError && (
        <p style={{ margin: '0.75rem 0 0', color: '#b91c1c', fontSize: '0.875rem' }}>
          {localError}
        </p>
      )}
    </section>
  );
}

export default ExportButton;
