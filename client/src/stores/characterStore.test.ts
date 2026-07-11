// =============================================================================
// Horizon — Character Store Unit Tests
// =============================================================================
// Vitest unit tests for characterStore actions. Mocks the API client and
// verifies state transitions, optimistic updates, rollback, and error handling.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// -----------------------------------------------------------------------------
// Mock the API client
// -----------------------------------------------------------------------------

vi.mock('../api/client.js', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import { useCharacterStore } from './characterStore.js';
import { api } from '../api/client.js';
import type { Character, SheetData } from 'shared';

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPut = api.put as ReturnType<typeof vi.fn>;

// -----------------------------------------------------------------------------
// Test Data
// -----------------------------------------------------------------------------

const DEFAULT_SHEET_DATA: SheetData = {
  stats: {
    cognition: 0,
    force: 0,
    reflex: 0,
    conflict: 0,
    influence: 0,
    stability: 0,
  },
  adversityTokens: 0,
  strengths: [],
  flaws: [],
  traits: [],
  inventory: [],
  signatureItems: [],
  specialAbilities: [],
  conditions: [],
  customTracks: [],
  backstory: '',
  notes: '',
  campaignNotes: '',
};

const mockCharacter: Character = {
  id: 'char-1',
  playerUserId: 'user-1',
  name: 'Test Hero',
  archetype: 'Warrior',
  portraitUrl: null,
  sheetData: { ...DEFAULT_SHEET_DATA, stats: { ...DEFAULT_SHEET_DATA.stats, cognition: 3 } },
  createdAt: '2026-07-10T00:00:00.000Z',
};

const mockCharacter2: Character = {
  id: 'char-2',
  playerUserId: 'user-1',
  name: 'Test Mage',
  archetype: 'Wizard',
  portraitUrl: '/portraits/mage.png',
  sheetData: { ...DEFAULT_SHEET_DATA, stats: { ...DEFAULT_SHEET_DATA.stats, cognition: 5 } },
  createdAt: '2026-07-10T00:00:00.000Z',
};

function resetStore() {
  useCharacterStore.setState({
    currentCharacter: null,
    campaignCharacters: [],
    loading: false,
    error: null,
    saveState: 'idle',
    isDirty: false,
  });
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('characterStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // Initial State
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('has null currentCharacter', () => {
      expect(useCharacterStore.getState().currentCharacter).toBeNull();
    });

    it('has empty campaignCharacters array', () => {
      expect(useCharacterStore.getState().campaignCharacters).toEqual([]);
    });

    it('has loading false', () => {
      expect(useCharacterStore.getState().loading).toBe(false);
    });

    it('has null error', () => {
      expect(useCharacterStore.getState().error).toBeNull();
    });

    it('has idle saveState', () => {
      expect(useCharacterStore.getState().saveState).toBe('idle');
    });

    it('has isDirty false', () => {
      expect(useCharacterStore.getState().isDirty).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchCharacter
  // ---------------------------------------------------------------------------

  describe('fetchCharacter', () => {
    it('sets loading true while fetching, then stores character on success', async () => {
      mockGet.mockResolvedValueOnce(mockCharacter);

      const promise = useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      // Loading should be true immediately after dispatch
      expect(useCharacterStore.getState().loading).toBe(true);

      await promise;

      const state = useCharacterStore.getState();
      expect(state.loading).toBe(false);
      expect(state.currentCharacter).toEqual(mockCharacter);
      expect(state.error).toBeNull();
      expect(state.isDirty).toBe(false);
    });

    it('calls the correct API endpoint', async () => {
      mockGet.mockResolvedValueOnce(mockCharacter);

      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      expect(mockGet).toHaveBeenCalledWith('/api/campaigns/camp-1/characters/char-1');
    });

    it('sets error message on failed fetch', async () => {
      mockGet.mockRejectedValueOnce(new Error('Character not found.'));

      await useCharacterStore.getState().fetchCharacter('camp-1', 'nonexistent');

      const state = useCharacterStore.getState();
      expect(state.loading).toBe(false);
      expect(state.currentCharacter).toBeNull();
      expect(state.error).toBe('Character not found.');
    });

    it('handles non-Error rejection objects', async () => {
      mockGet.mockRejectedValueOnce('unknown error');

      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      expect(useCharacterStore.getState().error).toBe('Failed to fetch character.');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchCampaignCharacters
  // ---------------------------------------------------------------------------

  describe('fetchCampaignCharacters', () => {
    it('stores character list on success', async () => {
      mockGet.mockResolvedValueOnce([mockCharacter, mockCharacter2]);

      await useCharacterStore.getState().fetchCampaignCharacters('camp-1');

      const state = useCharacterStore.getState();
      expect(state.loading).toBe(false);
      expect(state.campaignCharacters).toHaveLength(2);
      expect(state.campaignCharacters[0]?.name).toBe('Test Hero');
      expect(state.campaignCharacters[1]?.name).toBe('Test Mage');
      expect(state.error).toBeNull();
    });

    it('calls the correct API endpoint', async () => {
      mockGet.mockResolvedValueOnce([]);

      await useCharacterStore.getState().fetchCampaignCharacters('camp-1');

      expect(mockGet).toHaveBeenCalledWith('/api/campaigns/camp-1/characters');
    });

    it('sets error on failed fetch', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      await useCharacterStore.getState().fetchCampaignCharacters('camp-1');

      const state = useCharacterStore.getState();
      expect(state.loading).toBe(false);
      expect(state.campaignCharacters).toEqual([]);
      expect(state.error).toBe('Network error');
    });

    it('handles empty campaign (no characters)', async () => {
      mockGet.mockResolvedValueOnce([]);

      await useCharacterStore.getState().fetchCampaignCharacters('camp-1');

      expect(useCharacterStore.getState().campaignCharacters).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // clearCharacters
  // ---------------------------------------------------------------------------

  describe('clearCharacters', () => {
    it('resets all character state to initial values', async () => {
      // Set up some state first
      mockGet.mockResolvedValueOnce(mockCharacter);
      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      useCharacterStore.getState().setSaveState('saved');

      useCharacterStore.getState().clearCharacters();

      const state = useCharacterStore.getState();
      expect(state.currentCharacter).toBeNull();
      expect(state.campaignCharacters).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.saveState).toBe('idle');
      expect(state.isDirty).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // updateCharacter (optimistic update + rollback)
  // ---------------------------------------------------------------------------

  describe('updateCharacter', () => {
    const updatedSheet: SheetData = {
      ...DEFAULT_SHEET_DATA,
      stats: { ...DEFAULT_SHEET_DATA.stats, cognition: 5 },
      adversityTokens: 3,
    };

    it('performs optimistic update and confirms on success', async () => {
      // Seed currentCharacter into the store
      mockGet.mockResolvedValueOnce(mockCharacter);
      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      const serverResponse: Character = {
        ...mockCharacter,
        sheetData: updatedSheet,
      };
      mockPut.mockResolvedValueOnce(serverResponse);

      await useCharacterStore.getState().updateCharacter('camp-1', 'char-1', updatedSheet);

      const state = useCharacterStore.getState();
      expect(state.currentCharacter?.sheetData.stats.cognition).toBe(5);
      expect(state.currentCharacter?.sheetData.adversityTokens).toBe(3);
      expect(state.saveState).toBe('saved');
      expect(state.error).toBeNull();
      expect(state.isDirty).toBe(false);
    });

    it('calls the correct API endpoint with sheetData payload', async () => {
      mockGet.mockResolvedValueOnce(mockCharacter);
      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      mockPut.mockResolvedValueOnce({ ...mockCharacter, sheetData: updatedSheet });

      await useCharacterStore.getState().updateCharacter('camp-1', 'char-1', updatedSheet);

      expect(mockPut).toHaveBeenCalledWith('/api/campaigns/camp-1/characters/char-1', {
        sheetData: updatedSheet,
      });
    });

    it('rolls back to previous character on API error', async () => {
      mockGet.mockResolvedValueOnce(mockCharacter);
      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      mockPut.mockRejectedValueOnce(new Error('Save failed'));

      await useCharacterStore.getState().updateCharacter('camp-1', 'char-1', updatedSheet);

      const state = useCharacterStore.getState();
      // Should be rolled back to original
      expect(state.currentCharacter?.sheetData.stats.cognition).toBe(3);
      expect(state.currentCharacter?.sheetData.adversityTokens).toBe(0);
      expect(state.saveState).toBe('error');
      expect(state.error).toBe('Save failed');
    });

    it('does not optimistically update if currentCharacter id does not match', async () => {
      // currentCharacter is null initially
      mockPut.mockResolvedValueOnce({ ...mockCharacter2, sheetData: updatedSheet });

      await useCharacterStore.getState().updateCharacter('camp-1', 'char-2', updatedSheet);

      // No optimistic update should have occurred since currentCharacter was null
      expect(mockPut).toHaveBeenCalled();
      expect(useCharacterStore.getState().currentCharacter).not.toBeNull();
      expect(useCharacterStore.getState().saveState).toBe('saved');
    });

    it('sets saveState to saving during the request', async () => {
      mockGet.mockResolvedValueOnce(mockCharacter);
      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      let capturedSaveState: string | undefined;
      mockPut.mockImplementationOnce(() => {
        capturedSaveState = useCharacterStore.getState().saveState;
        return Promise.resolve({ ...mockCharacter, sheetData: updatedSheet });
      });

      await useCharacterStore.getState().updateCharacter('camp-1', 'char-1', updatedSheet);

      expect(capturedSaveState).toBe('saving');
    });

    it('handles non-Error rejection in updateCharacter', async () => {
      mockGet.mockResolvedValueOnce(mockCharacter);
      await useCharacterStore.getState().fetchCharacter('camp-1', 'char-1');

      mockPut.mockRejectedValueOnce('connection lost');

      await useCharacterStore.getState().updateCharacter('camp-1', 'char-1', updatedSheet);

      expect(useCharacterStore.getState().error).toBe('Failed to save character.');
      expect(useCharacterStore.getState().saveState).toBe('error');
    });
  });

  // ---------------------------------------------------------------------------
  // setSaveState
  // ---------------------------------------------------------------------------

  describe('setSaveState', () => {
    it('updates saveState to the given value', () => {
      useCharacterStore.getState().setSaveState('saving');
      expect(useCharacterStore.getState().saveState).toBe('saving');

      useCharacterStore.getState().setSaveState('saved');
      expect(useCharacterStore.getState().saveState).toBe('saved');

      useCharacterStore.getState().setSaveState('error');
      expect(useCharacterStore.getState().saveState).toBe('error');

      useCharacterStore.getState().setSaveState('idle');
      expect(useCharacterStore.getState().saveState).toBe('idle');
    });
  });

  // ---------------------------------------------------------------------------
  // markDirty / markClean
  // ---------------------------------------------------------------------------

  describe('markDirty / markClean', () => {
    it('markDirty sets isDirty to true', () => {
      expect(useCharacterStore.getState().isDirty).toBe(false);

      useCharacterStore.getState().markDirty();
      expect(useCharacterStore.getState().isDirty).toBe(true);
    });

    it('markClean sets isDirty to false', () => {
      useCharacterStore.getState().markDirty();
      expect(useCharacterStore.getState().isDirty).toBe(true);

      useCharacterStore.getState().markClean();
      expect(useCharacterStore.getState().isDirty).toBe(false);
    });

    it('isDirty is reset by clearCharacters', () => {
      useCharacterStore.getState().markDirty();
      expect(useCharacterStore.getState().isDirty).toBe(true);

      useCharacterStore.getState().clearCharacters();
      expect(useCharacterStore.getState().isDirty).toBe(false);
    });
  });
});
