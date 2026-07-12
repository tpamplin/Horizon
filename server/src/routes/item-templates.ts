// =============================================================================
// Horizon — Item Template Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  ItemTemplateNotFoundError,
  ItemTemplateValidationError,
} from '../services/item-template.js';
import type { CreateSignatureItemRequest, UpdateSignatureItemRequest } from 'shared';

export default async function itemTemplateRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/items/templates — list all templates (optional ?category filter) */
  fastify.get('/api/items/templates', async (request, reply) => {
    const { category } = request.query as { category?: string };
    const templates = listTemplates(category);
    return reply.send(templates);
  });

  /** POST /api/items/templates — create a new template */
  fastify.post('/api/items/templates', async (request, reply) => {
    const userId = (request as any).user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });

    try {
      const tmpl = createTemplate(userId, request.body as CreateSignatureItemRequest);
      return reply.status(201).send(tmpl);
    } catch (err) {
      if (err instanceof ItemTemplateValidationError) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      }
      throw err;
    }
  });

  /** GET /api/items/templates/:id — single template */
  fastify.get('/api/items/templates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send(getTemplate(id));
    } catch (err) {
      if (err instanceof ItemTemplateNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      throw err;
    }
  });

  /** PUT /api/items/templates/:id — update template */
  fastify.put('/api/items/templates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      return reply.send(updateTemplate(id, request.body as UpdateSignatureItemRequest));
    } catch (err) {
      if (err instanceof ItemTemplateNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      throw err;
    }
  });

  /** DELETE /api/items/templates/:id — delete template */
  fastify.delete('/api/items/templates/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      deleteTemplate(id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof ItemTemplateNotFoundError) {
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      }
      throw err;
    }
  });
}
