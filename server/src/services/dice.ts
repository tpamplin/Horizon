// =============================================================================
// Horizon — Dice Service
// =============================================================================
// Server-side dice roll service. Generates cryptographically random dice
// results, applies modifiers via shared rules, and returns a RollResult.
// Dice RNG is server-authoritative per the core design principle.
// =============================================================================

import { randomInt } from 'node:crypto';
import type { DicePool, RollResult, ModifierSet } from 'shared';
import { resolveDiceRoll, applyModifiers } from 'shared';

// -----------------------------------------------------------------------------
// CSPRNG Wrapper
// -----------------------------------------------------------------------------

/**
 * CSPRNG-compatible RNG function that returns a value in [0, 1).
 * Passed to resolveDiceRoll to override Math.random.
 * Uses Node's crypto.randomInt for cryptographic-quality randomness.
 */
function csprng(): number {
  // Generate a value in [0, 2^32) and normalize to [0, 1)
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

// -----------------------------------------------------------------------------
// Roll
// -----------------------------------------------------------------------------

/**
 * Perform a server-authoritative dice roll.
 *
 * 1. Applies optional modifiers to the dice pool via applyModifiers().
 * 2. Resolves the pool using cryptographically secure RNG.
 * 3. Returns the complete RollResult.
 *
 * The caller (typically the route handler) is responsible for:
 * - Validating campaign/character membership
 * - Persisting the result via insertDiceLog()
 * - Broadcasting via WebSocket (Phase 2+)
 *
 * @param pool — The dice pool to roll.
 * @param modifiers — Optional modifier set from items/abilities (HZN-229 contract).
 * @returns The resolved roll result with individual dice and total.
 */
export function roll(pool: DicePool, modifiers?: ModifierSet): RollResult {
  // Apply modifiers if provided (HZN-229 integration)
  const adjustedPool = modifiers ? applyModifiers(pool, modifiers) : pool;

  // Resolve with CSPRNG
  const result = resolveDiceRoll(adjustedPool, { rng: csprng });

  return result;
}
