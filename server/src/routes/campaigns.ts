// =============================================================================
// Horizon — Campaign Routes
// =============================================================================
// Fastify plugin that registers all /api/campaigns/* routes.
// All campaign routes require authentication (JWT verified by auth middleware).
// =============================================================================

import type { FastifyInstance } from 'fastify';
import {
  createCampaign,
  getCampaignDetail,
  listUserCampaigns,
  joinCampaign,
  leaveCampaign,
  CampaignValidationError,
  CampaignNotFoundError,
  InviteCodeMismatchError,
  AlreadyMemberError,
  GMCannotLeaveError,
} from '../services/campaign.js';
import { findMembership } from '../models/campaign.js';
import type { CreateCampaignRequest } from 'shared';

// -----------------------------------------------------------------------------
// JSON Schemas for Fastify body validation
// -----------------------------------------------------------------------------

const createCampaignSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        description: 'Display name of the campaign. Minimum 2 characters.',
      },
      description: {
        type: 'string',
        description: 'Optional short description or premise of the campaign.',
      },
    },
    additionalProperties: false,
  },
};

// -----------------------------------------------------------------------------
// Plugin
// -----------------------------------------------------------------------------

/**
 * Register campaign-related routes on the Fastify instance.
 *
 * Routes:
 * - POST /api/campaigns — create a new campaign (authenticated)
 * - GET  /api/campaigns — list campaigns the user belongs to (authenticated)
 * - GET  /api/campaigns/:id — get campaign detail (authenticated, must be member)
 */
export default async function campaignRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/campaigns
   *
   * Create a new campaign. The authenticated user becomes the GM.
   * Returns 201 with the full Campaign object (including invite code).
   */
  fastify.post('/api/campaigns', { schema: createCampaignSchema }, async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    const input = request.body as CreateCampaignRequest;

    try {
      const campaign = createCampaign(userId, input);
      return reply.status(201).send(campaign);
    } catch (err) {
      if (err instanceof CampaignValidationError) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err.message,
          statusCode: 400,
        });
      }

      throw err; // Let the global error handler deal with unexpected errors
    }
  });

  /**
   * GET /api/campaigns
   *
   * List all campaigns the authenticated user belongs to (as GM or player).
   * Ordered by most recently created first.
   */
  fastify.get('/api/campaigns', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    const campaigns = listUserCampaigns(userId);
    return reply.send(campaigns);
  });

  /**
   * GET /api/campaigns/:id
   *
   * Get a single campaign by ID. Only members of the campaign can view it.
   * Returns 404 if the campaign doesn't exist or the user is not a member.
   */
  fastify.get('/api/campaigns/:id', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    const { id } = request.params as { id: string };

    try {
      // Verify membership — only members can view campaign details
      const membership = findMembership(id, userId);
      if (!membership) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Campaign "${id}" not found.`,
          statusCode: 404,
        });
      }

      const detail = getCampaignDetail(id);
      return reply.send(detail);
    } catch (err) {
      // Let the global error handler deal with unexpected errors
      throw err;
    }
  });

  /**
   * POST /api/campaigns/join
   *
   * Join a campaign using its invite code. Adds the authenticated user as a player.
   * Returns the campaign on success.
   */
  fastify.post('/api/campaigns/join', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    const { inviteCode } = request.body as { inviteCode: string };

    if (!inviteCode || typeof inviteCode !== 'string' || !inviteCode.trim()) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invite code is required.',
        statusCode: 400,
      });
    }

    try {
      const campaign = joinCampaign(userId, inviteCode.trim().toUpperCase());
      return reply.status(200).send(campaign);
    } catch (err) {
      if (err instanceof InviteCodeMismatchError) {
        return reply.status(404).send({
          error: 'Not Found',
          message: err.message,
          statusCode: 404,
        });
      }
      if (err instanceof AlreadyMemberError) {
        return reply.status(409).send({
          error: 'Conflict',
          message: err.message,
          statusCode: 409,
        });
      }
      throw err;
    }
  });

  /**
   * DELETE /api/campaigns/:id/leave
   *
   * Leave a campaign. GM cannot leave their own campaign.
   */
  fastify.delete('/api/campaigns/:id/leave', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    const { id } = request.params as { id: string };

    try {
      leaveCampaign(id, userId);
      return reply.status(200).send({ success: true });
    } catch (err) {
      if (err instanceof GMCannotLeaveError) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: err.message,
          statusCode: 403,
        });
      }
      if (err instanceof CampaignNotFoundError) {
        return reply.status(404).send({
          error: 'Not Found',
          message: err.message,
          statusCode: 404,
        });
      }
      throw err;
    }
  });
}
