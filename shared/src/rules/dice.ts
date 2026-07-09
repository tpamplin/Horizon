// =============================================================================
// Horizon — Dice Pool Parser & Roll Resolver
// =============================================================================
// Pure functions for parsing dice pool expressions and resolving rolls.
// Importable by both client (for preview/display) and server (for authoritative
// rolls). No side effects, no external dependencies.
//
// See plan/vtt-design-doc.md §4.5 for the dice engine design.
// =============================================================================

import type { DieResult } from '../types.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * A group of identical dice within a dice pool.
 * E.g. "3d6" → `{ count: 3, sides: 6 }`.
 */
export interface DiceGroup {
  /** Number of dice in this group. */
  count: number;
  /** Number of sides per die (4, 6, 8, 10, 12, 20, or 100). */
  sides: number;
}

/**
 * The valid die sizes in the Horizon system.
 */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

/**
 * A structured dice pool, parsed from a dice expression string.
 *
 * @example "3d6 + 2a - 1" parses to:
 * ```json
 * {
 *   "dice": [{ "count": 3, "sides": 6 }],
 *   "adversity": 2,
 *   "modifier": -1
 * }
 * ```
 */
export interface DicePool {
  /** Standard dice groups (e.g. 3d6, 2d8). */
  dice: DiceGroup[];
  /** Number of adversity dice (the "a" in "2a"). 0 if none. */
  adversity: number;
  /** Flat modifier applied to the total (+N or -N). 0 if none. */
  modifier: number;
}

/**
 * Result of resolving a dice pool roll.
 */
export interface RollResult {
  /** Individual results for each standard die rolled. */
  dice: DieResult[];
  /** Individual results for each adversity die rolled. */
  adversityResults: DieResult[];
  /** The flat modifier from the pool. */
  modifier: number;
  /** Sum of all die results plus the modifier. */
  total: number;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** All valid die side counts. */
const VALID_SIDES: Set<number> = new Set([4, 6, 8, 10, 12, 20, 100]);

/** Default number of sides for adversity dice when not specified. */
const DEFAULT_ADVERSITY_SIDES: DieSides = 6;

/**
 * Regex patterns for parsing dice expressions.
 * Matches in order: standard dice (XdY), adversity dice (Xa), modifiers (+/-N).
 */
const DICE_PATTERN = /(\d+)\s*d\s*(\d+)/gi;
const ADVERSITY_PATTERN = /(\d+)\s*a/gi;
/** Matches standalone +/-N that is NOT followed by a die/adversity specifier. */
const MODIFIER_PATTERN = /([+-]\s*\d+)(?!\s*[da])/gi;

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------

/**
 * Parse a dice pool expression string into a structured DicePool.
 *
 * Supports:
 * - Standard dice: `XdY` where X = count, Y = sides (4, 6, 8, 10, 12, 20, 100)
 * - Adversity dice: `Xa` where X = count
 * - Flat modifiers: `+N` or `-N`
 * - Whitespace is tolerated between tokens
 *
 * @param input — A dice pool expression (e.g. "3d6+2a", "2d8 + 1d6 - 1").
 * @returns A parsed DicePool.
 * @throws {Error} If the input contains invalid dice (unsupported sides, no count, etc.).
 *
 * @example
 * ```ts
 * parseDicePool("3d6+2a")    // → { dice: [{count:3,sides:6}], adversity: 2, modifier: 0 }
 * parseDicePool("2d8+1d6-1") // → { dice: [{count:2,sides:8},{count:1,sides:6}], adversity: 0, modifier: -1 }
 * parseDicePool("4a+3")      // → { dice: [], adversity: 4, modifier: 3 }
 * ```
 */
export function parseDicePool(input: string): DicePool {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('Dice pool expression is empty.');
  }

  const dice: DiceGroup[] = [];
  let adversity = 0;
  let modifier = 0;

  // Track which character ranges have been consumed to detect unrecognized tokens
  const consumed = new Set<number>();

