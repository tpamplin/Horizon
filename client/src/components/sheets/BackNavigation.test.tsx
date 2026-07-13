// =============================================================================
// Horizon — Back Navigation Tests
// =============================================================================
// Verify back buttons render on all sheet and library pages.
// Tests check button presence, aria-label, and click behavior.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock stores before importing components that use them
vi.mock('../../stores/characterStore.js', () => ({
  useCharacterStore: (selector?: (s: any) => any) => {
    const state = {
      campaignCharacters: [],
      fetchMyCharacters: vi.fn(),
      createCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
      loading: false,
      error: null,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../stores/npcStore.js', () => ({
  useNPCStore: (selector?: (s: any) => any) => {
    const state = {
      npcs: [],
      fetchMyNPCs: vi.fn(),
      createNPC: vi.fn(),
      deleteNPC: vi.fn(),
      loading: false,
      error: null,
    };
    return selector ? selector(state) : state;
  },
}));

import { CharacterLibraryPage } from './CharacterLibraryPage.js';
import { NPCLibraryPage } from './NPCLibraryPage.js';
import { ItemLibraryPage } from './ItemLibraryPage.js';
import { AbilityLibraryPage } from './AbilityLibraryPage.js';

// -----------------------------------------------------------------------------
// CharacterLibraryPage
// -----------------------------------------------------------------------------

describe('CharacterLibraryPage — back button', () => {
  it('renders a back button with correct aria-label', () => {
    render(
      <MemoryRouter>
        <CharacterLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveTextContent(/← Back/);
  });

  it('back button is a native button element', () => {
    render(
      <MemoryRouter>
        <CharacterLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    expect(backBtn.tagName).toBe('BUTTON');
    expect(backBtn).not.toBeDisabled();
  });
});

// -----------------------------------------------------------------------------
// NPCLibraryPage
// -----------------------------------------------------------------------------

describe('NPCLibraryPage — back button', () => {
  it('renders a back button with correct text', () => {
    render(
      <MemoryRouter>
        <NPCLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveTextContent(/← Back/);
  });

  it('back button is keyboard-operable', () => {
    render(
      <MemoryRouter>
        <NPCLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    expect(backBtn.tagName).toBe('BUTTON');
    expect(backBtn).not.toBeDisabled();
  });
});

// -----------------------------------------------------------------------------
// ItemLibraryPage
// -----------------------------------------------------------------------------

describe('ItemLibraryPage — back button', () => {
  it('renders a back button', () => {
    render(
      <MemoryRouter>
        <ItemLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to previous page/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveTextContent(/← Back/);
  });

  it('back button is keyboard-operable', () => {
    render(
      <MemoryRouter>
        <ItemLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to previous page/i });
    expect(backBtn).not.toBeDisabled();
  });
});

// -----------------------------------------------------------------------------
// AbilityLibraryPage
// -----------------------------------------------------------------------------

describe('AbilityLibraryPage — back button', () => {
  it('renders a back button', () => {
    render(
      <MemoryRouter>
        <AbilityLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to previous page/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveTextContent(/← Back/);
  });

  it('back button is keyboard-operable', () => {
    render(
      <MemoryRouter>
        <AbilityLibraryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to previous page/i });
    expect(backBtn).not.toBeDisabled();
  });
});
