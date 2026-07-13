// =============================================================================
// Horizon — Upload Routes
// =============================================================================
// Fastify plugin for file uploads (portraits, backgrounds). Accepts base64-
// encoded images via JSON POST and saves them to the configured upload
// directory. Also serves uploaded files via GET /uploads/:filename.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum file size in bytes (5 MB). */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types for uploaded images. */
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** Maps MIME type to file extension. */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parse a base64 data URL into its MIME type and raw buffer.
 *
 * @example "data:image/png;base64,iVBORw0KG..."
 * @returns `{ mimeType, buffer }` or null if the string is not a valid data URL.
 */
function parseBase64DataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  // Match: data:<mime>;base64,<data>
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1]!;
  const base64Data = match[2]!;

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Plugin
// -----------------------------------------------------------------------------

export default async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // Ensure upload directory exists
  const uploadDir = config.uploadDir;
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
    fastify.log.info({ uploadDir }, 'Created upload directory');
  }

  /**
   * POST /api/upload
   *
   * Accept a base64-encoded image and save it to the upload directory.
   * Returns the public URL path for the uploaded file.
   */
  fastify.post(
    '/api/upload',
    {
      schema: {
        body: {
          type: 'object',
          required: ['image'],
          properties: {
            image: {
              type: 'string',
              description: 'Base64-encoded image data URL (e.g. data:image/png;base64,...)',
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      // Auth check
      if (!request.user?.userId) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required.',
          statusCode: 401,
        });
      }

      const { image } = request.body as { image: string };

      // Parse the data URL
      const parsed = parseBase64DataUrl(image);
      if (!parsed) {
        return reply.status(400).send({
          error: 'Bad Request',
          message:
            'Invalid image format. Expected a base64 data URL (e.g. data:image/png;base64,...).',
          statusCode: 400,
        });
      }

      const { mimeType, buffer } = parsed;

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Unsupported image type "${mimeType}". Allowed types: PNG, JPEG, GIF, WebP.`,
          statusCode: 400,
        });
      }

      // Validate size
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(413).send({
          error: 'Payload Too Large',
          message: `Image size exceeds the 5 MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
          statusCode: 413,
        });
      }

      // Generate unique filename
      const ext = (MIME_TO_EXT[mimeType] ?? extname(mimeType)) || '.bin';
      const filename = `${randomUUID()}${ext}`;
      const filePath = join(uploadDir, filename);

      // Write file
      writeFileSync(filePath, buffer);

      fastify.log.info({ filename, size: buffer.length, mimeType }, 'File uploaded');

      return reply.status(201).send({
        url: `/uploads/${filename}`,
      });
    },
  );

  /**
   * GET /uploads/:filename
   *
   * Serve uploaded files. Auth is NOT required for this route —
   * the URL itself is the access key (similar to how image hosting works).
   */

  fastify.get('/uploads/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid filename.',
        statusCode: 400,
      });
    }

    const filePath = join(uploadDir, filename);

    if (!existsSync(filePath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'File not found.',
        statusCode: 404,
      });
    }

    const ext = extname(filename).toLowerCase();
    const mimeTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = mimeTypeMap[ext] ?? 'application/octet-stream';
    const buffer = readFileSync(filePath);

    return reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=31536000') // 1 year cache
      .send(buffer);
  });
}
