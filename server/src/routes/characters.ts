// =============================================================================
// Horizon — Character Routes
// =============================================================================
// Fastify plugin for user-scoped character CRUD and campaign roster management.
// Characters belong to users; campaign membership is via join table.
// =============================================================================

import type { FastifyInstance } from 'fastify';
import {
  createCharacter,
  getCharacter,
  listUserCharacters,
  updateSheet,
  deleteCharacter,
  addCharacterToCampaign,
  removeCharacterFromCampaign,
  listCampaignRoster,
  CharacterNotFoundError,
  CharacterValidationError,
  CharacterAuthorizationError,
} from '../services/character.js';
import { findMembership } from '../models/campaign.js';
import type {
  CreateCharacterRequest,
  UpdateCharacterRequest,
  AddCharacterToCampaignRequest,
} from 'shared';

// -----------------------------------------------------------------------------
// JSON Schemas
// -----------------------------------------------------------------------------

const createCharacterSchema = {
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

const updateCharacterSchema = {
  body: {
    type: 'object',
    required: ['sheetData'],
    properties: {
      sheetData: { type: 'object' },
      name: { type: 'string', minLength: 2 },
      archetype: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
};

const addToCampaignSchema = {
  body: {
    type: 'object',
    required: ['characterId'],
    properties: {
      characterId: { type: 'string' },
    },
    additionalProperties: false,
  },
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function requireAuth(
  request: { user?: { userId?: string } },
  reply: { status: (c: number) => { send: (b: object) => void } },
): string | null {
  const userId = request.user?.userId;
  if (!userId) {
    reply
      .status(401)
      .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    return null;
  }
  return userId;
}

function requireCampaignMembership(
  request: { user?: { userId?: string } },
  reply: { status: (c: number) => { send: (b: object) => void } },
  campaignId: string,
): string | null {
  const userId = requireAuth(request, reply);
  if (!userId) return null;
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

// -----------------------------------------------------------------------------
// Plugin
// -----------------------------------------------------------------------------

export default async function characterRoutes(fastify: FastifyInstance): Promise<void> {
  // =========================================================================
  // User Library Endpoints
  // =========================================================================

  /** GET /api/characters — list user's character library */
  fastify.get('/api/characters', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;
    return reply.send(listUserCharacters(userId));
  });

  /** POST /api/characters — create character in library */
  fastify.post('/api/characters', { schema: createCharacterSchema }, async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;
    try {
      const character = createCharacter(userId, request.body as CreateCharacterRequest);
      return reply.status(201).send(character);
    } catch (err) {
      if (err instanceof CharacterValidationError) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      }
      throw err;
    }
  });

  /** GET /api/characters/:id — single character */
  fastify.get('/api/characters/:id', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;
    try {
      return reply.send(getCharacter((request.params as { id: string }).id));
    } catch (err) {
      if (err instanceof CharacterNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      throw err;
    }
  });

  /** PUT /api/characters/:id — update sheet */
  fastify.put('/api/characters/:id', { schema: updateCharacterSchema }, async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;
    try {
      const char = updateSheet(
        userId,
        (request.params as { id: string }).id,
        request.body as UpdateCharacterRequest,
      );
      return reply.send(char);
    } catch (err) {
      if (err instanceof CharacterNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      if (err instanceof CharacterAuthorizationError) {
        return reply
          .status(403)
          .send({ error: 'Forbidden', message: err.message, statusCode: 403 });
      }
      throw err;
    }
  });

  /** DELETE /api/characters/:id — delete from library */
  fastify.delete('/api/characters/:id', async (request, reply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;
    try {
      deleteCharacter(userId, (request.params as { id: string }).id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof CharacterNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      if (err instanceof CharacterAuthorizationError) {
        return reply
          .status(403)
          .send({ error: 'Forbidden', message: err.message, statusCode: 403 });
      }
      throw err;
    }
  });

  // =========================================================================
  // Campaign Roster Endpoints
  // =========================================================================

  /** GET /api/campaigns/:id/characters — campaign roster */
  fastify.get('/api/campaigns/:id/characters', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = requireCampaignMembership(request, reply, id);
    if (!userId) return;
    return reply.send(listCampaignRoster(id));
  });

  /** POST /api/campaigns/:id/characters — add character to roster */
  fastify.post(
    '/api/campaigns/:id/characters',
    { schema: addToCampaignSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = requireCampaignMembership(request, reply, id);
      if (!userId) return;
      try {
        addCharacterToCampaign(userId, id, request.body as AddCharacterToCampaignRequest);
        return reply.status(201).send({ success: true });
      } catch (err) {
        if (err instanceof CharacterNotFoundError) {
          return reply
            .status(404)
            .send({ error: 'Not Found', message: err.message, statusCode: 404 });
        }
        if (err instanceof CharacterAuthorizationError) {
          return reply
            .status(403)
            .send({ error: 'Forbidden', message: err.message, statusCode: 403 });
        }
        throw err;
      }
    },
  );

  /** DELETE /api/campaigns/:id/characters/:cid — remove from roster */
  fastify.delete('/api/campaigns/:id/characters/:cid', async (request, reply) => {
    const { id, cid } = request.params as { id: string; cid: string };
    const userId = requireCampaignMembership(request, reply, id);
    if (!userId) return;
    try {
      removeCharacterFromCampaign(userId, id, cid);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof CharacterNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      if (err instanceof CharacterAuthorizationError) {
        return reply
          .status(403)
          .send({ error: 'Forbidden', message: err.message, statusCode: 403 });
      }
      throw err;
    }
  });
}
