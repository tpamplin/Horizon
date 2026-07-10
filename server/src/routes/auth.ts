// =============================================================================
// Horizon — Auth Routes
// =============================================================================
// Fastify plugin that registers all /api/auth/* routes.
// Auth routes are PUBLIC — the auth middleware skips /api/auth/* paths.
// =============================================================================

import type { FastifyInstance } from 'fastify';
import {
  register as registerUser,
  login as loginUser,
  refreshToken as refreshTokenService,
} from '../services/auth.js';
import {
  DuplicateEmailError,
  InvalidCredentialsError,
  TokenRefreshError,
  ValidationError,
} from '../services/auth.js';
import type { RegisterRequest, LoginRequest, RefreshRequest } from 'shared';
import { findById } from '../models/user.js';

// -----------------------------------------------------------------------------
// JSON Schemas for Fastify body validation
// -----------------------------------------------------------------------------

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'displayName'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address. Must be unique.',
      },
      password: {
        type: 'string',
        minLength: 8,
        description: 'Plain-text password. Minimum 8 characters.',
      },
      displayName: {
        type: 'string',
        minLength: 2,
        description: 'Display name shown to other players.',
      },
    },
    additionalProperties: false,
  },
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Registered email address.',
      },
      password: {
        type: 'string',
        description: 'Account password.',
      },
    },
    additionalProperties: false,
  },
};

const refreshSchema = {
  body: {
    type: 'object',
    required: ['refresh_token'],
    properties: {
      refresh_token: {
        type: 'string',
        description: 'Opaque refresh token issued during login or previous refresh.',
      },
    },
    additionalProperties: false,
  },
};

// -----------------------------------------------------------------------------
// Plugin
// -----------------------------------------------------------------------------

/**
 * Register auth-related routes on the Fastify instance.
 *
 * Routes:
 * - POST /api/auth/register — create a new user account
 * - POST /api/auth/login — authenticate an existing user
 * - POST /api/auth/refresh — rotate refresh token, get new JWT pair
 * - GET /api/auth/me — return the currently authenticated user
 */
export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/register
   *
   * Register a new user. Hashes the password with bcrypt, inserts the user,
   * generates a JWT pair, and returns tokens with the user object.
   *
   * Public endpoint — no authentication required.
   */
  fastify.post<{ Body: RegisterRequest }>(
    '/api/auth/register',
    { schema: registerSchema },
    async (request, reply) => {
      try {
        const result = await registerUser(request.body);
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof DuplicateEmailError) {
          return reply.status(409).send({
            error: 'Conflict',
            message: err.message,
            statusCode: 409,
          });
        }

        if (err instanceof ValidationError) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: err.message,
            statusCode: 400,
          });
        }

        // Unexpected error — let the global error handler deal with it
        throw err;
      }
    },
  );

  /**
   * POST /api/auth/login
   *
   * Authenticate a user with email and password. Returns a JWT pair and user
   * info on success. Returns 401 for bad credentials (same message for wrong
   * email and wrong password — no user enumeration).
   *
   * Public endpoint — no authentication required.
   */
  fastify.post<{ Body: LoginRequest }>(
    '/api/auth/login',
    { schema: loginSchema },
    async (request, reply) => {
      try {
        const result = await loginUser(request.body);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof InvalidCredentialsError) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: err.message,
            statusCode: 401,
          });
        }

        // Unexpected error — let the global error handler deal with it
        throw err;
      }
    },
  );

  /**
   * POST /api/auth/refresh
   *
   * Validate a refresh token, rotate it (delete old, create new), and return
   * a fresh JWT pair. The old refresh token is invalidated immediately.
   *
   * Public endpoint — no authentication required (the refresh token IS the credential).
   */
  fastify.post<{ Body: RefreshRequest }>(
    '/api/auth/refresh',
    { schema: refreshSchema },
    async (request, reply) => {
      try {
        const result = await refreshTokenService(request.body.refresh_token);
        return reply.status(200).send(result);
      } catch (err) {
        if (err instanceof TokenRefreshError) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: err.message,
            statusCode: 401,
          });
        }

        throw err;
      }
    },
  );

  /**
   * GET /api/auth/me
   *
   * Return the currently authenticated user. Looks up the full user row
   * from the database to include all fields (avatarUrl, createdAt, etc.).
   * The auth middleware (preHandler hook) verifies the Bearer token and
   * attaches the decoded payload to `request.user`.
   *
   * Protected endpoint — requires a valid Bearer token.
   */
  fastify.get('/api/auth/me', async (request, reply) => {
    const jwtUser = request.user;
    if (!jwtUser) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required.',
        statusCode: 401,
      });
    }

    const userRow = findById(jwtUser.userId);
    if (!userRow) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found.',
        statusCode: 401,
      });
    }

    return reply.status(200).send({
      user: {
        id: userRow.id,
        email: userRow.email,
        displayName: userRow.display_name,
        avatarUrl: userRow.avatar_url,
        createdAt: userRow.created_at,
      },
    });
  });
}
