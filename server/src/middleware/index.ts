// =============================================================================
// Horizon — Middleware Barrel
// =============================================================================
// Re-exports all middleware modules for convenient imports.
// =============================================================================

export { authMiddleware } from './auth.js';
export type { JwtPayload } from './auth.js';

export { errorHandler } from './error.js';
export type { ErrorResponse } from './error.js';

export { loggerOnRequest, loggerOnResponse } from './logger.js';
