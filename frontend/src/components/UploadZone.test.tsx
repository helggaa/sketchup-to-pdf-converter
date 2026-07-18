import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../context/AppContext';
import UploadZone from './UploadZone';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../parsers/skpParser', () => ({
  parseSkpFile: vi.fn(),
}));

import { parseSkpFile } from '../parsers/skpParser';
const mockParseSkpFile = parseSkpFile as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkpFile(name = 'model.skp', sizeBytes = 1024): File {
  const blob = new Blob(['x'.repeat(sizeBytes)], { type: 'application/octet-stream' });
  return new File([blob], name, { type: 'application/octet-stream' });
}

function makeLargeSkpFile(): File {
  // 201 MB — exceeds the 200 MB limit
  const oversizeBytes = 201 * 1024 * 1024;
  // We can't actually allocate 201 MB in a test; use Object.defineProperty to spoof the size.
  const file = new File(['x'], 'large.skp', { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: oversizeBytes });
  return file;
}

function renderUploadZone() {
  return render(
    <AppProvider>
      <UploadZone />
    </AppProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UploadZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders a file input with the correct aria-label and accept attribute', () => {
    renderUploadZone();
    const input = screen.getByLabelText<HTMLInputElement>('Upload SketchUp file');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.skp');
  });

  it('renders the drop-zone container with role="button"', () => {
    renderUploadZone();
    const zone = screen.getByRole('button', {
      name: /upload sketchup file drop zone/i,
    });
    expect(zone).toBeInTheDocument();
  });

  it('shows a prompt to drag or click for a file', () => {
    renderUploadZone();
    expect(
      screen.getByText(/click or drag a \.skp file here/i)
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // File-type validation — wrong extension
  // -------------------------------------------------------------------------

  it('does not accept a non-.skp file via input', async () => {
    renderUploadZone();
    const input = screen.getByLabelText<HTMLInputElement>('Upload SketchUp file');
    const badFile = new File(['data'], 'image.png', { type: 'image/png' });
    await userEvent.upload(input, badFile);
    expect(input.files?.length || 0).toBe(0);
    expect(input.value).toBe('');
  });

  it('does NOT call parseSkpFile when a non-.skp file is selected', async () => {
    renderUploadZone();
    const input = screen.getByLabelText<HTMLInputElement>('Upload SketchUp file');
    const badFile = new File(['data'], 'image.png', { type: 'image/png' });
    await userEvent.upload(input, badFile);
    expect(mockParseSkpFile).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // File-size validation — too large
  // -------------------------------------------------------------------------

  it('shows an error when a file exceeding 200 MB is selected', async () => {
    renderUploadZone();
    const input = screen.getByLabelText<HTMLInputElement>('Upload SketchUp file');
    await userEvent.upload(input, makeLargeSkpFile());
    expect(
      await screen.findByText('File exceeds the 200 MB size limit.')
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Valid file — happy path
  // -------------------------------------------------------------------------

  it('calls parseSkpFile with the valid .skp file', async () => {
    const fakeModel = { geometries: [], materials: [], boundingBox: {} };
    mockParseSkpFile.mockResolvedValueOnce(fakeModel);

    renderUploadZone();
    await userEvent.upload(screen.getByLabelText<HTMLInputElement>('Upload SketchUp file'), makeSkpFile());

    await waitFor(() => expect(mockParseSkpFile).toHaveBeenCalledTimes(1));
    const calledWith = mockParseSkpFile.mock.calls[0][0] as File;
    expect(calledWith.name).toBe('model.skp');
  });

  // -------------------------------------------------------------------------
  // Loading overlay — parseStatus transitions
  // -------------------------------------------------------------------------

  it('shows a loading overlay while parseSkpFile is in progress', async () => {
    // Never resolves during the test so the overlay stays visible.
    mockParseSkpFile.mockReturnValueOnce(new Promise(() => {}));

    renderUploadZone();

    // Import LoadingOverlay alongside UploadZone so it is rendered.
    const { default: LoadingOverlay } = await import('./LoadingOverlay');
    render(
      <AppProvider>
        <UploadZone />
        <LoadingOverlay />
      </AppProvider>
    );

    const inputInNewTree = screen.getAllByLabelText('Upload SketchUp file')[1] as HTMLInputElement;
    await userEvent.upload(inputInNewTree, makeSkpFile());

    await waitFor(() =>
      expect(screen.getByRole('status')).toBeInTheDocument()
    );
  });

  // -------------------------------------------------------------------------
  // Parse error path
  // -------------------------------------------------------------------------

  it('shows an error banner when parseSkpFile rejects', async () => {
    mockParseSkpFile.mockRejectedValueOnce(new Error('Corrupt file header'));

    const { default: ErrorBanner } = await import('./ErrorBanner');

    render(
      <AppProvider>
        <UploadZone />
        <ErrorBanner />
      </AppProvider>
    );

    const inputs = screen.getAllByLabelText('Upload SketchUp file') as HTMLInputElement[];
    await userEvent.upload(inputs[inputs.length - 1], makeSkpFile());

    await waitFor(() =>
      expect(
        screen.getByRole('alert')
      ).toBeInTheDocument()
    );

    expect(screen.getByRole('alert').textContent).toMatch(/corrupt file header/i);
  });

  // -------------------------------------------------------------------------
  // Drag-and-drop
  // -------------------------------------------------------------------------

  it('accepts a valid .skp file dropped onto the zone', async () => {
    const fakeModel = { geometries: [], materials: [], boundingBox: {} };
    mockParseSkpFile.mockResolvedValueOnce(fakeModel);

    renderUploadZone();
    const zone = screen.getByRole('button', {
      name: /upload sketchup file drop zone/i,
    });

    const skpFile = makeSkpFile('dropped.skp');
    fireEvent.dragOver(zone, {
      dataTransfer: { files: [skpFile] },
    });
    fireEvent.drop(zone, {
      dataTransfer: { files: [skpFile] },
    });

    await waitFor(() => expect(mockParseSkpFile).toHaveBeenCalledTimes(1));
  });

  it('shows an error when a non-.skp file is dropped', async () => {
    renderUploadZone();
    const zone = screen.getByRole('button', {
      name: /upload sketchup file drop zone/i,
    });

    const badFile = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.drop(zone, {
      dataTransfer: { files: [badFile] },
    });

    expect(
      await screen.findByText('Only .skp files are supported.')
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Keyboard activation
  // -------------------------------------------------------------------------

  it('opens the file picker when Enter is pressed on the zone', () => {
    renderUploadZone();
    const zone = screen.getByRole('button', {
      name: /upload sketchup file drop zone/i,
    });

    // The input's click should be called via the ref; we spy on the element.
    const input = screen.getByLabelText<HTMLInputElement>('Upload SketchUp file');
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    zone.focus();
    fireEvent.keyDown(zone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker when Space is pressed on the zone', () => {
    renderUploadZone();
    const zone = screen.getByRole('button', {
      name: /upload sketchup file drop zone/i,
    });

    const input = screen.getByLabelText<HTMLInputElement>('Upload SketchUp file');
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    zone.focus();
    fireEvent.keyDown(zone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
