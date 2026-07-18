import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewSelector } from './ViewSelector';
import { AppProvider } from '../context/AppContext';
import type { PresetViewName } from '../types';

// Ordered list matching the component's ORDERED_VIEWS constant
const ALL_VIEWS: PresetViewName[] = [
  'Top',
  'Bottom',
  'Front',
  'Back',
  'Left',
  'Right',
  'Isometric',
];

function renderWithProvider(ui: React.ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>);
}

describe('ViewSelector', () => {
  // -------------------------------------------------------------------------
  // Structure
  // -------------------------------------------------------------------------

  it('renders inside a <fieldset> with legend "Select Views"', () => {
    renderWithProvider(<ViewSelector />);
    // legend text
    expect(screen.getByText('Select Views')).toBeInTheDocument();
    // fieldset element
    const fieldset = screen.getByRole('group');
    expect(fieldset.tagName).toBe('FIELDSET');
  });

  it('renders all seven preset view buttons in order', () => {
    renderWithProvider(<ViewSelector />);
    const buttons = screen.getAllByRole('checkbox');
    expect(buttons).toHaveLength(7);
    buttons.forEach((btn, i) => {
      expect(btn).toHaveTextContent(ALL_VIEWS[i]);
    });
  });

  it('all buttons start with aria-checked="false"', () => {
    renderWithProvider(<ViewSelector />);
    const buttons = screen.getAllByRole('checkbox');
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('shows count badge starting at "0 selected"', () => {
    renderWithProvider(<ViewSelector />);
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Interaction — activation (Req 3.2)
  // -------------------------------------------------------------------------

  it('marks a view as checked after clicking it', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ViewSelector />);

    const topBtn = screen.getByRole('checkbox', { name: /top/i });
    await user.click(topBtn);

    expect(topBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('increments the count badge when a view is activated', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ViewSelector />);

    await user.click(screen.getByRole('checkbox', { name: /front/i }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /back/i }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Interaction — deactivation (Req 3.3)
  // -------------------------------------------------------------------------

  it('removes a view from selection after clicking it a second time', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ViewSelector />);

    const isoBtn = screen.getByRole('checkbox', { name: /isometric/i });
    await user.click(isoBtn); // activate
    expect(isoBtn).toHaveAttribute('aria-checked', 'true');

    await user.click(isoBtn); // deactivate
    expect(isoBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('decrements the count badge when a view is deactivated', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ViewSelector />);

    await user.click(screen.getByRole('checkbox', { name: /top/i }));
    await user.click(screen.getByRole('checkbox', { name: /left/i }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /top/i }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Interaction — multi-select (Req 3.4)
  // -------------------------------------------------------------------------

  it('allows all seven views to be selected simultaneously', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ViewSelector />);

    for (const name of ALL_VIEWS) {
      await user.click(screen.getByRole('checkbox', { name: new RegExp(name, 'i') }));
    }

    const buttons = screen.getAllByRole('checkbox');
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.getByText('7 selected')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Toggle cycle property (Req 3.2, 3.3) — Property 4 analog
  // -------------------------------------------------------------------------

  it('restores prior selection state after a full activate/deactivate cycle', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ViewSelector />);

    // Activate two views
    await user.click(screen.getByRole('checkbox', { name: /front/i }));
    await user.click(screen.getByRole('checkbox', { name: /right/i }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Toggle Right off and back on
    const rightBtn = screen.getByRole('checkbox', { name: /right/i });
    await user.click(rightBtn); // deactivate
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.click(rightBtn); // reactivate
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});
