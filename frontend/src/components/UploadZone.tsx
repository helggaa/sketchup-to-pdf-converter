import React, { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { validateSkpFile } from '../utils/fileValidation';
import { parseSkpFile } from '../parsers/skpParser';

/**
 * File upload zone with drag-and-drop support.
 *
 * Behaviour:
 * - Accepts only `.skp` files via the file input and drag-and-drop.
 * - Calls `validateSkpFile` on any selected / dropped file.
 *   - On WRONG_EXTENSION: sets parseError to the appropriate message.
 *   - On FILE_TOO_LARGE: sets parseError to the appropriate message.
 * - On valid file:
 *   1. Dispatches SET_UPLOADED_FILE and clears any previous error.
 *   2. Sets parseStatus to 'parsing' so <LoadingOverlay /> appears.
 *   3. Calls parseSkpFile; on success dispatches SET_MODEL + SET_PARSE_STATUS('success').
 *   4. On parse failure dispatches SET_PARSE_STATUS('error') + SET_PARSE_ERROR.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7
 */
function UploadZone() {
  const { state, dispatch } = useAppContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const helperRef = useRef<HTMLParagraphElement | null>(null);

  function isSkpFile(file: File) {
    return file.name.toLowerCase().endsWith('.skp');
  }

  function showValidationError(message: string) {
    setLocalError(message);
    if (helperRef.current) {
      helperRef.current.textContent = message;
    }
    const uploadErr = document.querySelector('[data-testid="upload-error"]');
    if (uploadErr) uploadErr.textContent = message;
    dispatch({ type: 'SET_PARSE_ERROR', error: message });
  }

  // -------------------------------------------------------------------------
  // Core file processing
  // -------------------------------------------------------------------------

  async function processFile(file: File): Promise<void> {
    // Clear any previous local error before validation; global parse errors
    // are handled via the context so other components like ErrorBanner can
    // observe them. Also clear the visible upload-error node synchronously.
    setLocalError(null);
    if (helperRef.current) helperRef.current.textContent = '';
    const uploadErrClear = document.querySelector('[data-testid="upload-error"]');
    if (uploadErrClear) uploadErrClear.textContent = '';
    dispatch({ type: 'SET_PARSE_ERROR', error: null });

    const result = validateSkpFile(file);

    if (!result.valid) {
      const message =
        result.error === 'WRONG_EXTENSION'
          ? 'Only .skp files are supported.'
          : 'File exceeds the 200 MB size limit.';
      // Always surface errors synchronously in local state so tests and
      // immediate UI flows observe the message without a race. Also write
      // the message directly to the DOM node for immediate discoverability.
      showValidationError(message);
      return;
    }

    // Valid file — store it and start parsing.
    dispatch({ type: 'SET_UPLOADED_FILE', file });
    dispatch({ type: 'SET_PARSE_STATUS', status: 'parsing' });

    try {
      const model = await parseSkpFile(file);
      dispatch({ type: 'SET_MODEL', model });
      dispatch({ type: 'SET_PARSE_STATUS', status: 'success' });
      // Clear any local error on successful parse
      setLocalError(null);
      if (helperRef.current) helperRef.current.textContent = '';
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : String(err);
      const message = `Failed to parse SKP file: ${reason}.`;
      // Surface parse failure immediately in local state and DOM.
      setLocalError(message);
      if (helperRef.current) helperRef.current.textContent = message;
      dispatch({ type: 'SET_PARSE_ERROR', error: message });
      dispatch({ type: 'SET_PARSE_STATUS', status: 'error' });
    }
  }

  // -------------------------------------------------------------------------
  // File input change handler
  // -------------------------------------------------------------------------

  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!isSkpFile(file)) {
        showValidationError('Only .skp files are supported.');
        e.target.value = '';
        return;
      }

      await processFile(file);
    }
    // Reset input so the same file can be re-selected after an error.
    e.target.value = '';
  }

  // -------------------------------------------------------------------------
  // Drag-and-drop handlers
  // -------------------------------------------------------------------------

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!isSkpFile(file)) {
        showValidationError('Only .skp files are supported.');
        return;
      }
      processFile(file);
    }
  }

  // -------------------------------------------------------------------------
  // Click on zone opens the file picker
  // -------------------------------------------------------------------------

  function handleZoneClick() {
    inputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload SketchUp file drop zone — click or drag a .skp file here"
      onClick={handleZoneClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 2rem',
        border: `2px dashed ${isDragOver ? '#2563eb' : '#94a3b8'}`,
        borderRadius: '0.5rem',
        backgroundColor: isDragOver ? '#eff6ff' : '#f8fafc',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        outline: 'none',
      }}
    >
      {/* Hidden native file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".skp"
        aria-label="Upload SketchUp file"
        onChange={handleInputChange}
        // Visually hidden but still accessible to assistive technologies.
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />

      <svg
        aria-hidden="true"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isDragOver ? '#2563eb' : '#64748b'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: '1rem' }}
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>

      <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
        {isDragOver ? 'Drop your .skp file here' : 'Click or drag a .skp file here'}
      </p>
      <p data-testid="upload-error" ref={helperRef} role={(localError ?? state.parseError) && state.parseStatus !== 'parsing' ? 'status' : undefined} aria-live="polite" style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.875rem', color: '#64748b', minHeight: '1em' }}>
        {localError ?? 'SketchUp files only · max 200 MB'}
      </p>
    </div>
  );
}

export default UploadZone;
