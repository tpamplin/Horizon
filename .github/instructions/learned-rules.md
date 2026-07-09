# Learned Rules

Patterns and gotchas discovered during Horizon development. Rules are added **bottom-up** — when something surprising happens, document it here so it doesn't happen again. The post-task skill includes a step to add to this file when something novel is discovered.

---

## Server (Fastify + SQLite + Socket.IO)

- **better-sqlite3 is synchronous** — no async/await needed for `db.prepare().all()`, `.run()`, `.get()`. The API is blocking by design.
- **WAL mode required** — enable `PRAGMA journal_mode=WAL;` on database init for concurrent read performance.
- **Foreign keys must be enabled** — `PRAGMA foreign_keys=ON;` on every connection.
- **Fastify inject() for route tests** — don't start a real server for HTTP tests. Use `app.inject()` which simulates requests in-memory.
- **In-memory SQLite for model tests** — use `:memory:` for fast, isolated, no-cleanup database tests.
- **JWT secret must be set** — `JWT_SECRET` env var required. Server should throw on startup in production if missing.
- **Socket.IO attaches to Fastify** — not a separate server. Share the same HTTP port.

<!-- Rules added as discovered during development -->

---

## Client (React 19 + Vite + Plain CSS + Zustand)

- **One component per file** — named export for the component, default export only for pages.
- **Plain CSS only** — no Tailwind, no CSS-in-JS, no Sass. Dark theme variables in `client/src/styles/theme.css`.
- **Zustand stores: one per domain** — `authStore`, `campaignStore`, `wsStore`, `mapStore`, `sheetStore`. Separate concerns.
- **API calls through client.ts** — never call `fetch()` directly. Use the shared API client with JWT interceptor.
- **WebSocket through useWebSocket hook** — never create raw Socket.IO connections in components.
- **React Router v6+** — protected routes use `AuthGuard` wrapper.

<!-- Rules added as discovered during development -->

---

## Shared (TypeScript types + pure rules)

<!-- Rules added as discovered during development -->

---

## Tooling (VS Code, Git, npm workspaces)

- **Never `cd` into subdirectories to run tests** — always use `npm test -w <workspace>` from the repo root.
- **Vite dev proxy must specify both paths** — `/api` → `http://localhost:3001` and `/ws` → `http://localhost:3001` for WebSocket.
- **npm workspaces run in parallel with `concurrently`** — root `dev` script uses `-n server,client -c blue,green`.
- **F5 launches both** — VS Code "🎯 Launch Both" profile uses concurrently. Individual profiles for server-only or client-only debugging.
- **Migrations are additive only** — never edit an applied `.sql` file. Create a new sequential one.
- **TypeScript strict mode** — `tsconfig.base.json` enforces `strict: true`. No `any` without a comment.
- **Conventional commits required** — format: `type(scope): description`. Scopes: shared, server, client, plan, vscode, deps, github.

<!-- Rules added as discovered during development -->

---

## Conventions (applied patterns)

- **Branch naming:** `phase/N-short-description` (e.g., `phase/1-auth`, `phase/2-sheet-sync`)
- **Commit style:** conventional commits (`feat(scope):`, `fix(scope):`, `chore(scope):`)
- **Scopes:** `shared`, `server`, `client`, `plan`, `vscode`, `deps`, `github`
- **PR base:** always `main`
- **Database:** migrations are additive only; never edit applied migrations
