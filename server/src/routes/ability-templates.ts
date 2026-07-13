import type { FastifyInstance } from 'fastify';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  AbilityTemplateNotFoundError,
  AbilityTemplateValidationError,
} from '../services/ability-template.js';
import type { CreateAbilityRequest, UpdateAbilityRequest } from 'shared';

export default async function abilityTemplateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/abilities/templates', async (_req, reply) => reply.send(listTemplates()));
  fastify.post('/api/abilities/templates', async (request, reply) => {
    const userId = (request as any).user?.userId;
    if (!userId)
      return reply
        .status(401)
        .send({ error: 'Unauthorized', message: 'Authentication required.', statusCode: 401 });
    try {
      return reply.status(201).send(createTemplate(userId, request.body as CreateAbilityRequest));
    } catch (err) {
      if (err instanceof AbilityTemplateValidationError)
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: err.message, statusCode: 400 });
      throw err;
    }
  });
  fastify.get('/api/abilities/templates/:id', async (request, reply) => {
    try {
      return reply.send(getTemplate((request.params as { id: string }).id));
    } catch (err) {
      if (err instanceof AbilityTemplateNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      throw err;
    }
  });
  fastify.put('/api/abilities/templates/:id', async (request, reply) => {
    try {
      return reply.send(
        updateTemplate((request.params as { id: string }).id, request.body as UpdateAbilityRequest),
      );
    } catch (err) {
      if (err instanceof AbilityTemplateNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      throw err;
    }
  });
  fastify.delete('/api/abilities/templates/:id', async (request, reply) => {
    try {
      deleteTemplate((request.params as { id: string }).id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof AbilityTemplateNotFoundError)
        return reply
          .status(404)
          .send({ error: 'Not Found', message: err.message, statusCode: 404 });
      throw err;
    }
  });
}
