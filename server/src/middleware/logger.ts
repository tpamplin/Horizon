// =============================================================================
// Horizon — Request Logger Middleware
// =============================================================================
// Logs every incoming HTTP request with method, URL, response time, and
// status code. Uses Fastify's built-in pino logger for structured output.
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

/**
 * Fastify onRequest + onResponse hook pair that logs request details.
 *
 * Logs at the start (onRequest) and completion (onResponse) of every request:
 * - Method, URL, and remote address on arrival
 * - Status code and response time on completion
 *
 * Uses Fastify's built-in pino logger — no external logging library needed.
 */
export async function loggerMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const start = Date.now();

  // Log the incoming request
  request.log.info(
    {
      method: request.method,
      url: request.url,
      remoteAddress: request.ip,
    },
    'incoming request',
  );

  // Log the completed response
  reply.then(
    () => {
      const responseTime = Date.now() - start;
      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime,
        },
        'request completed',
      );
    },
    () => {
      // Response errored — error handler will log details
    },
  );
}
