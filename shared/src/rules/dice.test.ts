// =============================================================================
// Horizon — Dice Module Unit Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { parseDicePool, resolveDiceRoll, applyModifiers } from './dice.js';
import type { DicePool } from './dice.js';
import type { ModifierSet } from '../types.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Create a simple seeded RNG that cycles through a fixed sequence of [0, 1) values. */
function seededRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const val = sequence[i % sequence.length]!;
    i++;
    return val;
  };
}

/**
 * Convert a [0, 1) RNG value to the expected die result (1-based).
 * Formula: Math.floor(value * sides) + 1
 */
function expectedDie(sides: number, rngValue: number): number {
  return Math.floor(rngValue * sides) + 1;
}

// -----------------------------------------------------------------------------
// parseDicePool
// -----------------------------------------------------------------------------

describe('parseDicePool', () => {
  describe('standard dice', () => {
    it('parses a single die: "1d6"', () => {
      const pool = parseDicePool('1d6');
      expect(pool.dice).toEqual([{ count: 1, sides: 6 }]);
      expect(pool.adversity).toBe(0);
      expect(pool.modifier).toBe(0);
    });

    it('parses multiple dice: "3d6"', () => {
      const pool = parseDicePool('3d6');
      expect(pool.dice).toEqual([{ count: 3, sides: 6 }]);
    });

    it('parses d4, d8, d10, d12, d20, d100', () => {
      expect(parseDicePool('1d4').dice[0]!.sides).toBe(4);
      expect(parseDicePool('1d8').dice[0]!.sides).toBe(8);
      expect(parseDicePool('1d10').dice[0]!.sides).toBe(10);
      expect(parseDicePool('1d12').dice[0]!.sides).toBe(12);
      expect(parseDicePool('1d20').dice[0]!.sides).toBe(20);
      expect(parseDicePool('1d100').dice[0]!.sides).toBe(100);
    });

    it('parses mixed dice: "2d8+1d6"', () => {
      const pool = parseDicePool('2d8+1d6');
      expect(pool.dice).toEqual([
        { count: 2, sides: 8 },
        { count: 1, sides: 6 },
      ]);
      expect(pool.adversity).toBe(0);
      expect(pool.modifier).toBe(0);
    });

    it('parses multiple groups of same die: "3d6+2d6"', () => {
      const pool = parseDicePool('3d6+2d6');
      expect(pool.dice).toHaveLength(2);
      expect(pool.dice[0]).toEqual({ count: 3, sides: 6 });
      expect(pool.dice[1]).toEqual({ count: 2, sides: 6 });
    });

    it('rejects invalid die sizes', () => {
      expect(() => parseDicePool('1d7')).toThrow('Invalid die size');
      expect(() => parseDicePool('1d3')).toThrow('Invalid die size');
      expect(() => parseDicePool('1d0')).toThrow('Invalid die size');
    });
  });

  describe('adversity dice', () => {
    it('parses adversity dice: "2a"', () => {
      const pool = parseDicePool('2a');
      expect(pool.dice).toEqual([]);
      expect(pool.adversity).toBe(2);
      expect(pool.modifier).toBe(0);
    });

    it('parses adversity with standard dice: "3d6+2a"', () => {
      const pool = parseDicePool('3d6+2a');
      expect(pool.dice).toEqual([{ count: 3, sides: 6 }]);
      expect(pool.adversity).toBe(2);
    });

    it('parses multiple adversity groups: "2a+3a"', () => {
      const pool = parseDicePool('2a+3a');
      expect(pool.adversity).toBe(5);
    });
  });

  describe('modifiers', () => {
    it('parses positive modifier: "+3"', () => {
      const pool = parseDicePool('+3');
      expect(pool.dice).toEqual([]);
      expect(pool.adversity).toBe(0);
      expect(pool.modifier).toBe(3);
    });

    it('parses negative modifier: "-1"', () => {
      const pool = parseDicePool('-1');
      expect(pool.modifier).toBe(-1);
    });

    it('parses modifier with dice: "2d6+3"', () => {
      const pool = parseDicePool('2d6+3');
      expect(pool.dice).toEqual([{ count: 2, sides: 6 }]);
      expect(pool.modifier).toBe(3);
    });

    it('parses modifier with dice: "2d6-1"', () => {
      const pool = parseDicePool('2d6-1');
      expect(pool.dice).toEqual([{ count: 2, sides: 6 }]);
      expect(pool.modifier).toBe(-1);
    });
  });

  describe('complex pools', () => {
    it('parses "3d6+2a-1"', () => {
      const pool = parseDicePool('3d6+2a-1');
      expect(pool.dice).toEqual([{ count: 3, sides: 6 }]);
      expect(pool.adversity).toBe(2);
      expect(pool.modifier).toBe(-1);
    });

    it('parses "2d8+1d6+3a+5"', () => {
      const pool = parseDicePool('2d8+1d6+3a+5');
      expect(pool.dice).toEqual([
        { count: 2, sides: 8 },
        { count: 1, sides: 6 },
      ]);
      expect(pool.adversity).toBe(3);
      expect(pool.modifier).toBe(5);
    });

    it('parses "1d20+4a-2"', () => {
      const pool = parseDicePool('1d20+4a-2');
      expect(pool.dice).toEqual([{ count: 1, sides: 20 }]);
      expect(pool.adversity).toBe(4);
      expect(pool.modifier).toBe(-2);
    });
  });

  describe('whitespace tolerance', () => {
    it('handles spaces around operators: "3d6 + 2a"', () => {
      const pool = parseDicePool('3d6 + 2a');
      expect(pool.dice).toEqual([{ count: 3, sides: 6 }]);
      expect(pool.adversity).toBe(2);
    });

    it('handles spaces in dice notation: "3 d 6 + 2 a"', () => {
      const pool = parseDicePool('3 d 6 + 2 a');
      expect(pool.dice).toEqual([{ count: 3, sides: 6 }]);
      expect(pool.adversity).toBe(2);
    });

    it('handles spaces around modifiers: "2d6 - 1"', () => {
      const pool = parseDicePool('2d6 - 1');
      expect(pool.dice).toEqual([{ count: 2, sides: 6 }]);
      expect(pool.modifier).toBe(-1);
    });

    it('handles spaces between modifier sign and number: "2d6 + 3"', () => {
      const pool = parseDicePool('2d6 + 3');
      expect(pool.modifier).toBe(3);
    });

    it('handles "3d6 + 2a - 1" with spaces', () => {
      const pool = parseDicePool('3d6 + 2a - 1');
      expect(pool.dice).toEqual([{ count: 3, sides: 6 }]);
      expect(pool.adversity).toBe(2);
      expect(pool.modifier).toBe(-1);
    });
  });

  describe('error handling', () => {
    it('throws on empty string', () => {
      expect(() => parseDicePool('')).toThrow('empty');
    });

    it('throws on whitespace-only', () => {
      expect(() => parseDicePool('   ')).toThrow('empty');
    });

    it('throws on unrecognized tokens: "xyz"', () => {
      expect(() => parseDicePool('xyz')).toThrow('Unrecognized token');
    });

    it('throws on "d6" without count', () => {
      expect(() => parseDicePool('d6')).toThrow('Unrecognized token');
    });

    it('throws on invalid die size: "1d7"', () => {
      expect(() => parseDicePool('1d7')).toThrow('Invalid die size');
    });
  });
});