  // Parse standard dice: XdY
  DICE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DICE_PATTERN.exec(trimmed)) !== null) {
    const count = parseInt(match[1]!, 10);
    const sides = parseInt(match[2]!, 10);

    if (!VALID_SIDES.has(sides)) {
      throw new Error(`Invalid die size d${sides}. Valid sizes: ${[...VALID_SIDES].join(', ')}.`);
    }

    dice.push({ count, sides });

    // Mark consumed range
    for (let i = match.index; i < match.index + match[0].length; i++) {
      consumed.add(i);
    }
  }

  // Parse adversity dice: Xa
  ADVERSITY_PATTERN.lastIndex = 0;
  while ((match = ADVERSITY_PATTERN.exec(trimmed)) !== null) {
    const count = parseInt(match[1]!, 10);
    adversity += count;

    for (let i = match.index; i < match.index + match[0].length; i++) {
      consumed.add(i);
    }
  }

  // Parse modifiers: +/-N
  MODIFIER_PATTERN.lastIndex = 0;
  while ((match = MODIFIER_PATTERN.exec(trimmed)) !== null) {
    const raw = match[1]!.replace(/\s/g, '');
    modifier += parseInt(raw, 10);

    for (let i = match.index; i < match.index + match[0].length; i++) {
      consumed.add(i);
    }
  }

  // Check for unrecognized, non-whitespace, non-operator characters
  const operators = new Set(['+', '-']);
  for (let i = 0; i < trimmed.length; i++) {
    if (consumed.has(i)) continue;
    const ch = trimmed[i]!;
    if (ch === ' ' || operators.has(ch)) continue;
    throw new Error(
      `Unrecognized token "${ch}" at position ${i} in "${trimmed}". ` +
        'Expected dice expression like "3d6+2a" or "2d8+1d6-1".',
    );
  }

  // Validate: at least something was parsed
  if (dice.length === 0 && adversity === 0 && modifier === 0) {
    throw new Error(
      `Could not parse any dice, adversity, or modifiers from "${trimmed}". ` +
        'Expected format: "XdY", "Xa", "+/-N" (e.g. "3d6+2a-1").',
    );
  }

  return { dice, adversity, modifier };
}

// -----------------------------------------------------------------------------
// Roll Resolver
// -----------------------------------------------------------------------------

/**
 * Options for resolving a dice roll.
 */
export interface ResolveOptions {
  /**
   * Custom random number generator. Should return a value in [0, 1).
   * Useful for testing with a seeded RNG. Defaults to `Math.random`.
   */
  rng?: () => number;
  /**
   * Number of sides for each adversity die.
   * Defaults to d6 if not specified.
   */
  adversitySides?: DieSides;
}

/**
 * Roll a single die of the given number of sides.
 */
function rollDie(sides: number, rng: () => number): number {
  return Math.floor(rng() * sides) + 1;
}

/**
 * Resolve a DicePool into a RollResult by rolling all dice.
 *
 * This is a **pure function** — given the same pool and the same RNG sequence,
 * it always produces the same result. The optional `rng` parameter enables
 * deterministic testing.
 *
 * @param pool — The parsed dice pool to resolve.
 * @param options — Optional RNG and adversity die configuration.
 * @returns The resolved roll result with individual die outcomes and total.
 *
 * @example
 * ```ts
 * const pool = parseDicePool("3d6+2a-1");
 * const result = resolveDiceRoll(pool);
 * console.log(result.total); // e.g. 13
 * ```
 */
export function resolveDiceRoll(pool: DicePool, options: ResolveOptions = {}): RollResult {
  const rng = options.rng ?? Math.random;
  const adversitySides = options.adversitySides ?? DEFAULT_ADVERSITY_SIDES;

  const dice: DieResult[] = [];
  const adversityResults: DieResult[] = [];

  // Roll standard dice
  for (const group of pool.dice) {
    for (let i = 0; i < group.count; i++) {
      const result = rollDie(group.sides, rng);
      dice.push({ sides: group.sides, result });
    }
  }

  // Roll adversity dice
  for (let i = 0; i < pool.adversity; i++) {
    const result = rollDie(adversitySides, rng);
    adversityResults.push({ sides: adversitySides, result });
  }

  // Compute total
  const diceSum = dice.reduce((sum, d) => sum + d.result, 0);
  const adversitySum = adversityResults.reduce((sum, d) => sum + d.result, 0);
  const total = diceSum + adversitySum + pool.modifier;

  return {
    dice,
    adversityResults,
    modifier: pool.modifier,
    total,
  };
}
