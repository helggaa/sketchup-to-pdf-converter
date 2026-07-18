import { describe, it, expect } from 'vitest';
import { createInitialState } from './AppContext';
import { PRESET_VIEWS } from '../types';
import type { PresetViewName } from '../types';

const ALL_VIEW_NAMES = Object.keys(PRESET_VIEWS) as PresetViewName[];

describe('createInitialState', () => {
  it('returns idle parse status', () => {
    const state = createInitialState();
    expect(state.parseStatus).toBe('idle');
  });

  it('returns an empty selectedViews set', () => {
    const state = createInitialState();
    expect(state.selectedViews.size).toBe(0);
  });

  it('defaults activePreviewView to Isometric', () => {
    const state = createInitialState();
    expect(state.activePreviewView).toBe('Isometric');
  });

  it('disables annotation by default', () => {
    const state = createInitialState();
    expect(state.annotationEnabled).toBe(false);
  });

  it('initialises annotations for all 7 preset views', () => {
    const state = createInitialState();
    for (const name of ALL_VIEW_NAMES) {
      expect(state.annotations[name]).toBeDefined();
      expect(state.annotations[name].title).toBe(name);
      expect(state.annotations[name].scaleLabel).toBe('');
    }
  });

  it('initialises empty thumbnail strings for all 7 preset views', () => {
    const state = createInitialState();
    for (const name of ALL_VIEW_NAMES) {
      expect(state.thumbnails[name]).toBeDefined();
      expect(state.thumbnails[name]).toBe('');
    }
  });

  it('returns idle export status', () => {
    const state = createInitialState();
    expect(state.exportStatus).toBe('idle');
    expect(state.exportError).toBeNull();
  });
});

describe('PRESET_VIEWS', () => {
  it('contains exactly 7 preset views', () => {
    expect(ALL_VIEW_NAMES).toHaveLength(7);
  });

  it('includes all required view names', () => {
    const expected: PresetViewName[] = [
      'Top', 'Bottom', 'Front', 'Back', 'Left', 'Right', 'Isometric',
    ];
    for (const name of expected) {
      expect(PRESET_VIEWS[name]).toBeDefined();
    }
  });

  it('has a cameraDirection with exactly 3 components for each view', () => {
    for (const name of ALL_VIEW_NAMES) {
      expect(PRESET_VIEWS[name].cameraDirection).toHaveLength(3);
    }
  });

  it('marks only Isometric as non-orthographic', () => {
    for (const name of ALL_VIEW_NAMES) {
      if (name === 'Isometric') {
        expect(PRESET_VIEWS[name].orthographic).toBe(false);
      } else {
        expect(PRESET_VIEWS[name].orthographic).toBe(true);
      }
    }
  });
});
