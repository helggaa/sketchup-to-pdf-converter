import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../context/AppContext';
import AppContext from '../context/AppContext';
import type { AppAction } from '../context/AppContext';
import { createInitialState } from '../context/AppContext';
import AnnotationPanel from './AnnotationPanel';
import type { AppState } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders AnnotationPanel inside an AppProvider, optionally patching state
 * via a one-shot action before the component mounts.
 */
function renderWithState(
  stateOverride?: Partial<AppState>,
  dispatchSpy?: (action: AppAction) => void
) {
  // Build a wrapper that exposes a custom context value when needed
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AppProvider>{children}</AppProvider>;
  }

  if (!stateOverride && !dispatchSpy) {
    return render(<AnnotationPanel />, { wrapper: Wrapper });
  }

  // Provide a custom context value that merges the override
  const state: AppState = { ...createInitialState(), ...stateOverride };
  const dispatch = (action: AppAction) => dispatchSpy?.(action);

  return render(
    <AppContext.Provider value={{ state, dispatch }}>
      <AnnotationPanel />
    </AppContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnnotationPanel', () => {
  // -------------------------------------------------------------------------
  // Toggle rendering
  // -------------------------------------------------------------------------

  it('renders the enable annotations toggle', () => {
    renderWithState();
    const toggle = screen.getByRole('checkbox', { name: /enable pdf annotations/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('renders the "Add annotations to PDF" label', () => {
    renderWithState();
    expect(screen.getByText(/add annotations to pdf/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Per-view fields hidden when annotations disabled
  // -------------------------------------------------------------------------

  it('does not show per-view fields when annotationEnabled is false', () => {
    renderWithState({
      annotationEnabled: false,
      selectedViews: new Set(['Front', 'Top']),
    });

    expect(screen.queryByLabelText(/title/i)).toBeNull();
    expect(screen.queryByLabelText(/scale label/i)).toBeNull();
  });

  it('does not show per-view fields when there are no selected views even if enabled', () => {
    renderWithState({ annotationEnabled: true, selectedViews: new Set() });

    expect(screen.queryByLabelText(/title/i)).toBeNull();
    expect(screen.queryByLabelText(/scale label/i)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Per-view fields shown when annotations enabled + views selected
  // -------------------------------------------------------------------------

  it('shows title and scale label inputs for each selected view when enabled', () => {
    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Front', 'Top']),
    });

    // title inputs
    expect(screen.getByLabelText('Title', { selector: '#title-Front' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title', { selector: '#title-Top' })).toBeInTheDocument();

    // scale label inputs
    expect(screen.getByLabelText('Scale label', { selector: '#scale-Front' })).toBeInTheDocument();
    expect(screen.getByLabelText('Scale label', { selector: '#scale-Top' })).toBeInTheDocument();
  });

  it('renders correct label/input id pairs for htmlFor association', () => {
    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Isometric']),
    });

    const titleInput = document.getElementById('title-Isometric');
    const scaleInput = document.getElementById('scale-Isometric');
    expect(titleInput).not.toBeNull();
    expect(scaleInput).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Default title = PresetView name (Req 5.2)
  // -------------------------------------------------------------------------

  it('defaults title to the preset view name', () => {
    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Back']),
    });

    const titleInput = screen.getByLabelText('Title', { selector: '#title-Back' }) as HTMLInputElement;
    expect(titleInput.value).toBe('Back');
  });

  it('defaults scale label to empty string', () => {
    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Left']),
    });

    const scaleInput = screen.getByLabelText('Scale label', { selector: '#scale-Left' }) as HTMLInputElement;
    expect(scaleInput.value).toBe('');
  });

  // -------------------------------------------------------------------------
  // Custom override (Req 5.3)
  // -------------------------------------------------------------------------

  it('displays custom title when annotations map has been overridden', () => {
    const annotations = {
      ...createInitialState().annotations,
      Right: { title: 'Custom Right Title', scaleLabel: '' },
    };

    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Right']),
      annotations,
    });

    const titleInput = screen.getByLabelText('Title', { selector: '#title-Right' }) as HTMLInputElement;
    expect(titleInput.value).toBe('Custom Right Title');
  });

  it('displays custom scale label when set', () => {
    const annotations = {
      ...createInitialState().annotations,
      Top: { title: 'Top', scaleLabel: '1:100' },
    };

    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Top']),
      annotations,
    });

    const scaleInput = screen.getByLabelText('Scale label', { selector: '#scale-Top' }) as HTMLInputElement;
    expect(scaleInput.value).toBe('1:100');
  });

  // -------------------------------------------------------------------------
  // Dispatch — toggle
  // -------------------------------------------------------------------------

  it('dispatches SET_ANNOTATION_ENABLED(true) when toggle is checked', async () => {
    const user = userEvent.setup();
    const dispatched: AppAction[] = [];

    renderWithState({ annotationEnabled: false }, (a) => dispatched.push(a));

    await user.click(screen.getByRole('checkbox', { name: /enable pdf annotations/i }));

    expect(dispatched).toContainEqual({ type: 'SET_ANNOTATION_ENABLED', enabled: true });
  });

  it('dispatches SET_ANNOTATION_ENABLED(false) when toggle is unchecked', async () => {
    const user = userEvent.setup();
    const dispatched: AppAction[] = [];

    renderWithState({ annotationEnabled: true, selectedViews: new Set() }, (a) => dispatched.push(a));

    await user.click(screen.getByRole('checkbox', { name: /enable pdf annotations/i }));

    expect(dispatched).toContainEqual({ type: 'SET_ANNOTATION_ENABLED', enabled: false });
  });

  // -------------------------------------------------------------------------
  // Dispatch — title input
  // -------------------------------------------------------------------------

  it('dispatches SET_ANNOTATION with updated title when title input changes', async () => {
    const user = userEvent.setup();
    const dispatched: AppAction[] = [];
    const annotations = {
      ...createInitialState().annotations,
      Front: { title: '', scaleLabel: '' },
    };

    renderWithState(
      { annotationEnabled: true, selectedViews: new Set(['Front']), annotations },
      (a) => dispatched.push(a)
    );

    const titleInput = screen.getByLabelText('Title', { selector: '#title-Front' });
    // Type a single character so the last dispatched action holds exactly that title
    await user.type(titleInput, 'X');

    const lastAnnotationAction = dispatched
      .filter((a) => a.type === 'SET_ANNOTATION')
      .slice(-1)[0] as Extract<AppAction, { type: 'SET_ANNOTATION' }> | undefined;

    expect(lastAnnotationAction).toBeDefined();
    expect(lastAnnotationAction?.viewName).toBe('Front');
    expect(lastAnnotationAction?.annotation.title).toBe('X');
  });

  // -------------------------------------------------------------------------
  // Dispatch — scale label input
  // -------------------------------------------------------------------------

  it('dispatches SET_ANNOTATION with updated scaleLabel when scale input changes', async () => {
    const user = userEvent.setup();
    const dispatched: AppAction[] = [];
    const annotations = {
      ...createInitialState().annotations,
      Bottom: { title: 'Bottom', scaleLabel: '' },
    };

    renderWithState(
      { annotationEnabled: true, selectedViews: new Set(['Bottom']), annotations },
      (a) => dispatched.push(a)
    );

    const scaleInput = screen.getByLabelText('Scale label', { selector: '#scale-Bottom' });
    // Type a single character to get a clean last-dispatch assertion
    await user.type(scaleInput, '5');

    const lastAnnotationAction = dispatched
      .filter((a) => a.type === 'SET_ANNOTATION')
      .slice(-1)[0] as Extract<AppAction, { type: 'SET_ANNOTATION' }> | undefined;

    expect(lastAnnotationAction).toBeDefined();
    expect(lastAnnotationAction?.viewName).toBe('Bottom');
    expect(lastAnnotationAction?.annotation.scaleLabel).toBe('5');
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  it('toggle has aria-label "Enable PDF annotations"', () => {
    renderWithState();
    const toggle = screen.getByRole('checkbox', { name: 'Enable PDF annotations' });
    expect(toggle).toBeInTheDocument();
  });

  it('scale label input has placeholder "e.g. 1:100"', () => {
    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Front']),
    });

    const scaleInput = screen.getByPlaceholderText('e.g. 1:100');
    expect(scaleInput).toBeInTheDocument();
  });

  it('renders the view name as a section header', () => {
    renderWithState({
      annotationEnabled: true,
      selectedViews: new Set(['Isometric']),
    });

    expect(screen.getByText('Isometric')).toBeInTheDocument();
  });
});
