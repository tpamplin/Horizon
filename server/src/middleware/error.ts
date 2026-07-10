// =============================================================================
// Horizon — Error Handler Middleware
// =============================================================================
// Centralized Fastify error handler that returns a consistent JSON error shape.
// Catches all unhandled errors and ensures stack traces are never leaked
// to clients in production.
// =============================================================================

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

// -----------------------------------------------------------------------------
// Error Response Shape
// -----------------------------------------------------------------------------

/** Consistent JSON error response sent to clients. */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

/**
 * Fastify global error handler.
 *
 * - Returns a consistent `{ error, message, statusCode }` JSON body.
 * - In production, hides error details and stack traces.
 * - In development, includes the original error message for debugging.
 * - Logs all errors via Fastify's built-in logger.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const statusCode = error.statusCode ?? 500;

  // Log the full error for server-side debugging
  request.log.error({ err: error, url: request.url }, 'Request error');

  const isProduction = config.nodeEnv === 'production';

  const response: ErrorResponse = {
    error: error.code ?? 'InternalServerError',
    message: isProduction
      ? 'An unexpected error occurred.'
      : error.message || 'An unexpected error occurred.',
    statusCode,
  };

  reply.status(statusCode).send(response);
}