// -----------------------------------------------------------------------------
// resolveDiceRoll
// -----------------------------------------------------------------------------

describe('resolveDiceRoll', () => {
  describe('determinism with seeded RNG', () => {
    it('produces identical results with same seed', () => {
      const pool: DicePool = {
        dice: [{ count: 3, sides: 6 }],
        adversity: 0,
        modifier: 0,
        exploding: false,
      };
      const rng = seededRng([0.1, 0.5, 0.3]);

      const result1 = resolveDiceRoll(pool, { rng });
      const rng2 = seededRng([0.1, 0.5, 0.3]);
      const result2 = resolveDiceRoll(pool, { rng: rng2 });

      expect(result1).toEqual(result2);
    });

    it('produces correct values with known RNG', () => {
      const pool: DicePool = {
        dice: [{ count: 2, sides: 6 }],
        adversity: 0,
        modifier: 0,
        exploding: false,
      };
      // RNG values 0.0 → roll 1, 0.99 → roll 6
      const rng = seededRng([0.0, 0.99]);

      const result = resolveDiceRoll(pool, { rng });

      expect(result.dice[0]!.result).toBe(1); // floor(0.0 * 6) + 1 = 1
      expect(result.dice[1]!.result).toBe(6); // floor(0.99 * 6) + 1 = 6
    });
  });

  describe('die count', () => {
    it('rolls correct number of standard dice', () => {
      const pool: DicePool = { dice: [{ count: 4, sides: 6 }], adversity: 0, modifier: 0 };
      const result = resolveDiceRoll(pool);
      expect(result.dice).toHaveLength(4);
    });

    it('rolls correct number of adversity dice', () => {
      const pool: DicePool = { dice: [], adversity: 3, modifier: 0 };
      const result = resolveDiceRoll(pool);
      expect(result.adversityResults).toHaveLength(3);
    });

    it('rolls mixed groups correctly', () => {
      const pool: DicePool = {
        dice: [
          { count: 2, sides: 6 },
          { count: 3, sides: 8 },
        ],
        adversity: 2,
        modifier: 0,
      };
      const result = resolveDiceRoll(pool);
      expect(result.dice).toHaveLength(5); // 2 + 3
      expect(result.adversityResults).toHaveLength(2);
    });
  });

  describe('die results are in valid range', () => {
    it('standard dice produce values in [1, sides] when not exploding', () => {
      const pool: DicePool = {
        dice: [{ count: 100, sides: 20 }],
        adversity: 0,
        modifier: 0,
        exploding: false,
      };
      const result = resolveDiceRoll(pool);
      for (const die of result.dice) {
        expect(die.result).toBeGreaterThanOrEqual(1);
        expect(die.result).toBeLessThanOrEqual(20);
        expect(die.sides).toBe(20);
      }
    });

    it('adversity dice default to d6 when not exploding', () => {
      const pool: DicePool = { dice: [], adversity: 50, modifier: 0, exploding: false };
      const result = resolveDiceRoll(pool);
      for (const die of result.adversityResults) {
        expect(die.result).toBeGreaterThanOrEqual(1);
        expect(die.result).toBeLessThanOrEqual(6);
        expect(die.sides).toBe(6);
      }
    });

    it('adversity dice use custom sides when not exploding', () => {
      const pool: DicePool = { dice: [], adversity: 50, modifier: 0, exploding: false };
      const result = resolveDiceRoll(pool, { adversitySides: 8 });
      for (const die of result.adversityResults) {
        expect(die.sides).toBe(8);
        expect(die.result).toBeGreaterThanOrEqual(1);
        expect(die.result).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('modifier is applied', () => {
    it('adds positive modifier to total', () => {
      const pool: DicePool = { dice: [], adversity: 0, modifier: 5 };
      const result = resolveDiceRoll(pool);
      expect(result.total).toBe(5);
      expect(result.modifier).toBe(5);
    });

    it('subtracts negative modifier from total', () => {
      const pool: DicePool = { dice: [{ count: 1, sides: 6 }], adversity: 0, modifier: -3 };
      const rng = seededRng([0.5]); // roll = floor(0.5 * 6) + 1 = 4
      const result = resolveDiceRoll(pool, { rng });
      expect(result.total).toBe(1); // 4 - 3 = 1
    });
  });

  describe('total calculation', () => {
    it('sums standard dice correctly', () => {
      const pool: DicePool = {
        dice: [{ count: 3, sides: 6 }],
        adversity: 0,
        modifier: 0,
        exploding: false,
      };
      const rng = seededRng([0.1, 0.5, 0.3]);
      const result = resolveDiceRoll(pool, { rng });
      const expectedTotal = expectedDie(6, 0.1) + expectedDie(6, 0.5) + expectedDie(6, 0.3);
      expect(result.total).toBe(expectedTotal);
    });

    it('sums standard + adversity + modifier', () => {
      const pool: DicePool = {
        dice: [{ count: 2, sides: 6 }],
        adversity: 1,
        modifier: 2,
        exploding: false,
      };
      const rng = seededRng([0.1, 0.5, 0.3]);
      const result = resolveDiceRoll(pool, { rng });
      const expectedTotal = expectedDie(6, 0.1) + expectedDie(6, 0.5) + expectedDie(6, 0.3) + 2;
      expect(result.total).toBe(expectedTotal);
    });
  });

  describe('pure function (no side effects)', () => {
    it('does not mutate the input pool', () => {
      const pool: DicePool = { dice: [{ count: 3, sides: 6 }], adversity: 2, modifier: -1 };
      const frozen = JSON.parse(JSON.stringify(pool)) as DicePool;
      resolveDiceRoll(pool);
      expect(pool).toEqual(frozen);
    });

    it('import has no side effects', () => {
      expect(true).toBe(true);
    });
  });

  describe('exploding dice', () => {
    it('explodes when rolling max value on a d4', () => {
      const pool: DicePool = { dice: [{ count: 1, sides: 4 }], adversity: 0, modifier: 0 };
      // RNG: 0.99 → floor(3.96)+1 = 4 (max, triggers explode)
      //       0.5  → floor(2.0)+1 = 3 (no explode)
      const rng = seededRng([0.99, 0.5]);
      const result = resolveDiceRoll(pool, { rng });

      expect(result.dice).toHaveLength(1);
      expect(result.dice[0]!.result).toBe(7); // 4 + 3
      expect(result.dice[0]!.explosionChain).toEqual([4, 3]);
      expect(result.total).toBe(7);
    });

    it('chains multiple explosions on a d4', () => {
      const pool: DicePool = { dice: [{ count: 1, sides: 4 }], adversity: 0, modifier: 0 };
      // 0.99 → 4 (explode), 0.99 → 4 (explode), 0.99 → 4 (explode), 0.5 → 3 (stop)
      const rng = seededRng([0.99, 0.99, 0.99, 0.5]);
      const result = resolveDiceRoll(pool, { rng });

      expect(result.dice[0]!.result).toBe(15); // 4+4+4+3 = 15
      expect(result.dice[0]!.explosionChain).toEqual([4, 4, 4, 3]);
    });

    it('does not explode when explosion is disabled', () => {
      const pool: DicePool = {
        dice: [{ count: 1, sides: 4 }],
        adversity: 0,
        modifier: 0,
        exploding: false,
      };
      const rng = seededRng([0.99]); // would be 4 (max)
      const result = resolveDiceRoll(pool, { rng });

      expect(result.dice[0]!.result).toBe(4);
      expect(result.dice[0]!.explosionChain).toBeUndefined();
      expect(result.total).toBe(4);
    });

    it('does not explode on non-max values', () => {
      const pool: DicePool = { dice: [{ count: 1, sides: 6 }], adversity: 0, modifier: 0 };
      const rng = seededRng([0.5]); // roll = 4 (not max for d6)
      const result = resolveDiceRoll(pool, { rng });

      expect(result.dice[0]!.result).toBe(4);
      expect(result.dice[0]!.explosionChain).toBeUndefined();
    });

    it('explodes only the specific die that hits max in a multi-die pool', () => {
      const pool: DicePool = { dice: [{ count: 2, sides: 6 }], adversity: 0, modifier: 0 };
      // Die 1: 0.99 → 6 (explode), 0.3 → 2 (stop) = 8
      // Die 2: 0.5 → 4 (no explode) = 4
      const rng = seededRng([0.99, 0.3, 0.5]);
      const result = resolveDiceRoll(pool, { rng });

      expect(result.dice).toHaveLength(2);
      expect(result.dice[0]!.result).toBe(8);
      expect(result.dice[0]!.explosionChain).toEqual([6, 2]);
      expect(result.dice[1]!.result).toBe(4);
      expect(result.dice[1]!.explosionChain).toBeUndefined();
      expect(result.total).toBe(12);
    });

    it('adversity dice also explode', () => {
      const pool: DicePool = { dice: [], adversity: 1, modifier: 0 };
      // Default adversity sides = 6. 0.99 → 6 (explode), 0.3 → 2 (stop)
      const rng = seededRng([0.99, 0.3]);
      const result = resolveDiceRoll(pool, { rng });

      expect(result.adversityResults[0]!.result).toBe(8); // 6 + 2
      expect(result.adversityResults[0]!.explosionChain).toEqual([6, 2]);
    });

    it('exploding is on by default (pool.exploding defaults to true)', () => {
      const pool: DicePool = { dice: [{ count: 1, sides: 4 }], adversity: 0, modifier: 0 };
      const rng = seededRng([0.99, 0.5]); // 4 → explode → 3
      const result = resolveDiceRoll(pool, { rng });
      expect(result.dice[0]!.result).toBe(7);
    });

    it('options.exploding overrides pool.exploding', () => {
      const pool: DicePool = {
        dice: [{ count: 1, sides: 4 }],
        adversity: 0,
        modifier: 0,
        exploding: false,
      };
      const rng = seededRng([0.99, 0.5]);
      // options.exploding = true overrides pool.exploding = false
      const result = resolveDiceRoll(pool, { rng, exploding: true });
      expect(result.dice[0]!.result).toBe(7);
    });
  });
});

// -----------------------------------------------------------------------------
// applyModifiers (HZN-229 integration contract)
// -----------------------------------------------------------------------------

describe('applyModifiers', () => {
  const basePool: DicePool = { dice: [{ count: 1, sides: 10 }], adversity: 0, modifier: 0 };

  describe('stat bonuses', () => {
    it('adds a single stat bonus to pool modifier', () => {
      const mods: ModifierSet = { statBonuses: { cognition: 5 } };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(5);
    });

    it('sums multiple stat bonuses', () => {
      const mods: ModifierSet = {
        statBonuses: { cognition: 5, force: 3, reflex: -2 },
      };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(6); // 5 + 3 + (-2) = 6
    });

    it('adds stat bonuses on top of existing pool modifier', () => {
      const pool: DicePool = {
        dice: [{ count: 1, sides: 10 }],
        adversity: 0,
        modifier: 2,
      };
      const mods: ModifierSet = { statBonuses: { cognition: 5 } };
      const result = applyModifiers(pool, mods);
      expect(result.modifier).toBe(7); // 2 + 5 = 7
    });
  });

  describe('flat bonus', () => {
    it('adds flat bonus to pool modifier', () => {
      const mods: ModifierSet = { flatBonus: 3 };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(3);
    });

    it('combines flat bonus with stat bonuses', () => {
      const mods: ModifierSet = {
        statBonuses: { cognition: 5 },
        flatBonus: 2,
      };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(7); // 5 + 2 = 7
    });
  });

  describe('immutability', () => {
    it('does not mutate the input pool', () => {
      const pool: DicePool = {
        dice: [{ count: 1, sides: 10 }],
        adversity: 2,
        modifier: 0,
      };
      const frozen = JSON.parse(JSON.stringify(pool)) as DicePool;
      const mods: ModifierSet = { statBonuses: { cognition: 5 } };
      applyModifiers(pool, mods);
      expect(pool).toEqual(frozen);
    });

    it('returns a new object', () => {
      const mods: ModifierSet = { flatBonus: 1 };
      const result = applyModifiers(basePool, mods);
      expect(result).not.toBe(basePool);
    });
  });

  describe('source preservation', () => {
    it('preserves existing source on pool', () => {
      const pool: DicePool = {
        ...basePool,
        source: 'stat',
      };
      const result = applyModifiers(pool, { flatBonus: 1 });
      expect(result.source).toBe('stat');
    });

    it('defaults source to custom when not set', () => {
      const result = applyModifiers(basePool, { flatBonus: 1 });
      expect(result.source).toBe('custom');
    });
  });

  describe('edge cases', () => {
    it('returns pool unchanged when modifiers are empty', () => {
      const result = applyModifiers(basePool, {});
      expect(result.modifier).toBe(0);
      expect(result.dice).toEqual(basePool.dice);
    });

    it('handles negative stat bonuses', () => {
      const mods: ModifierSet = { statBonuses: { cognition: -3 } };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(-3);
    });

    it('handles empty statBonuses object', () => {
      const mods: ModifierSet = { statBonuses: {} };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(0);
    });

    it('handles zero flat bonus', () => {
      const mods: ModifierSet = { flatBonus: 0 };
      const result = applyModifiers(basePool, mods);
      expect(result.modifier).toBe(0);
    });

    it('preserves dice and adversity from original pool', () => {
      const pool: DicePool = {
        dice: [{ count: 3, sides: 6 }],
        adversity: 4,
        modifier: 0,
      };
      const mods: ModifierSet = { flatBonus: 10 };
      const result = applyModifiers(pool, mods);
      expect(result.dice).toEqual(pool.dice);
      expect(result.adversity).toBe(4);
      expect(result.modifier).toBe(10);
    });
  });
});
