// =============================================================================
// Horizon — Dice Routes
// =============================================================================
// Fastify plugin for server-authoritative dice rolling and dice log retrieval.
// POST /api/dice/roll — request a roll, get server-generated results back.
// GET  /api/campaigns/:id/dice-log — paginated roll history for a campaign.
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { randomUUID, randomInt } from 'node:crypto';
import { roll } from '../services/dice.js';
import { insertDiceLog, getDiceLog } from '../models/dice.js';
import { boostDie } from 'shared';
import type { DiceLogRowWithDisplayName } from '../models/dice.js';
import type {
  DiceRollRequest,
  DiceRollResponse,
  DiceLogEntry,
  DiceBoostRequest,
  DicePool,
} from 'shared';

// -----------------------------------------------------------------------------
// JSON Schemas
// -----------------------------------------------------------------------------

const rollSchema = {
  body: {
    type: 'object',
    required: ['pool'],
    properties: {
      pool: {
        type: 'object',
        required: ['dice', 'adversity', 'modifier'],
        properties: {
          dice: {
            type: 'array',
            items: {
              type: 'object',
              required: ['count', 'sides'],
              properties: {
                count: { type: 'number', minimum: 1 },
                sides: { type: 'number', enum: [4, 6, 8, 10, 12, 20, 100] },
              },
            },
          },
          adversity: { type: 'number', minimum: 0 },
          modifier: { type: 'number' },
          source: { type: 'string', enum: ['stat', 'weapon', 'custom'] },
          exploding: { type: 'boolean' },
        },
      },
      reason: { type: 'string' },
      character_id: { type: 'string' },
      modifiers: {
        type: 'object',
        properties: {
          statBonuses: { type: 'object' },
          flatBonus: { type: 'number' },
          source: { type: 'string' },
        },
      },
    },
    additionalProperties: false,
  },
};

// -----------------------------------------------------------------------------
// Route Plugin
// -----------------------------------------------------------------------------

export default async function diceRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/dice/roll
   *
   * Request a server-authoritative dice roll. The server generates random
   * results via CSPRNG, applies any provided modifiers, logs the roll to
   * dice_logs, and returns the complete result.
   *
   * Requires a valid campaign_id in the body — the roll is scoped to a campaign.
   * The roller is identified by the JWT in the Authorization header.
   */
  fastify.post<{ Body: DiceRollRequest }>(
    '/api/dice/roll',
    { schema: rollSchema },
    async (request, reply) => {
      const { pool, reason, character_id, modifiers } = request.body;
      const userId = request.user!.userId;

      // Generate the roll
      const result = roll(pool as DicePool, modifiers);

      // Generate a unique ID for this roll
      const rollId = randomUUID();

      // Build the response
      const response: DiceRollResponse = {
        id: rollId,
        pool: pool as DicePool,
        modifiers,
        result,
        reason,
        character_id,
        roller_user_id: userId,
        created_at: new Date().toISOString(),
      };

      // Logging is best-effort — a roll result is still valid even if logging fails.
      // In Phase 2+, this will also broadcast via WebSocket.
      try {
        // Determine roll source from pool or default to custom
        const rollSource = (pool as DicePool).source ?? 'custom';

        // Use a dummy campaign_id for now — future stories will pass the real one.
        // The dice_logs table requires a campaign_id FK, so we use a placeholder
        // for freeform rolls or derive it from the character's campaign membership.
        const campaignId = 'freeform'; // TODO: resolve from character_id or request body

        // If character_id is provided, we should validate campaign membership.
        // That validation is deferred to a future story (HZN-246/HZN-247 integration).

        insertDiceLog({
          id: rollId,
          campaignId,
          characterId: character_id ?? null,
          rollerUserId: userId,
          poolJson: JSON.stringify(pool),
          modifiersJson: modifiers ? JSON.stringify(modifiers) : null,
          rollSource,
          resultJson: JSON.stringify(result),
          reason: reason ?? null,
        });
      } catch (err) {
        // Log the error but don't fail the request — the roll result is still valid
        fastify.log.warn({ err }, 'Failed to persist dice log entry');
      }

      return reply.status(200).send(response);
    },
  );

  /**
   * GET /api/campaigns/:id/dice-log
   *
   * Retrieve paginated dice roll history for a campaign, newest first.
   * Each entry includes the roller's display name and modifier breakdown.
   *
   * Query params:
   *   - limit  (default 50, max 100)
   *   - offset (default 0)
   */
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/campaigns/:id/dice-log',
    async (request, reply) => {
      const { id: campaignId } = request.params;
      const limit = Math.min(parseInt(request.query.limit ?? '50', 10) || 50, 100);
      const offset = parseInt(request.query.offset ?? '0', 10) || 0;

      const { entries, total } = getDiceLog(campaignId, { limit, offset });

      // Map DB rows to API response shape
      const logEntries: DiceLogEntry[] = entries.map((row) => {
        const enrichedRow = row as DiceLogRowWithDisplayName;
        return {
          id: enrichedRow.id,
          campaign_id: enrichedRow.campaign_id,
          character_id: enrichedRow.character_id,
          roller_user_id: enrichedRow.roller_user_id,
          roller_display_name: enrichedRow.roller_display_name ?? undefined,
          pool_json: enrichedRow.pool_json,
          modifiers_json: enrichedRow.modifiers_json,
          roll_source: enrichedRow.roll_source as DiceLogEntry['roll_source'],
          result_json: enrichedRow.result_json,
          reason: enrichedRow.reason,
          created_at: enrichedRow.created_at,
        };
      });

      return reply.status(200).send({ entries: logEntries, total });
    },
  );

  /**
   * POST /api/dice/boost
   *
   * Spend an adversity token to boost the last roll in a die's explosion chain
   * by +1. If the boost pushes the value to the die's max, it triggers a new
   * explosion roll (server-authoritative RNG).
   */
  fastify.post<{ Body: DiceBoostRequest }>('/api/dice/boost', async (request, reply) => {
    const { currentResult, dieIndex } = request.body;
    const dice = currentResult.dice;

    if (!dice[dieIndex]) {
      return reply.status(400).send({ error: 'Invalid die index.' });
    }

    const die = dice[dieIndex]!;

    // Boost the last roll using server CSPRNG (boostDie handles no-chain case)
    const updatedDie = boostDie(die, () => randomInt(0, 2 ** 32) / 2 ** 32);

    // Build updated result
    const updatedDice = [...dice];
    updatedDice[dieIndex] = updatedDie;

    const newResult = {
      ...currentResult,
      dice: updatedDice,
      total:
        updatedDice.reduce((sum, d) => sum + d.result, 0) +
        currentResult.adversityResults.reduce((sum, d) => sum + d.result, 0) +
        currentResult.modifier,
    };

    return reply.status(200).send({ result: newResult });
  });
}
