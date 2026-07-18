/**
 * Tests for ThreeViewport component.
 *
 * jsdom doesn't support WebGL, so we mock THREE.WebGLRenderer and
 * ResizeObserver — but we keep as much real logic as possible.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as THREE from 'three';
import { AppProvider } from '../context/AppContext';
import { ThreeViewport } from './ThreeViewport';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// ResizeObserver is not available in jsdom
(window as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock WebGLRenderer — jsdom has no WebGL context
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setPixelRatio() {}
    setSize() {}
    setClearColor() {}
    render() {}
    dispose() {}
  }

  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderInProvider(ui: React.ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThreeViewport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the container div', () => {
    const { container } = renderInProvider(<ThreeViewport />);
    // The outermost div is the container
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it('appends the renderer canvas to the container', () => {
    const { container } = renderInProvider(<ThreeViewport />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('sets aria-label="3D model preview" on the canvas', () => {
    renderInProvider(<ThreeViewport />);
    const canvas = document.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-label')).toBe('3D model preview');
  });

  it('sets role="img" on the canvas', () => {
    renderInProvider(<ThreeViewport />);
    const canvas = document.querySelector('canvas');
    expect(canvas?.getAttribute('role')).toBe('img');
  });

  it('renders the ViewLabel showing the default active view (Isometric)', () => {
    renderInProvider(<ThreeViewport />);
    expect(screen.getByText('Isometric')).toBeInTheDocument();
  });

  it('displays the ViewLabel with the correct aria-label', () => {
    renderInProvider(<ThreeViewport />);
    expect(screen.getByLabelText('Active view: Isometric')).toBeInTheDocument();
  });
});
