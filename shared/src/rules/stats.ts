// =============================================================================
// Horizon — Stat Definitions & Success/Fail Rules
// =============================================================================
// Pure functions for stat validation, adversity token management, and
// success/failure resolution. Importable by both client and server.
//
// See plan/vtt-design-doc.md §4.2–4.3 for the stat system design.
// =============================================================================

import { resolveDiceRoll } from './dice.js';
import type { DicePool, RollResult } from './dice.js';

// -----------------------------------------------------------------------------
// Stat Definitions
// -----------------------------------------------------------------------------

/**
 * The six core stat keys in the Horizon system.
 */
export type StatKey = 'cognition' | 'force' | 'reflex' | 'conflict' | 'influence' | 'stability';

/**
 * Metadata for a single stat.
 */
export interface StatDefinition {
  /** Machine-readable key. */
  key: StatKey;
  /** Human-readable display name. */
  name: string;
  /** Short description of what the stat governs. */
  description: string;
  /** Minimum valid value (inclusive). */
  min: number;
  /** Maximum base value (inclusive). Values above this are allowed with bonuses. */
  max: number;
  /** Default starting value for a new character. */
  default: number;
}

/**
 * The six core stat definitions for the Horizon system.
 * Each stat has a default range of 0–5, though adversity and other bonuses
 * can push values beyond the base maximum.
 */
export const STATS: Record<StatKey, StatDefinition> = {
  cognition: {
    key: 'cognition',
    name: 'Cognition',
    description: 'Investigation, knowledge, deduction, memory, and analysis.',
    min: 0,
    max: 5,
    default: 0,
  },
  force: {
    key: 'force',
    name: 'Force',
    description: 'Lifting, climbing, breaking, and physical endurance.',
    min: 0,
    max: 5,
    default: 0,
  },
  reflex: {
    key: 'reflex',
    name: 'Reflex',
    description: 'Dodging, escaping, driving, stealth, and initiative.',
    min: 0,
    max: 5,
    default: 0,
  },
  conflict: {
    key: 'conflict',
    name: 'Conflict',
    description: 'Fighting, intimidation, and resisting opposition.',
    min: 0,
    max: 5,
    default: 0,
  },
  influence: {
    key: 'influence',
    name: 'Influence',
    description: 'Persuasion, deception, leadership, and empathy.',
    min: 0,
    max: 5,
    default: 0,
  },
  stability: {
    key: 'stability',
    name: 'Stability',
    description: 'Resisting fear, mental attacks, pain, and exhaustion.',
    min: 0,
    max: 5,
    default: 0,
  },
} as const;

/**
 * Ordered array of all stat keys, for iteration.
 */
export const STAT_KEYS: StatKey[] = Object.keys(STATS) as StatKey[];

/**
 * Look up a stat definition by key. Returns undefined if the key is invalid.
 */
export function getStatDef(key: string): StatDefinition | undefined {
  return STATS[key as StatKey];
}

/**
 * Validate that a stat value falls within the defined range for its stat type.
 * Returns the clamped value if out of range, or the original value if valid.
 *
 * @param key — The stat to validate against.
 * @param value — The proposed value.
 * @returns The clamped value (never below min, but may exceed max for bonuses).
 */
export function validateStatValue(key: StatKey, value: number): number {
  const def = STATS[key];
  // Clamp to minimum; allow values above max (bonuses can push stats up)
  return Math.max(def.min, value);
}

// -----------------------------------------------------------------------------
// Adversity Tokens
// -----------------------------------------------------------------------------

/** Default starting adversity tokens for a new character. */
export const DEFAULT_ADVERSITY_TOKENS = 6;

/** Minimum adversity tokens a character can hold. */
export const MIN_ADVERSITY_TOKENS = 0;

/**
 * Award adversity tokens to a character.
 * Returns the new total, clamped to a minimum of {@link MIN_ADVERSITY_TOKENS}.
 *
 * @param current — Current adversity token count.
 * @param amount — Number of tokens to award (must be non-negative).
 * @returns The new token count.
 */
export function awardAdversityTokens(current: number, amount: number): number {
  if (amount < 0) {
    throw new Error(`Cannot award a negative amount (${amount}). Use deductAdversityTokens to remove tokens.`);
  }
  return current + amount;
}

