// =============================================================================
// Horizon — Dice Store
// =============================================================================
// Zustand store for dice rolling state. Shared by DiceTray, DiceAnimation,
// StatRollButton, WeaponRollButton, and DiceLogPanel.
// =============================================================================

import { create } from 'zustand';
import { api } from '../api/client.js';
import { useCharacterStore } from './characterStore.js';
import { parseDicePool } from 'shared';
import type {
  DiceRollRequest,
  DiceRollResponse,
  DiceLogEntry,
  DiceBoostRequest,
  RollSource,
} from 'shared';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DiceState {
  /** Current expression in the dice tray input. */
  rollExpression: string;
  /** Whether a roll is in progress (controls button disabled state + animation). */
  isRolling: boolean;
  /** The most recent roll result, or null if no roll has been made. */
  lastResult: DiceRollResponse | null;
  /** Accumulated roll history (for log display). Newest first. */
  rollHistory: DiceRollResponse[];
  /** Error message from the last failed roll, or null. */
  error: string | null;

  /** Execute a dice roll via the server API. */
  rollDice: (
    expression: string,
    reason?: string,
    characterId?: string,
    modifiers?: DiceRollRequest['modifiers'],
    source?: RollSource,
  ) => Promise<void>;
  /** Clear the most recent result (hides animation/result display). */
  clearResult: () => void;
  /** Fetch roll history for a campaign from the server. */
  fetchHistory: (campaignId: string) => Promise<void>;
  /** Last 20 rolls for quick display. */
  recentRolls: () => DiceRollResponse[];
  /** Spend a token to boost the last roll in a die's explosion chain by +1. */
  boostLastRoll: (dieIndex: number) => Promise<void>;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useDiceStore = create<DiceState>((set, get) => ({
  rollExpression: '',
  isRolling: false,
  lastResult: null,
  rollHistory: [],
  error: null,

  rollDice: async (expression, reason, characterId, modifiers, source) => {
    set({ isRolling: true, error: null, rollExpression: expression });

    try {
      // Parse the expression into a structured dice pool on the client.
      // The server is still authoritative for the RNG.
      const pool = parseDicePool(expression);

      // Set the roll source so DiceLogPanel can render the correct badge
      if (source) {
        pool.source = source;
      }

      const result = await api.post<DiceRollResponse>('/api/dice/roll', {
        pool,
        reason,
        character_id: characterId,
        modifiers,
      } as DiceRollRequest);

      // Wait for animation duration before showing result
      // (animation controlled by DiceAnimation component via CSS)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      set((state) => ({
        isRolling: false,
        lastResult: result,
        rollHistory: [result, ...state.rollHistory].slice(0, 100), // keep last 100
      }));
    } catch (err) {
      set({
        isRolling: false,
        error: err instanceof Error ? err.message : 'Failed to roll dice.',
      });
    }
  },

  clearResult: () => {
    set({ lastResult: null, error: null });
  },

  fetchHistory: async (campaignId: string) => {
    try {
      const data = await api.get<{ entries: DiceLogEntry[]; total: number }>(
        `/api/campaigns/${campaignId}/dice-log?limit=50`,
      );
      // Convert log entries to DiceRollResponse shape for unified state
      const responses: DiceRollResponse[] = data.entries.map((entry) => ({
        id: entry.id,
        pool: JSON.parse(entry.pool_json),
        modifiers: entry.modifiers_json ? JSON.parse(entry.modifiers_json) : undefined,
        result: JSON.parse(entry.result_json),
        reason: entry.reason ?? undefined,
        character_id: entry.character_id ?? undefined,
        roller_user_id: entry.roller_user_id,
        created_at: entry.created_at,
      }));
      set({ rollHistory: responses });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch roll history.',
      });
    }
  },

  recentRolls: () => {
    return get().rollHistory.slice(0, 20);
  },

  boostLastRoll: async (dieIndex: number) => {
    const { lastResult } = get();
    if (!lastResult) return;

    // Count chain length before boost
    const die = lastResult.result.dice[dieIndex];
    const oldChainLen = die?.explosionChain?.length ?? 1;

    try {
      const data = await api.post<{ result: DiceRollResponse['result'] }>('/api/dice/boost', {
        pool: lastResult.pool,
        currentResult: lastResult.result,
        dieIndex,
        character_id: lastResult.character_id,
      } as DiceBoostRequest);

      const updated: DiceRollResponse = {
        ...lastResult,
        result: data.result,
      };

      // Only replay animation if the boost created new explosions (chain grew)
      const newDie = data.result.dice[dieIndex];
      const newChainLen = newDie?.explosionChain?.length ?? 1;

      if (newChainLen > oldChainLen) {
        // New explosion — trigger full animation replay
        set({ isRolling: true });
        await new Promise((resolve) => setTimeout(resolve, 100));
        set((state) => ({
          isRolling: false,
          lastResult: updated,
          rollHistory: [updated, ...state.rollHistory.slice(1)],
        }));
      } else {
        // Simple value boost — update quietly, no animation
        set((state) => ({
          lastResult: updated,
          rollHistory: [updated, ...state.rollHistory.slice(1)],
        }));
      }

      // Deduct one adversity token from the current character
      const charState = useCharacterStore.getState();
      if (charState.currentCharacter) {
        const tokens = charState.currentCharacter.sheetData.adversityTokens;
        if (tokens > 0) {
          useCharacterStore.setState({
            currentCharacter: {
              ...charState.currentCharacter,
              sheetData: {
                ...charState.currentCharacter.sheetData,
                adversityTokens: tokens - 1,
              },
            },
          });
        }
      }
    } catch (err) {
      set({
        isRolling: false,
        error: err instanceof Error ? err.message : 'Failed to boost die.',
      });
    }
  },
}));
