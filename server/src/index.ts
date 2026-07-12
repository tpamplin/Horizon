// =============================================================================
// Horizon — Server Entry Point
// =============================================================================
// Boots Fastify on the configured port and attaches Socket.IO for real-time
// communication. This is the single process that handles all HTTP and
// WebSocket traffic.
// =============================================================================

import { createServer } from 'node:http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import './models/db.js'; // Initialize database on startup
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { loggerOnRequest, loggerOnResponse } from './middleware/logger.js';
import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import characterRoutes from './routes/characters.js';
import npcRoutes from './routes/npcs.js';
import uploadRoutes from './routes/upload.js';
import itemTemplateRoutes from './routes/item-templates.js';
import abilityTemplateRoutes from './routes/ability-templates.js';

// -----------------------------------------------------------------------------
// Fastify
// -----------------------------------------------------------------------------

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

// Register CORS — allow the Vite dev server origin
await fastify.register(cors, {
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://127.0.0.1:5173',
  ],
  credentials: true,
});

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------

// Request logger — onRequest captures start time, onResponse logs completion
fastify.addHook('onRequest', loggerOnRequest);
fastify.addHook('onResponse', loggerOnResponse);

// JWT authentication — verifies Bearer tokens on protected routes
fastify.addHook('preHandler', authMiddleware);

// Global error handler — consistent JSON error responses
fastify.setErrorHandler(errorHandler);

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

// Auth routes (public — register, login, refresh, me)
await fastify.register(authRoutes);

// Campaign routes (protected — require JWT)
await fastify.register(campaignRoutes);

// Character routes (protected — require JWT)
await fastify.register(characterRoutes);

// NPC routes (protected — require JWT)
await fastify.register(npcRoutes);

// Upload routes (protected POST, public GET for serving files)
await fastify.register(uploadRoutes);

// Item template routes (protected — require JWT)
await fastify.register(itemTemplateRoutes);

// Ability template routes (protected — require JWT)
await fastify.register(abilityTemplateRoutes);

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------

fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// -----------------------------------------------------------------------------
// Socket.IO
// -----------------------------------------------------------------------------

const httpServer = createServer(fastify.server);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  fastify.log.info({ socketId: socket.id }, 'Socket.IO client connected');

  socket.on('disconnect', (reason) => {
    fastify.log.info({ socketId: socket.id, reason }, 'Socket.IO client disconnected');
  });
});

// -----------------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------------

try {
  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info({ port: config.port, host: config.host }, 'Horizon server is ready');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export { fastify, io };
