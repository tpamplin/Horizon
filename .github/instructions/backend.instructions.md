---
description: 'Use when editing server code, Fastify routes, services, WebSocket handlers, database models, or migration files under server/.'
applyTo: 'server/**'
---

# Backend Guidelines (Fastify + SQLite + Socket.IO)

## Fastify Patterns

### Route Files

- One file per resource in `server/src/routes/` (e.g., `auth.ts`, `campaigns.ts`, `characters.ts`)
- Each exports a **Fastify plugin** — an async function that registers routes
- Route handlers follow: validate input → call service → format response
- Use Fastify's built-in JSON Schema validation for request bodies

```typescript
// Pattern: server/src/routes/example.ts
export default async function exampleRoutes(fastify) {
  fastify.get('/api/example', async (request, reply) => {
    const result = await exampleService.getData();
    return { data: result };
  });
}
```

### Services

- Business logic lives in `server/src/services/` as pure functions or classes
- Services don't know about HTTP — they receive data and return data
- Services call model functions for database access — never write raw SQL in a service

### Models (Database)

- All database queries go through functions in `server/src/models/`
- Each model file corresponds to a database table or domain
- Use `better-sqlite3` synchronous API — no async/await needed for queries
- Import the singleton db instance from `server/src/models/db.ts`

```typescript
// Pattern: server/src/models/users.ts
import { db } from './db.js';

export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}
```

### Middleware

- Auth middleware in `server/src/middleware/auth.ts` — verifies JWT, attaches `req.user`
- Apply to all routes except `/api/auth/*` and `/api/health`
- Error handler catches and formats errors consistently
- Request logger for debugging

## WebSocket Patterns

- One handler file per domain in `server/src/ws/` (e.g., `sheets.ts`, `chat.ts`, `dice.ts`, `map.ts`)
- Each exports a `register(io, socket)` function
- Validate JWT on the `auth` event before allowing any other events
- Join the campaign room on `campaign:join` — `socket.join('campaign:${id}')`
- Broadcast to the room, not individual sockets — `io.to('campaign:${id}').emit(...)`
- Register all handlers in `server/src/ws/index.ts`

## Database (SQLite via better-sqlite3)

- **Synchronous API** — `db.prepare().all()` for SELECT, `.run()` for INSERT/UPDATE/DELETE, `.get()` for single row
- **Singleton** — import `db` from `server/src/models/db.ts`
- **WAL mode** — enabled for concurrent read performance: `PRAGMA journal_mode=WAL;`
- **Foreign keys** — enforced: `PRAGMA foreign_keys=ON;`
- **JSON columns** — use for flexible data (`sheet_data`, `content`). Query with SQLite JSON functions
- **Migrations** — additive only. Never edit an applied migration. Create a new one.

## Migrations

- **File naming:** `NNN_description.sql` — sequential (e.g., `001_initial.sql`, `002_add_map_pins.sql`)
- **Runner:** `server/src/migrations/runner.ts` — reads `.sql` files, tracks applied in `_migrations` table
- **Schema:** every migration is a new file. If you need to change a table, create a new migration with `ALTER TABLE`
- **JSON columns** for flexible schemas — `sheet_data TEXT` (stored as JSON string)

## Test Organization

- **Service tests:** `server/src/services/__tests__/` — unit tests for business logic
- **Route tests:** use Fastify's `inject()` method for HTTP-level testing without a running server
- **Model tests:** use in-memory SQLite (`:memory:`) for database tests — fast, isolated, no cleanup needed
- **Run with:** `npm test -w server`

## Auth

- JWT access tokens: 15-minute expiry, sent as `Authorization: Bearer <token>` header
- Refresh tokens: 7-day expiry, opaque, stored hashed in `refresh_tokens` table, rotated on each use
- Passwords hashed with bcrypt (10 rounds)
- `req.user` available on all authenticated routes — contains `{ id, email, display_name }`

## File Storage

- Uploads saved to `data/uploads/` — organized by type (`backgrounds/`, `portraits/`, `audio/`)
- No cloud storage — local filesystem only
- Back up the `data/` directory regularly (it's a single folder alongside the SQLite file)
