import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewLabel } from './ViewLabel';
import { PRESET_VIEWS } from '../types';
import type { PresetViewName } from '../types';

const ALL_VIEW_NAMES = Object.keys(PRESET_VIEWS) as PresetViewName[];

describe('ViewLabel', () => {
  it('renders the view name as text', () => {
    render(<ViewLabel viewName="Isometric" />);
    expect(screen.getByText('Isometric')).toBeInTheDocument();
  });

  it('renders an accessible label containing the view name', () => {
    render(<ViewLabel viewName="Front" />);
    const el = screen.getByLabelText('Active view: Front');
    expect(el).toBeInTheDocument();
  });

  it('updates text when a different view name is passed', () => {
    const { rerender } = render(<ViewLabel viewName="Top" />);
    expect(screen.getByText('Top')).toBeInTheDocument();

    rerender(<ViewLabel viewName="Back" />);
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.queryByText('Top')).toBeNull();
  });

  it('renders correctly for every preset view name', () => {
    for (const name of ALL_VIEW_NAMES) {
      const { unmount } = render(<ViewLabel viewName={name} />);
      expect(screen.getByText(name)).toBeInTheDocument();
      unmount();
    }
  });

  it('has aria-live="polite" for screen-reader announcements', () => {
    render(<ViewLabel viewName="Left" />);
    const el = screen.getByLabelText('Active view: Left');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });
});
