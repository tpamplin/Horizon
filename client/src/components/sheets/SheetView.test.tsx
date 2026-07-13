// =============================================================================
// Horizon — SheetView Component Tests
// =============================================================================
// Tests for RichTraitView, die-rating display, and backward-compatible
// strength/flaw rendering.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RichTraitView } from './SheetView.js';
import type { TraitEntry } from './SheetView.js';

// -----------------------------------------------------------------------------
// RichTraitView — expand/collapse behavior
// -----------------------------------------------------------------------------

describe('RichTraitView', () => {
  it('renders the trait name', () => {
    const entry: TraitEntry = { name: 'Extremely Loyal', description: 'Will protect friends at any cost.' };
    render(<RichTraitView entry={entry} />);
    expect(screen.getByText('Extremely Loyal')).toBeInTheDocument();
  });

  it('shows chevron when description is present', () => {
    const entry: TraitEntry = { name: 'Kleptomaniac', description: 'Steals to re-distribute wealth.' };
    render(<RichTraitView entry={entry} />);
    expect(screen.getByText('▸')).toBeInTheDocument();
  });

  it('does not show chevron when description is empty', () => {
    const entry: TraitEntry = { name: 'Brave', description: '' };
    render(<RichTraitView entry={entry} />);
    expect(screen.queryByText('▸')).not.toBeInTheDocument();
  });

  it('toggle button is disabled when no description', () => {
    const entry: TraitEntry = { name: 'Brave', description: '' };
    render(<RichTraitView entry={entry} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('toggle button is enabled when description exists', () => {
    const entry: TraitEntry = { name: 'Loyal', description: 'Always loyal.' };
    render(<RichTraitView entry={entry} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('does not show description initially', () => {
    const entry: TraitEntry = { name: 'Loyal', description: 'Always loyal to friends.' };
    render(<RichTraitView entry={entry} />);
    expect(screen.queryByText('Always loyal to friends.')).not.toBeInTheDocument();
  });

  it('shows description after clicking toggle', () => {
    const entry: TraitEntry = { name: 'Loyal', description: 'Always loyal to friends.' };
    render(<RichTraitView entry={entry} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Always loyal to friends.')).toBeInTheDocument();
  });

  it('hides description on second click', () => {
    const entry: TraitEntry = { name: 'Loyal', description: 'Always loyal to friends.' };
    render(<RichTraitView entry={entry} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn); // expand
    expect(screen.getByText('Always loyal to friends.')).toBeInTheDocument();
    fireEvent.click(btn); // collapse
    expect(screen.queryByText('Always loyal to friends.')).not.toBeInTheDocument();
  });

  it('toggles aria-expanded correctly', () => {
    const entry: TraitEntry = { name: 'Loyal', description: 'Loyal to friends.' };
    render(<RichTraitView entry={entry} />);
    const btn = screen.getByRole('button');

    // Initially collapsed
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    // Expand
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    // Collapse
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not have aria-expanded when no description', () => {
    const entry: TraitEntry = { name: 'Simple', description: '' };
    render(<RichTraitView entry={entry} />);
    const btn = screen.getByRole('button');
    expect(btn).not.toHaveAttribute('aria-expanded');
  });

  it('chevron changes direction on expand/collapse', () => {
    const entry: TraitEntry = { name: 'Loyal', description: 'Loyal to friends.' };
    render(<RichTraitView entry={entry} />);
    const btn = screen.getByRole('button');

    expect(screen.getByText('▸')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.getByText('▾')).toBeInTheDocument();
  });

  it('click does nothing when button is disabled', () => {
    const entry: TraitEntry = { name: 'NoDesc', description: '' };
    render(<RichTraitView entry={entry} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    // Should not throw; no description should appear
    expect(screen.queryByText('▾')).not.toBeInTheDocument();
  });
});
