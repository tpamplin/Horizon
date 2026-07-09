// =============================================================================
// Horizon — JWT Authentication Middleware
// =============================================================================
// Verifies the Bearer token from the Authorization header, decodes the JWT
// payload, and attaches the user information to the request. Applied to all
// routes except /api/auth/* and /api/health.
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Decoded JWT payload attached to the request by auth middleware. */
export interface JwtPayload {
  /** User ID from the database. */
  userId: string;
  /** User's display name. */
  displayName: string;
  /** User's email address. */
  email: string;
  /** Issued-at timestamp (Unix seconds). */
  iat: number;
  /** Expiration timestamp (Unix seconds). */
  exp: number;
}

// Augment Fastify request to include the authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated user payload — set by auth middleware, undefined if unauthenticated. */
    user?: JwtPayload;
  }
}

// -----------------------------------------------------------------------------
// Public paths (no auth required)
// -----------------------------------------------------------------------------

const PUBLIC_PREFIXES = ['/api/auth/', '/api/health'];

function isPublicPath(url: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

/**
 * Fastify preHandler hook that verifies JWT Bearer tokens.
 *
 * - Extracts the token from the `Authorization: Bearer <token>` header.
 * - Verifies the token using the configured JWT secret.
 * - Attaches the decoded payload to `request.user`.
 * - Returns 401 if the token is missing, malformed, or expired.
 * - Skips verification for public paths (/api/auth/*, /api/health).
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip auth for public paths
  if (isPublicPath(request.url)) {
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing Authorization header.',
      statusCode: 401,
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authorization header must use Bearer scheme.',
      statusCode: 401,
    });
  }

  const token = parts[1]!;

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    request.user = payload;
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Token has expired. Please refresh your session.'
        : err instanceof jwt.JsonWebTokenError
          ? 'Invalid token.'
          : 'Token verification failed.';

    return reply.status(401).send({
      error: 'Unauthorized',
      message,
      statusCode: 401,
    });
  }
}
