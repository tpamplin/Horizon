// =============================================================================
// Horizon — Request Logger Middleware
// =============================================================================
// Logs every incoming HTTP request with method, URL, response time, and
// status code. Uses Fastify's built-in pino logger for structured output.
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    /** Timestamp set by the logger onRequest hook, used to compute responseTime in onResponse. */
    __requestStartTime?: number;
  }
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

/**
 * Fastify `onRequest` hook — captures the request start time.
 * Fires before any other hook or handler.
 */
export async function loggerOnRequest(request: FastifyRequest): Promise<void> {
  request.__requestStartTime = Date.now();

  request.log.info(
    {
      method: request.method,
      url: request.url,
      remoteAddress: request.ip,
    },
    'incoming request',
  );
}

/**
 * Fastify `onResponse` hook — logs the completed response.
 * Fires after the response has been fully sent to the client,
 * guaranteeing accurate statusCode and true response time.
 */
export async function loggerOnResponse(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const responseTime = Date.now() - (request.__requestStartTime ?? Date.now());

  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime}ms`,
    },
    'request completed',
  );
}
