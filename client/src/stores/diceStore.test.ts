// =============================================================================
// Horizon — Dice Store Tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { useDiceStore } from './diceStore.js';

describe('diceStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useDiceStore.setState({
      rollExpression: '',
      isRolling: false,
      lastResult: null,
      rollHistory: [],
      error: null,
    });
  });

  it('initializes with default state', () => {
    const state = useDiceStore.getState();
    expect(state.rollExpression).toBe('');
    expect(state.isRolling).toBe(false);
    expect(state.lastResult).toBeNull();
    expect(state.rollHistory).toEqual([]);
    expect(state.error).toBeNull();
  });

  it('clearResult resets lastResult and error', () => {
    useDiceStore.setState({
      lastResult: {
        id: 'test',
        pool: { dice: [], adversity: 0, modifier: 0 },
        result: { dice: [], adversityResults: [], modifier: 0, total: 0 },
        roller_user_id: 'u1',
        created_at: '',
      },
      error: 'Something went wrong',
    });
    useDiceStore.getState().clearResult();
    const state = useDiceStore.getState();
    expect(state.lastResult).toBeNull();
    expect(state.error).toBeNull();
  });

  it('recentRolls returns last 20 entries', () => {
    const mockResult = {
      id: 'r',
      pool: { dice: [], adversity: 0, modifier: 0 },
      result: { dice: [], adversityResults: [], modifier: 0, total: 0 },
      roller_user_id: 'u',
      created_at: '',
    };
    const history = Array.from({ length: 25 }, (_, i) => ({ ...mockResult, id: `r${i}` }));
    useDiceStore.setState({ rollHistory: history });
    const recent = useDiceStore.getState().recentRolls();
    expect(recent).toHaveLength(20);
  });
});
