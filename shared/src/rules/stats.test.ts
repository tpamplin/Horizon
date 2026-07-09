// =============================================================================
// Horizon — Stats Module Unit Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  STATS,
  STAT_KEYS,
  getStatDef,
  validateStatValue,
  DEFAULT_ADVERSITY_TOKENS,
  MIN_ADVERSITY_TOKENS,
  awardAdversityTokens,
  deductAdversityTokens,
  checkSuccess,
} from './stats.js';
import type { DicePool } from './dice.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Create a simple seeded RNG. */
function seededRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const val = sequence[i % sequence.length]!;
    i++;
    return val;
  };
}

// -----------------------------------------------------------------------------
// Stat Definitions
// -----------------------------------------------------------------------------

describe('stat definitions', () => {
  it('has all 6 stats defined', () => {
    expect(STAT_KEYS).toHaveLength(6);
    expect(STAT_KEYS).toEqual([
      'cognition',
      'force',
      'reflex',
      'conflict',
      'influence',
      'stability',
    ]);
  });

  it('each stat has required fields', () => {
    for (const key of STAT_KEYS) {
      const def = STATS[key];
      expect(def.key).toBe(key);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.min).toBe(0);
      expect(def.max).toBe(5);
      expect(def.default).toBe(0);
    }
  });

  it('getStatDef returns correct definition', () => {
    const def = getStatDef('cognition');
    expect(def).toBeDefined();
    expect(def!.name).toBe('Cognition');
  });

  it('getStatDef returns undefined for invalid key', () => {
    expect(getStatDef('luck')).toBeUndefined();
    expect(getStatDef('')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// validateStatValue
// -----------------------------------------------------------------------------

describe('validateStatValue', () => {
  it('accepts values within range', () => {
    expect(validateStatValue('cognition', 3)).toBe(3);
    expect(validateStatValue('force', 0)).toBe(0);
    expect(validateStatValue('reflex', 5)).toBe(5);
  });

  it('clamps negative values to min (0)', () => {
    expect(validateStatValue('cognition', -1)).toBe(0);
    expect(validateStatValue('stability', -5)).toBe(0);
  });

  it('allows values above max (bonuses)', () => {
    expect(validateStatValue('cognition', 7)).toBe(7);
    expect(validateStatValue('conflict', 10)).toBe(10);
  });
});

// -----------------------------------------------------------------------------
// Adversity Tokens
// -----------------------------------------------------------------------------

describe('adversity tokens', () => {
  it('has correct default starting count', () => {
    expect(DEFAULT_ADVERSITY_TOKENS).toBe(6);
  });

  it('has correct minimum', () => {
    expect(MIN_ADVERSITY_TOKENS).toBe(0);
  });

  describe('awardAdversityTokens', () => {
    it('adds tokens to current count', () => {
      expect(awardAdversityTokens(3, 2)).toBe(5);
    });

    it('works from zero', () => {
      expect(awardAdversityTokens(0, 4)).toBe(4);
    });

    it('throws on negative amount', () => {
      expect(() => awardAdversityTokens(3, -1)).toThrow('negative');
    });
  });

  describe('deductAdversityTokens', () => {
    it('removes tokens from current count', () => {
      expect(deductAdversityTokens(5, 2)).toBe(3);
    });

    it('clamps to min (0)', () => {
      expect(deductAdversityTokens(2, 5)).toBe(0);
    });

    it('stays at 0 when already at min', () => {
      expect(deductAdversityTokens(0, 3)).toBe(0);
    });

    it('throws on negative amount', () => {
      expect(() => deductAdversityTokens(3, -1)).toThrow('negative');
    });
  });
});

// -----------------------------------------------------------------------------
// checkSuccess
// -----------------------------------------------------------------------------

describe('checkSuccess', () => {
  const d6Pool: DicePool = { dice: [{ count: 3, sides: 6 }], adversity: 0, modifier: 0 };

  describe('basic success/failure', () => {
    it('returns success when roll meets target', () => {
      // RNG: 0.5 on d6 = floor(0.5*6)+1 = 4, three times → total 12
      const rng = seededRng([0.5, 0.5, 0.5]);
      const result = checkSuccess(d6Pool, 12, { rng });
      expect(result.success).toBe(true);
      expect(result.rollTotal).toBe(12);
      expect(result.target).toBe(12);
    });

    it('returns success when roll exceeds target', () => {
      const rng = seededRng([0.5, 0.5, 0.5]); // total 12
      const result = checkSuccess(d6Pool, 10, { rng });
      expect(result.success).toBe(true);
    });

    it('returns failure when roll is below target', () => {
      const rng = seededRng([0.5, 0.5, 0.5]); // total 12
      const result = checkSuccess(d6Pool, 15, { rng });
      expect(result.success).toBe(false);
    });
  });

  describe('critical success', () => {
    it('detects critical success (all dice show max)', () => {
      // All dice roll 6: rng = 0.99 → floor(0.99*6)+1 = 6
      const rng = seededRng([0.99, 0.99, 0.99]);
      const result = checkSuccess(d6Pool, 18, { rng });
      expect(result.success).toBe(true);
      expect(result.criticalSuccess).toBe(true);
      expect(result.criticalFailure).toBe(false);
    });

    it('does not flag critical success on partial max roll', () => {
      // 6, 6, 5
      const rng = seededRng([0.99, 0.99, 0.8]);
      const result = checkSuccess(d6Pool, 17, { rng });
      expect(result.success).toBe(true);
      expect(result.criticalSuccess).toBe(false);
    });
  });

  describe('critical failure', () => {
    it('detects critical failure (all dice show 1)', () => {
      // All dice roll 1: rng = 0.0 → floor(0.0*6)+1 = 1
      const rng = seededRng([0.0, 0.0, 0.0]);
      const result = checkSuccess(d6Pool, 10, { rng });
      expect(result.success).toBe(false);
      expect(result.criticalFailure).toBe(true);
      expect(result.criticalSuccess).toBe(false);
    });
  });

  describe('advantage', () => {
    it('takes the higher of two rolls', () => {
      // First roll: 1,1,1 = 3. Second roll: 6,6,6 = 18
      const rng = seededRng([0.0, 0.0, 0.0, 0.99, 0.99, 0.99]);
      const result = checkSuccess(d6Pool, 10, { rng, advantage: true });
      expect(result.success).toBe(true);
      expect(result.rollTotal).toBe(18);
      expect(result.discardedRoll).toBeDefined();
      expect(result.discardedRoll!.total).toBe(3);
    });
  });

  describe('disadvantage', () => {
    it('takes the lower of two rolls', () => {
      // First roll: 6,6,6 = 18. Second roll: 1,1,1 = 3
      const rng = seededRng([0.99, 0.99, 0.99, 0.0, 0.0, 0.0]);
      const result = checkSuccess(d6Pool, 10, { rng, disadvantage: true });
      expect(result.success).toBe(false);
      expect(result.rollTotal).toBe(3);
      expect(result.discardedRoll).toBeDefined();
      expect(result.discardedRoll!.total).toBe(18);
    });
  });

  describe('advantage takes precedence over disadvantage', () => {
    it('uses advantage when both are set', () => {
      // Advantage takes the higher, not the lower
      const rng = seededRng([0.0, 0.0, 0.0, 0.99, 0.99, 0.99]);
      const result = checkSuccess(d6Pool, 10, { rng, advantage: true, disadvantage: true });
      expect(result.rollTotal).toBe(18); // higher, not lower
    });
  });

  describe('pure function', () => {
    it('does not mutate input pool', () => {
      const pool: DicePool = { dice: [{ count: 2, sides: 6 }], adversity: 1, modifier: -1 };
      const frozen = JSON.parse(JSON.stringify(pool)) as DicePool;
      checkSuccess(pool, 10);
      expect(pool).toEqual(frozen);
    });
  });
});
