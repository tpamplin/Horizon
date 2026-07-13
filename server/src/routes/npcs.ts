// =============================================================================
// Horizon — NPC Routes
// =============================================================================
// Fastify plugin for user-scoped NPC CRUD + campaign roster management.
// =============================================================================

import type { FastifyInstance } from 'fastify';
import {
  createNPC,
  getNPC,
  listUserNPCs,
  updateNPC,
  deleteNPC,
  addNPCToCampaign,
  removeNPCFromCampaign,
  listCampaignNPCs,
  NPCNotFoundError,
  NPCValidationError,
} from '../services/npc.js';
import { findMembership } from '../models/campaign.js';
import type { CreateNPCRequest, UpdateNPCRequest, AddNPCToCampaignRequest } from 'shared';

const createNPCSchema = {
  body: {
    type: 'object',
    required: ['name', 'archetype'],
    properties: {
      name: { type: 'string', minLength: 2 },
      archetype: { type: 'string', minLength: 1 },
      sheetData: { type: 'object' },
    },
    additionalProperties: false,
  },
};

const updateNPCSchema = {
  body: {
    type: 'object',
    required: ['sheetData'],
    properties: { sheetData: { type: 'object' } },
    additionalProperties: false,
  },
};

function requireMembership(
  request: { user?: { userId?: string } },
  reply: { status: (code: number) => { send: (body: object) => void } },
  campaignId: string,
): string | null {
  const userId = request.user?.userId;
  if (!userId) {
    reply
      .status(401)
      .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    return null;
  }
  if (!findMembership(campaignId, userId)) {
    reply.status(404).send({
      error: 'Not Found',
      message: `Campaign "${campaignId}" not found.`,
      statusCode: 404,
    });
    return null;
  }
  return userId;
}

export default async function npcRoutes(fastify: FastifyInstance): Promise<void> {
  // Library endpoints
  fastify.post('/api/npcs', { schema: createNPCSchema }, async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    try {
      const npc = createNPC(userId, request.body as CreateNPCRequest);
      return reply.status(201).send(npc);
    } catch (err) {
      if (err instanceof NPCValidationError)
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      throw err;
    }
  });

  fastify.get('/api/npcs', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    return reply.send(listUserNPCs(userId));
  });

  fastify.get('/api/npcs/:id', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    try {
      return reply.send(getNPC((request.params as { id: string }).id));
    } catch (err) {
      if (err instanceof NPCNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      throw err;
    }
  });

  fastify.put('/api/npcs/:id', { schema: updateNPCSchema }, async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    try {
      return reply.send(
        updateNPC(userId, (request.params as { id: string }).id, request.body as UpdateNPCRequest),
      );
    } catch (err) {
      if (err instanceof NPCNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      if (err instanceof NPCValidationError)
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      throw err;
    }
  });

  fastify.delete('/api/npcs/:id', async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    try {
      deleteNPC(userId, (request.params as { id: string }).id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof NPCNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      if (err instanceof NPCValidationError)
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      throw err;
    }
  });

  // Campaign roster endpoints
  fastify.get('/api/campaigns/:id/npcs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = requireMembership(request, reply, id);
    if (!userId) return;
    return reply.send(listCampaignNPCs(id));
  });

  fastify.post('/api/campaigns/:id/npcs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = requireMembership(request, reply, id);
    if (!userId) return;
    try {
      const npc = addNPCToCampaign(userId, id, request.body as AddNPCToCampaignRequest);
      return reply.status(201).send(npc);
    } catch (err) {
      if (err instanceof NPCNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      if (err instanceof NPCValidationError)
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      throw err;
    }
  });

  fastify.delete('/api/campaigns/:id/npcs/:nid', async (request, reply) => {
    const { id, nid } = request.params as { id: string; nid: string };
    const userId = requireMembership(request, reply, id);
    if (!userId) return;
    try {
      removeNPCFromCampaign(userId, id, nid);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof NPCValidationError)
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      throw err;
    }
  });
}