/**
 * Deduct adversity tokens from a character.
 * Returns the new total, clamped to a minimum of {@link MIN_ADVERSITY_TOKENS}.
 *
 * @param current — Current adversity token count.
 * @param amount — Number of tokens to deduct (must be non-negative).
 * @returns The new token count.
 */
export function deductAdversityTokens(current: number, amount: number): number {
  if (amount < 0) {
    throw new Error(`Cannot deduct a negative amount (${amount}). Use awardAdversityTokens to add tokens.`);
  }
  return Math.max(MIN_ADVERSITY_TOKENS, current - amount);
}

// -----------------------------------------------------------------------------
// Success / Failure Resolution
// -----------------------------------------------------------------------------

/**
 * Result of a success/failure check against a target difficulty.
 */
export interface CheckResult {
  /** Whether the roll total meets or exceeds the target. */
  success: boolean;
  /** The roll total that was compared to the target. */
  rollTotal: number;
  /** The target difficulty. */
  target: number;
  /** Whether this was a critical success (natural max roll on all dice). */
  criticalSuccess: boolean;
  /** Whether this was a critical failure (natural 1 on all dice). */
  criticalFailure: boolean;
  /** The underlying dice roll result (for display/detailed inspection). */
  roll: RollResult;
  /** If advantage or disadvantage was applied, the discarded roll result. */
  discardedRoll?: RollResult;
}

/**
 * Options for a success/failure check.
 */
export interface CheckOptions {
  /**
   * Custom random number generator for deterministic testing.
   * Defaults to `Math.random`.
   */
  rng?: () => number;
  /**
   * Roll with advantage — roll twice and take the higher total.
   * Mutually exclusive with `disadvantage`; advantage takes precedence.
   */
  advantage?: boolean;
  /**
   * Roll with disadvantage — roll twice and take the lower total.
   * Ignored if `advantage` is also true.
   */
  disadvantage?: boolean;
}

/**
 * Determine whether the highest possible die side was rolled (critical).
 */
function isMaxRoll(result: RollResult): boolean {
  const allDice = [...result.dice, ...result.adversityResults];
  if (allDice.length === 0) return false;
  return allDice.every((d) => d.result === d.sides);
}

/**
 * Determine whether the lowest possible die result was rolled (critical failure).
 */
function isMinRoll(result: RollResult): boolean {
  const allDice = [...result.dice, ...result.adversityResults];
  if (allDice.length === 0) return false;
  return allDice.every((d) => d.result === 1);
}

/**
 * Perform a success/failure check by rolling a dice pool against a target difficulty.
 *
 * This is the core resolution mechanic for the Horizon system:
 * 1. Roll the dice pool (optionally with advantage or disadvantage).
 * 2. Compare the total to the target number.
 * 3. Check for critical success (all dice show max) or critical failure (all dice show 1).
 *
 * @param pool — The dice pool to roll.
 * @param target — The target difficulty number to meet or beat.
 * @param options — Optional RNG, advantage, or disadvantage.
 * @returns A structured CheckResult.
 *
 * @example
 * ```ts
 * const pool = parseDicePool('3d6');
 * const result = checkSuccess(pool, 12);
 * console.log(result.success); // true if total >= 12
 * ```
 */
export function checkSuccess(
  pool: DicePool,
  target: number,
  options: CheckOptions = {},
): CheckResult {
  const { rng, advantage, disadvantage } = options;

  // Roll the primary pool
  const roll = resolveDiceRoll(pool, { rng });

  let finalRoll = roll;
  let discardedRoll: RollResult | undefined;

  // Handle advantage / disadvantage
  if (advantage) {
    // Roll again, take the higher total
    const secondRoll = resolveDiceRoll(pool, { rng });
    if (secondRoll.total > roll.total) {
      discardedRoll = roll;
      finalRoll = secondRoll;
    } else {
      discardedRoll = secondRoll;
    }
  } else if (disadvantage) {
    // Roll again, take the lower total
    const secondRoll = resolveDiceRoll(pool, { rng });
    if (secondRoll.total < roll.total) {
      discardedRoll = roll;
      finalRoll = secondRoll;
    } else {
      discardedRoll = secondRoll;
    }
  }

  const success = finalRoll.total >= target;
  const criticalSuccess = success && isMaxRoll(finalRoll);
  const criticalFailure = !success && isMinRoll(finalRoll);

  return {
    success,
    rollTotal: finalRoll.total,
    target,
    criticalSuccess,
    criticalFailure,
    roll: finalRoll,
    discardedRoll,
  };
}
