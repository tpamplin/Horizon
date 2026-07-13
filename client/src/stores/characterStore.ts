// =============================================================================
// Horizon — Character Store
// =============================================================================
// Zustand store for character sheet state. Manages fetching and caching of
// character data from the server API.
// =============================================================================

import { create } from 'zustand';
import { api } from '../api/client.js';
import type { Character, SheetData } from 'shared';

/** Save lifecycle states for the edit-mode save indicator. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface CharacterState {
  /** The currently viewed character, or null if none selected. */
  currentCharacter: Character | null;
  /** All characters in the currently active campaign. */
  campaignCharacters: Character[];
  /** Whether a character fetch is in progress. */
  loading: boolean;
  /** Error message from the last failed fetch, or null. */
  error: string | null;
  /** Current save lifecycle state for the save indicator. */
  saveState: SaveState;
  /** Whether the current character has unsaved local edits. */
  isDirty: boolean;

  /** Fetch a single character. Uses campaign-scoped endpoint when campaignId is provided, library endpoint otherwise. */
  fetchCharacter: (campaignId: string | undefined, characterId: string) => Promise<void>;
  /** Fetch all characters for a campaign. */
  fetchCampaignCharacters: (campaignId: string) => Promise<void>;
  /** Clear all character state (e.g. on campaign switch). */
  clearCharacters: () => void;
  /** Update character sheet data via PUT. Optimistic update with rollback. */
  updateCharacter: (
    campaignId: string,
    characterId: string,
    sheetData: SheetData,
    name?: string,
    archetype?: string,
  ) => Promise<void>;
  /** Set the save lifecycle state. */
  setSaveState: (state: SaveState) => void;
  /** Mark the current character as having unsaved changes. */
  markDirty: () => void;
  /** Mark the current character as clean (no unsaved changes). */
  markClean: () => void;
  /** Update portrait URL locally on the current character. */
  setPortrait: (url: string) => void;
  /** Fetch the authenticated user's character library (GET /api/characters). */
  fetchMyCharacters: () => Promise<void>;
  /** Create a new character in the user's library (POST /api/characters). */
  createCharacter: (
    name: string,
    archetype: string,
    sheetData?: Partial<SheetData>,
  ) => Promise<Character>;
  /** Delete a character from the user's library (DELETE /api/characters/:id). */
  deleteCharacter: (characterId: string) => Promise<void>;
  /** Add a character from the library to a campaign roster. */
  addToCampaign: (campaignId: string, characterId: string) => Promise<void>;
  /** Remove a character from a campaign roster (does not delete the character). */
  removeFromCampaign: (campaignId: string, characterId: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  currentCharacter: null,
  campaignCharacters: [],
  loading: false,
  error: null,
  saveState: 'idle',
  isDirty: false,

  fetchCharacter: async (campaignId, characterId) => {
    set({ loading: true, error: null });
    try {
      // Use campaign-scoped endpoint when in a campaign context, library endpoint otherwise
      const url = campaignId
        ? `/api/campaigns/${campaignId}/characters/${characterId}`
        : `/api/characters/${characterId}`;
      const character = await api.get<Character>(url);
      set({ currentCharacter: character, loading: false, isDirty: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch character.',
        loading: false,
      });
    }
  },

  fetchCampaignCharacters: async (campaignId) => {
    set({ loading: true, error: null });
    try {
      const characters = await api.get<Character[]>(`/api/campaigns/${campaignId}/characters`);
      set({ campaignCharacters: characters, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch characters.',
        loading: false,
      });
    }
  },

  clearCharacters: () => {
    set({
      currentCharacter: null,
      campaignCharacters: [],
      error: null,
      loading: false,
      saveState: 'idle',
      isDirty: false,
    });
  },

  updateCharacter: async (_campaignId, characterId, sheetData, name, archetype) => {
    // Snapshot the previous character for rollback
    const previous = get().currentCharacter;
    set({ saveState: 'saving' });

    // Optimistic update
    if (previous && previous.id === characterId) {
      set({
        currentCharacter: {
          ...previous,
          sheetData,
          ...(name !== undefined ? { name } : {}),
          ...(archetype !== undefined ? { archetype } : {}),
        },
      });
    }

    try {
      // Use the library-level PUT endpoint (characters are owned per-user, not per-campaign)
      const body: Record<string, unknown> = { sheetData };
      if (name !== undefined) body.name = name;
      if (archetype !== undefined) body.archetype = archetype;
      const updated = await api.put<Character>(`/api/characters/${characterId}`, body);
      set({ currentCharacter: updated, saveState: 'saved', isDirty: false });
    } catch (err) {
      // Rollback on error — keep dirty flag true so user can retry
      if (previous) {
        set({ currentCharacter: previous });
      }
      set({
        error: err instanceof Error ? err.message : 'Failed to save character.',
        saveState: 'error',
      });
    }
  },

  setSaveState: (saveState) => {
    set({ saveState });
  },

  markDirty: () => {
    set({ isDirty: true });
  },

  markClean: () => {
    set({ isDirty: false });
  },

  setPortrait: (url) => {
    const current = get().currentCharacter;
    if (current) {
      set({ currentCharacter: { ...current, portraitUrl: url || null } });
    }
  },

  fetchMyCharacters: async () => {
    set({ loading: true, error: null });
    try {
      const characters = await api.get<Character[]>('/api/characters');
      set({ campaignCharacters: characters, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch characters.',
        loading: false,
      });
    }
  },

  createCharacter: async (name, archetype, sheetData) => {
    const body: Record<string, unknown> = { name, archetype };
    if (sheetData) body.sheetData = sheetData;
    const character = await api.post<Character>('/api/characters', body);
    set((s) => ({ campaignCharacters: [...s.campaignCharacters, character] }));
    return character;
  },

  deleteCharacter: async (characterId) => {
    await api.delete(`/api/characters/${characterId}`);
    set((s) => ({ campaignCharacters: s.campaignCharacters.filter((c) => c.id !== characterId) }));
  },

  addToCampaign: async (campaignId, characterId) => {
    await api.post(`/api/campaigns/${campaignId}/characters`, { characterId });
  },

  removeFromCampaign: async (campaignId, characterId) => {
    await api.delete(`/api/campaigns/${campaignId}/characters/${characterId}`);
  },
}));
