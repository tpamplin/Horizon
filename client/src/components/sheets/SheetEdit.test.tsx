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

  it('renders modifier inputs for each stat in die-format character', () => {
    renderSheetEdit(dieChar);

    const modInputs = screen.getAllByRole('spinbutton', { name: /modifier/i });
    expect(modInputs).toHaveLength(6);
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
// Adversity Token Controls
// -----------------------------------------------------------------------------

describe('SheetEdit — adversity tokens', () => {
  it('displays current token count', () => {
    renderSheetEdit(dieChar);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('increase button calls change handler', () => {
    renderSheetEdit(dieChar);

    const addBtn = screen.getByRole('button', { name: /add one adversity token/i });
    fireEvent.click(addBtn);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('decrease button calls change handler', () => {
    renderSheetEdit(dieChar);

    const removeBtn = screen.getByRole('button', { name: /remove one adversity token/i });
    expect(removeBtn).not.toBeDisabled();
    fireEvent.click(removeBtn);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('decrease button is disabled at 0', () => {
    const zeroChar = {
      ...dieChar,
      sheetData: { ...dieChar.sheetData, adversityTokens: 0 },
    };
    renderSheetEdit(zeroChar);

    const removeBtn = screen.getByRole('button', { name: /remove one adversity token/i });
    expect(removeBtn).toBeDisabled();
  });
});

// -----------------------------------------------------------------------------
// Die Rating Edge Cases
// -----------------------------------------------------------------------------

describe('SheetEdit — die rating edge cases', () => {
  it('displays D4+2 modifier correctly', () => {
    const char: Character = {
      ...dieChar,
      sheetData: {
        ...dieChar.sheetData,
        stats: { ...dieChar.sheetData.stats, cognition: 'D4+2' as unknown as string },
      },
    };
    renderSheetEdit(char);

    const cognitionSelect = screen.getAllByRole('combobox', { name: /die rating/i })[0]!;
    expect(cognitionSelect).toHaveValue('D4');
    const modInput = screen.getAllByRole('spinbutton', { name: /modifier/i })[0]!;
    expect(modInput).toHaveValue(2);
  });

  it('displays D20+5 modifier correctly', () => {
    const char: Character = {
      ...dieChar,
      sheetData: {
        ...dieChar.sheetData,
        stats: { ...dieChar.sheetData.stats, influence: 'D20+5' as unknown as string },
      },
    };
    renderSheetEdit(char);

    const influenceSelect = screen.getAllByRole('combobox', { name: /die rating/i })[4]!;
    expect(influenceSelect).toHaveValue('D20');
    const modInput = screen.getAllByRole('spinbutton', { name: /modifier/i })[4]!;
    expect(modInput).toHaveValue(5);
  });

  it('handles negative modifier (D8-1)', () => {
    const char: Character = {
      ...dieChar,
      sheetData: {
        ...dieChar.sheetData,
        stats: { ...dieChar.sheetData.stats, conflict: 'D8-1' as unknown as string },
      },
    };
    renderSheetEdit(char);

    const conflictSelect = screen.getAllByRole('combobox', { name: /die rating/i })[3]!;
    expect(conflictSelect).toHaveValue('D8');
    const modInput = screen.getAllByRole('spinbutton', { name: /modifier/i })[3]!;
    expect(modInput).toHaveValue(-1);
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
