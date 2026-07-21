// =============================================================================
// Horizon — Dice Pool Parser & Roll Resolver
// =============================================================================
// Pure functions for parsing dice pool expressions and resolving rolls.
// Importable by both client (for preview/display) and server (for authoritative
// rolls). No side effects, no external dependencies.
//
// See plan/vtt-design-doc.md §4.5 for the dice engine design.
// =============================================================================

import type { DieResult, ModifierSet } from '../types.js';

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
  /** The origin of this dice pool: 'stat', 'weapon', or 'custom'. Defaults to 'custom'. */
  source?: 'stat' | 'weapon' | 'custom';
  /** Whether dice explode on max value. Defaults to true (on). Set false for crit checks etc. */
  exploding?: boolean;
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
  /**
   * Whether dice explode on max value. Overrides pool.exploding if set.
   * Defaults to pool.exploding (which defaults to true).
   */
  exploding?: boolean;
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
  // Exploding is on by default; can be overridden by options or pool.exploding = false
  const exploding = options.exploding ?? pool.exploding ?? true;

  const dice: DieResult[] = [];
  const adversityResults: DieResult[] = [];

  // Roll standard dice with explosion support
  for (const group of pool.dice) {
    for (let i = 0; i < group.count; i++) {
      let total = 0;
      const chain: number[] = [];
      let rolled: number;
      do {
        rolled = rollDie(group.sides, rng);
        total += rolled;
        chain.push(rolled);
      } while (rolled === group.sides && exploding);
      dice.push({
        sides: group.sides,
        result: total,
        ...(chain.length > 1 ? { explosionChain: chain } : {}),
      });
    }
  }

  // Roll adversity dice (also support exploding for consistency)
  for (let i = 0; i < pool.adversity; i++) {
    let total = 0;
    const chain: number[] = [];
    let rolled: number;
    do {
      rolled = rollDie(adversitySides, rng);
      total += rolled;
      chain.push(rolled);
    } while (rolled === adversitySides && exploding);
    adversityResults.push({
      sides: adversitySides,
      result: total,
      ...(chain.length > 1 ? { explosionChain: chain } : {}),
    });
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

// -----------------------------------------------------------------------------
// Modifier Application (HZN-229 integration contract)
// -----------------------------------------------------------------------------

/**
 * Apply a ModifierSet to a DicePool, producing a new DicePool with modifiers
 * merged in. This is a **pure function** — it does not mutate the input.
 *
 * The ModifierSet is the contract between HZN-244 (Dice Engine) and HZN-229
 * (Expanded Items & Abilities). HZN-229 computes `ModifierSet` from equipped
 * items and abilities; this function applies it to the dice pool.
 *
 * - `statBonuses`: summed and added to `pool.modifier`.
 * - `flatBonus`: added directly to `pool.modifier`.
 * - The `source` field is preserved in the returned pool for logging.
 *
 * @param pool — The base dice pool to apply modifiers to.
 * @param modifiers — The modifier set computed from items/abilities.
 * @returns A new DicePool with modifiers merged into the flat modifier.
 *
 * @example
 * ```ts
 * const pool = { dice: [{ count: 1, sides: 10 }], adversity: 0, modifier: 0 };
 * const mods = { statBonuses: { cognition: 5 }, source: 'Pirate Hat' };
 * const adjusted = applyModifiers(pool, mods);
 * // adjusted.modifier === 5
 * ```
 */
export function applyModifiers(pool: DicePool, modifiers: ModifierSet): DicePool {
  let totalModifier = pool.modifier;

  if (modifiers.statBonuses) {
    for (const bonus of Object.values(modifiers.statBonuses)) {
      totalModifier += bonus;
    }
  }

  if (modifiers.flatBonus) {
    totalModifier += modifiers.flatBonus;
  }

  return {
    ...pool,
    modifier: totalModifier,
    source: pool.source ?? 'custom',
  };
}

// -----------------------------------------------------------------------------
// Adversity Token Boost
// -----------------------------------------------------------------------------

/**
 * Boost the last roll in a die's explosion chain by +1 (spend an adversity token).
 * If the boosted value reaches the die's maximum, it triggers another explosion.
 *
 * @param die — The die result to boost (must have an explosionChain).
 * @param rng — Random number generator for potential explosion re-rolls.
 * @returns A new DieResult with the boosted chain and updated total, or the
 *          original die unchanged if there's no chain to boost.
 *
 * @example
 * ```ts
 * // Chain: [4, 3] on a d4. Boost last (3 → 4). 4 triggers explosion → roll 2.
 * const boosted = boostDie({ sides: 4, result: 7, explosionChain: [4, 3] }, Math.random);
 * // boosted.explosionChain === [4, 4, 2], boosted.result === 10
 * ```
 */
export function boostDie(die: DieResult, rng: () => number = Math.random): DieResult {
  const sides = die.sides;

  // If no explosion chain, create one from the raw result so single rolls
  // can be boosted (e.g., d4 rolls 3 → boost to 4 → triggers explosion).
  const chain =
    die.explosionChain && die.explosionChain.length > 0 ? [...die.explosionChain] : [die.result];

  const newChain = [...chain];
  const lastIdx = newChain.length - 1;

  // Boost the last roll by 1
  newChain[lastIdx] = newChain[lastIdx]! + 1;

  // Check if the boosted value hits max → explode
  let current = newChain[lastIdx]!;
  while (current === sides) {
    const extra = rollDie(sides, rng);
    newChain.push(extra);
    current = extra;
  }

  // Recalculate total
  const newTotal = newChain.reduce((sum, v) => sum + v, 0);

  return {
    sides,
    result: newTotal,
    explosionChain: newChain.length > 1 ? newChain : undefined,
  };
}
