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

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// -----------------------------------------------------------------------------
// Fastify
// -----------------------------------------------------------------------------

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Register CORS (allow all origins in dev; tighten in production)
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

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
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info({ port: PORT, host: HOST }, 'Horizon server is ready');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

export { fastify, io };
