// =============================================================================
// Horizon — SheetEdit Component Tests
// =============================================================================
// Tests for die-rating selector, modifier input, and rich strength/flaw
// editing in the editable character sheet.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SheetEdit } from './SheetEdit.js';
import type { Character } from 'shared';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** A valid die-format character fixture. */
const dieChar: Character = {
  id: 'char-1',
  playerUserId: 'user-1',
  name: 'Test Pirate',
  archetype: 'Swashbuckler',
  portraitUrl: null,
  sheetData: {
    stats: {
      cognition: 'D10',
      force: 'D6',
      reflex: 'D12',
      conflict: 'D8',
      influence: 'D20',
      stability: 'D4',
    },
    adversityTokens: 3,
    strengths: [
      { name: 'Loyal', description: 'Fiercely loyal to crew.' },
      { name: 'Brave', description: '' },
    ],
    flaws: [
      { name: 'Kleptomaniac', description: 'Steals shiny things.' },
    ],
    traits: ['Charming'],
    inventory: [],
    signatureItems: [],
    specialAbilities: [],
    conditions: [],
    customTracks: [],
    backstory: '',
    notes: '',
    campaignNotes: '',
  },
  createdAt: '2026-01-01T00:00:00Z',
};

/** A numeric-format character fixture (backward compat). */
const numericChar: Character = {
  ...dieChar,
  id: 'char-2',
  sheetData: {
    ...dieChar.sheetData,
    stats: {
      cognition: 3,
      force: 2,
      reflex: 4,
      conflict: 1,
      influence: 5,
      stability: 0,
    },
  },
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function renderSheetEdit(char: Character = dieChar) {
  const onSave = vi.fn();
  const onPortraitChange = vi.fn();
  const onDone = vi.fn();

  const utils = render(
    <MemoryRouter>
      <SheetEdit
        character={char}
        saveState="idle"
        isGM={false}
        onSave={onSave}
        onPortraitChange={onPortraitChange}
        onDone={onDone}
      />
    </MemoryRouter>,
  );

  return { ...utils, onSave, onPortraitChange, onDone };
}

// -----------------------------------------------------------------------------
// Die Rating Selector
// -----------------------------------------------------------------------------

describe('SheetEdit — die rating selector', () => {
  it('renders die select dropdowns for each stat in die-format character', () => {
    renderSheetEdit(dieChar);

    // All 6 stats should have a die select dropdown
    const selects = screen.getAllByRole('combobox', { name: /die rating/i });
    expect(selects).toHaveLength(6);

    // Each should have the correct default value
    expect(selects[0]).toHaveValue('D10'); // cognition default
    expect(selects[1]).toHaveValue('D6');  // force default
    expect(selects[2]).toHaveValue('D12'); // reflex default
    expect(selects[3]).toHaveValue('D8');  // conflict default
    expect(selects[4]).toHaveValue('D20'); // influence default
    expect(selects[5]).toHaveValue('D4');  // stability default
  });

  it('does not show manual modifier inputs (modifiers come from items)', () => {
    renderSheetEdit(dieChar);

    // No spinbutton elements labeled "modifier" should exist
    expect(screen.queryByRole('spinbutton', { name: /modifier/i })).not.toBeInTheDocument();
  });

  it('changing die rating selects a new value', () => {
    renderSheetEdit(dieChar);

    const cognitionSelect = screen.getAllByRole('combobox', { name: /die rating/i })[0]!;
    fireEvent.change(cognitionSelect, { target: { value: 'D20' } });
    expect(cognitionSelect).toHaveValue('D20');
  });

  it('render numeric controls (+/-) for numeric-format character', () => {
    renderSheetEdit(numericChar);

    // Numeric stats show +/- buttons, not die selects
    expect(screen.queryByRole('combobox', { name: /die rating/i })).not.toBeInTheDocument();

    // Should have increment/decrement buttons
    const minusBtns = screen.getAllByRole('button', { name: /decrease/i });
    const plusBtns = screen.getAllByRole('button', { name: /increase/i });
    expect(minusBtns.length).toBeGreaterThanOrEqual(6);
    expect(plusBtns.length).toBeGreaterThanOrEqual(6);
  });
});

// -----------------------------------------------------------------------------
// Rich Strength & Flaw Editing
// -----------------------------------------------------------------------------

describe('SheetEdit — rich strength/flaw editing', () => {
  it('renders existing strength entries with name and description fields', () => {
    renderSheetEdit(dieChar);

    // Check that strength names are rendered as inputs
    const loyalInput = screen.getByDisplayValue('Loyal');
    expect(loyalInput).toBeInTheDocument();

    // Check that description textarea contains the description
    const loyalDesc = screen.getByDisplayValue('Fiercely loyal to crew.');
    expect(loyalDesc).toBeInTheDocument();
  });

  it('renders existing flaw entries', () => {
    renderSheetEdit(dieChar);

    const kleptoInput = screen.getByDisplayValue('Kleptomaniac');
    expect(kleptoInput).toBeInTheDocument();

    const kleptoDesc = screen.getByDisplayValue('Steals shiny things.');
    expect(kleptoDesc).toBeInTheDocument();
  });

  it('"Add Strength" button adds a new empty entry', () => {
    renderSheetEdit(dieChar);

    const addBtn = screen.getByRole('button', { name: /add strength/i });
    fireEvent.click(addBtn);

    // Should now have 3 strength entries (2 existing + 1 new empty)
    const nameInputs = screen.getAllByPlaceholderText(/strength name/i);
    expect(nameInputs.length).toBe(3);
  });

  it('"Add Flaw" button adds a new empty entry', () => {
    renderSheetEdit(dieChar);

    const addBtn = screen.getByRole('button', { name: /add flaw/i });
    fireEvent.click(addBtn);

    const nameInputs = screen.getAllByPlaceholderText(/flaw name/i);
    expect(nameInputs.length).toBe(2);
  });

  it('remove button deletes a strength entry', () => {
    renderSheetEdit(dieChar);

    // There should be 2 remove buttons initially (one per strength)
    const removeBtns = screen.getAllByRole('button', { name: /remove.*loyal|remove.*brave/i });
    fireEvent.click(removeBtns[0]!);

    // Should now have 1 strength
    const nameInputs = screen.getAllByPlaceholderText(/strength name/i);
    expect(nameInputs.length).toBe(1);
  });

  it('editing strength name fires change', () => {
    renderSheetEdit(dieChar);

    const loyalInput = screen.getByDisplayValue('Loyal');
    fireEvent.change(loyalInput, { target: { value: 'Super Loyal' } });
    expect(screen.getByDisplayValue('Super Loyal')).toBeInTheDocument();
  });

  it('editing strength description fires change', () => {
    renderSheetEdit(dieChar);

    const descTextarea = screen.getByDisplayValue('Fiercely loyal to crew.');
    fireEvent.change(descTextarea, { target: { value: 'Very loyal indeed.' } });
    expect(screen.getByDisplayValue('Very loyal indeed.')).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Die Rating Conflict Detection
// -----------------------------------------------------------------------------

describe('SheetEdit — die rating conflict detection', () => {
  it('allows selecting any die (no options disabled)', () => {
    renderSheetEdit(dieChar);

    const selects = screen.getAllByRole('combobox', { name: /die rating/i });
    const forceSelect = selects[1]!; // force currently D6
    // D10 option in force select should NOT be disabled — all dice are selectable
    const d10Option = forceSelect.querySelector('option[value="D10"]') as HTMLOptionElement;
    expect(d10Option).not.toBeNull();
    expect(d10Option.disabled).toBe(false);
  });

  it('shows conflict warning when two stats share the same die', () => {
    renderSheetEdit(dieChar);

    // Change cognition to D6 (same as force currently)
    const cognitionSelect = screen.getAllByRole('combobox', { name: /die rating/i })[0]!;
    fireEvent.change(cognitionSelect, { target: { value: 'D6' } });

    // Both cognition and force now show D6 — conflict warnings should appear
    const warnings = screen.getAllByText('\u26A0 Duplicate');
    expect(warnings.length).toBe(2);
  });

  it('removes conflict warning when duplicate is resolved', () => {
    renderSheetEdit(dieChar);

    // Create conflict: set cognition to D6 (same as force)
    const selects = screen.getAllByRole('combobox', { name: /die rating/i });
    const cognitionSelect = selects[0]!;
    fireEvent.change(cognitionSelect, { target: { value: 'D6' } });

    // Both show warnings
    expect(screen.getAllByText('\u26A0 Duplicate').length).toBe(2);

    // Resolve: change cognition to unique die
    fireEvent.change(cognitionSelect, { target: { value: 'D10' } });

    // Warnings should be gone
    expect(screen.queryByText('\u26A0 Duplicate')).not.toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Backward Compat: String[] Strengths & Flaws
// -----------------------------------------------------------------------------

describe('SheetEdit — backward compat string[] strengths/flaws', () => {
  it('renders legacy string strengths as name-only entries', () => {
    const char: Character = {
      ...dieChar,
      sheetData: {
        ...dieChar.sheetData,
        strengths: ['Brave', 'Loyal'] as unknown as { name: string; description: string }[],
      },
    };
    renderSheetEdit(char);

    // Should render string strengths as input values (normalized to objects)
    const braveInput = screen.getByDisplayValue('Brave');
    expect(braveInput).toBeInTheDocument();
    const loyalInput = screen.getByDisplayValue('Loyal');
    expect(loyalInput).toBeInTheDocument();
  });

  it('renders legacy string flaws as name-only entries', () => {
    const char: Character = {
      ...dieChar,
      sheetData: {
        ...dieChar.sheetData,
        flaws: ['Kleptomaniac', 'Impulsive'] as unknown as { name: string; description: string }[],
      },
    };
    renderSheetEdit(char);

    const kleptoInput = screen.getByDisplayValue('Kleptomaniac');
    expect(kleptoInput).toBeInTheDocument();
    const impulsiveInput = screen.getByDisplayValue('Impulsive');
    expect(impulsiveInput).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Track Modifier Editing
// -----------------------------------------------------------------------------

describe('SheetEdit — track modifier editing', () => {
  const trackChar: Character = {
    ...dieChar,
    sheetData: {
      ...dieChar.sheetData,
      customTracks: [
        {
          name: 'Intoxication',
          min: 0,
          max: 10,
          current: 3,
          levels: [
            { atLevel: 0, description: 'Sober', statModifiers: { cognition: 5, force: -5 } },
            { atLevel: 5, description: 'The Perfect Buzz', statModifiers: { cognition: 3, force: 3 } },
          ],
        },
      ],
    },
  };

  it('renders track level descriptions', () => {
    renderSheetEdit(trackChar);

    expect(screen.getByDisplayValue('Sober')).toBeInTheDocument();
    expect(screen.getByDisplayValue('The Perfect Buzz')).toBeInTheDocument();
  });

  it('renders track level thresholds', () => {
    renderSheetEdit(trackChar);

    // Should have two level number inputs
    const levelInputs = screen.getAllByRole('spinbutton', { name: /level.*threshold/i });
    expect(levelInputs).toHaveLength(2);
    expect(levelInputs[0]).toHaveValue(0);
    expect(levelInputs[1]).toHaveValue(5);
  });

  it('"Add Level" button adds a new empty level', () => {
    renderSheetEdit(trackChar);

    const addBtn = screen.getByRole('button', { name: /add level/i });
    fireEvent.click(addBtn);

    // Should have 3 level number inputs now
    const levelInputs = screen.getAllByRole('spinbutton', { name: /level.*threshold/i });
    expect(levelInputs).toHaveLength(3);
  });

  it('renders stat modifier inputs on track levels', () => {
    renderSheetEdit(trackChar);

    // Level 0 has cognition +5 and force -5
    const statModInputs = screen.getAllByRole('spinbutton', { name: /modifier at level 0/i });
    expect(statModInputs).toHaveLength(2);
    expect(statModInputs[0]).toHaveValue(5); // cognition
    expect(statModInputs[1]).toHaveValue(-5); // force
  });
});

// -----------------------------------------------------------------------------
// Save / Cancel / Discard Flow
// -----------------------------------------------------------------------------

describe('SheetEdit — save/cancel/discard flow', () => {
  it('renders Save button with correct aria-label', () => {
    renderSheetEdit(dieChar);

    const saveBtn = screen.getByRole('button', { name: /save character sheet/i });
    expect(saveBtn).toBeInTheDocument();
    expect(saveBtn).not.toBeDisabled();
  });

  it('renders Cancel button', () => {
    renderSheetEdit(dieChar);

    const cancelBtn = screen.getByRole('button', { name: /cancel editing/i });
    expect(cancelBtn).toBeInTheDocument();
  });

  it('Cancel when clean calls onDone immediately (no modal)', () => {
    const { onDone } = renderSheetEdit(dieChar);

    const cancelBtn = screen.getByRole('button', { name: /cancel editing/i });
    fireEvent.click(cancelBtn);

    expect(onDone).toHaveBeenCalled();
    // No discard modal should appear
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Cancel when dirty shows discard confirmation modal', () => {
    const { onDone } = renderSheetEdit(dieChar);

    // Make a change to set isDirty (add a strength)
    fireEvent.click(screen.getByRole('button', { name: /add strength/i }));

    // Now cancel — should show modal, NOT call onDone
    const cancelBtn = screen.getByRole('button', { name: /cancel editing — unsaved/i });
    fireEvent.click(cancelBtn);

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/discard unsaved changes/i)).toBeInTheDocument();
  });

  it('Discard button in modal closes modal and calls onDone', () => {
    const { onDone } = renderSheetEdit(dieChar);

    // Make dirty by adding a strength
    fireEvent.click(screen.getByRole('button', { name: /add strength/i }));
    // Trigger cancel → modal
    fireEvent.click(screen.getByRole('button', { name: /cancel editing — unsaved/i }));
    // Click Discard
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onDone).toHaveBeenCalled();
    // Modal should be gone
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Keep Editing button closes modal, stays in edit mode', () => {
    const { onDone } = renderSheetEdit(dieChar);

    // Make dirty by adding a strength
    fireEvent.click(screen.getByRole('button', { name: /add strength/i }));
    // Trigger cancel → modal
    fireEvent.click(screen.getByRole('button', { name: /cancel editing — unsaved/i }));
    // Click Keep Editing
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }));

    expect(onDone).not.toHaveBeenCalled();
    // Modal should be gone, but still in edit mode (Save button visible)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save character sheet/i })).toBeInTheDocument();
  });

  it('Save button calls onSave and returns to view', async () => {
    vi.useFakeTimers();
    const { onSave, onDone } = renderSheetEdit(dieChar);

    const saveBtn = screen.getByRole('button', { name: /save character sheet/i });
    fireEvent.click(saveBtn);

    // onSave should be called immediately
    expect(onSave).toHaveBeenCalled();
    // onDone should NOT be called yet (400ms delay)
    expect(onDone).not.toHaveBeenCalled();

    // After 400ms, onDone should be called
    vi.advanceTimersByTime(400);
    expect(onDone).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
