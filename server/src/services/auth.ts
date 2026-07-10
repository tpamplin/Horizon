// =============================================================================
// Horizon — Auth Service
// =============================================================================
// Business logic for authentication: registration, login, token refresh.
// Pure functions that operate on validated input — they don't know about HTTP.
// =============================================================================

import { randomUUID, randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config.js';
import { findByEmail, findById, createUser, type UserRow } from '../models/user.js';
import {
  storeRefreshToken,
  findRefreshTokenByHash,
  deleteRefreshToken,
} from '../models/refresh-token.js';
import type { RegisterRequest, LoginRequest, AuthResponse, User } from 'shared';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_BYTES = 48; // 48 bytes → 96 hex chars
const REFRESH_TOKEN_DAYS = 7;

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

/** Thrown when a user attempts to register with an email that already exists. */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`A user with email "${email}" already exists.`);
    this.name = 'DuplicateEmailError';
  }
}

/** Thrown when a refresh token is invalid, expired, or not found. */
export class TokenRefreshError extends Error {
  constructor(message = 'Invalid or expired refresh token.') {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

/** Thrown when login credentials are invalid (wrong email or password). */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

/** Thrown when input validation fails. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Map a snake_case database row to a camelCase User object for API responses. */
function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

/** Generate a short-lived JWT access token. */
function generateAccessToken(userRow: UserRow): string {
  return jwt.sign(
    {
      userId: userRow.id,
      displayName: userRow.display_name,
      email: userRow.email,
    },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRY,
    },
  );
}

/** Generate an opaque refresh token and store its SHA-256 hash in the database. */
function generateAndStoreRefreshToken(userId: string): string {
  const token = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  storeRefreshToken({ userId, tokenHash, expiresAt });

  return token;
}

// -----------------------------------------------------------------------------
// Input Validation
// -----------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegisterInput(dto: RegisterRequest): void {
  const errors: string[] = [];

  if (!dto.email || typeof dto.email !== 'string') {
    errors.push('Email is required.');
  } else if (!EMAIL_REGEX.test(dto.email)) {
    errors.push('Email must be a valid email address.');
  }

  if (!dto.password || typeof dto.password !== 'string') {
    errors.push('Password is required.');
  } else if (dto.password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }

  if (!dto.displayName || typeof dto.displayName !== 'string') {
    errors.push('Display name is required.');
  } else if (dto.displayName.trim().length < 2) {
    errors.push('Display name must be at least 2 characters.');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(' '));
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Register a new user.
 *
 * Validates input, checks for duplicate email, hashes the password with bcrypt,
 * inserts the user, generates a JWT pair, stores the refresh token hash, and
 * returns the auth response.
 *
 * @throws {ValidationError} If input validation fails.
 * @throws {DuplicateEmailError} If a user with the given email already exists.
 */
export async function register(dto: RegisterRequest): Promise<AuthResponse> {
  // 1. Validate input
  validateRegisterInput(dto);

  // 2. Check for duplicate email
  const existing = findByEmail(dto.email);
  if (existing) {
    throw new DuplicateEmailError(dto.email);
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  // 4. Create user
  const userId = randomUUID();
  const userRow = createUser({
    id: userId,
    email: dto.email,
    displayName: dto.displayName.trim(),
    passwordHash,
  });

  // 5. Generate tokens
  const accessToken = generateAccessToken(userRow);
  const refreshToken = generateAndStoreRefreshToken(userId);

  // 6. Return response (never include password_hash)
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: toUser(userRow),
  };
}

/**
 * Authenticate a user with email and password.
 *
 * Finds the user by email, compares the password against the stored bcrypt hash,
 * generates a fresh JWT pair, stores the refresh token, and returns the auth
 * response. Returns the same generic error for wrong email AND wrong password
 * to prevent user enumeration.
 *
 * @throws {InvalidCredentialsError} If email not found or password doesn't match.
 */
export async function login(dto: LoginRequest): Promise<AuthResponse> {
  // 1. Find user by email
  const userRow = findByEmail(dto.email);
  if (!userRow) {
    throw new InvalidCredentialsError();
  }

  // 2. Compare password
  const passwordValid = await bcrypt.compare(dto.password, userRow.password_hash);
  if (!passwordValid) {
    throw new InvalidCredentialsError();
  }

  // 3. Generate tokens
  const accessToken = generateAccessToken(userRow);
  const refreshToken = generateAndStoreRefreshToken(userRow.id);

  // 4. Return response (never include password_hash)
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: toUser(userRow),
  };
}

/**
 * Refresh an access token using a valid refresh token (rotation).
 *
 * Hashes the incoming token, looks it up, verifies it hasn't expired,
 * deletes the old row, creates a new refresh token, and returns a fresh
 * JWT pair. The old refresh token is invalidated immediately.
 *
 * @throws {TokenRefreshError} If the token hash is not found or the token has expired.
 */
export async function refreshToken(token: string): Promise<AuthResponse> {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  // Look up the token hash
  const row = findRefreshTokenByHash(tokenHash);

  if (!row) {
    throw new TokenRefreshError();
  }

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    // Delete expired token
    deleteRefreshToken(row.id);
    throw new TokenRefreshError();
  }

  // Delete the old token (rotation)
  deleteRefreshToken(row.id);

  // Find the user
  const userRow = findById(row.user_id);
  if (!userRow) {
    throw new TokenRefreshError();
  }

  // Generate new pair
  const accessToken = generateAccessToken(userRow);
  const newRefreshToken = generateAndStoreRefreshToken(userRow.id);

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    user: toUser(userRow),
  };
}
