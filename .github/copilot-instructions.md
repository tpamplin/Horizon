# Horizon — Copilot Instructions

> **Project:** Horizon — a theater-of-the-mind virtual tabletop (VTT)
> **Phase:** 0 (Project Scaffold) — see `plan/implementation-plan.md` for full roadmap
> **Design doc:** `plan/vtt-design-doc.md`

---

## What We're Building

Horizon is a **theater-of-the-mind VTT** for a custom Kids on Bikes-based TTRPG. Unlike grid-and-token VTTs (Foundry, Roll20), Horizon is built for **narrative play** — no tactical battle maps, no token positioning. The "table" is a shared space for character sheets, dice, atmosphere, and custom game mechanics.

**Core principles (always follow these):**

1. **Theater of the mind** — no tactical battle maps or token positioning. City-scale maps (Leaflet/OpenStreetMap) for narrative positioning are the one exception.
2. **Interconnected sheets** — GM and players share real-time character data; GM can edit anything on the fly.
3. **Atmosphere over simulation** — dynamic backgrounds set the mood, not tactical grids.
4. **Server-authoritative dice** — all RNG happens server-side. The dice animation is cosmetic. Results are logged and immutable.
5. **Custom mechanics engine** — game systems are self-contained plugins with a standard interface.

---

## Tech Stack

| Layer         | Technology                                   | Notes                                                       |
| ------------- | -------------------------------------------- | ----------------------------------------------------------- |
| **Frontend**  | React 19 + TypeScript + Vite                 | Plain CSS (no Tailwind), dark theme                         |
| **Backend**   | Node.js + Fastify                            | Single process handles HTTP + WebSocket                     |
| **Real-time** | Socket.IO                                    | Attached to Fastify server                                  |
| **Database**  | SQLite via `better-sqlite3`                  | Single file, zero config, JSON columns for flexible schemas |
| **Auth**      | JWT (`jsonwebtoken`) + bcrypt                | 15-min access token + 7-day rotating refresh token          |
| **Maps**      | Leaflet + OpenStreetMap                      | Free, no API key; narrative positioning only                |
| **Testing**   | Vitest (unit/integration) + Playwright (E2E) |                                                             |
| **Monorepo**  | npm workspaces                               | `client/`, `server/`, `shared/`                             |

**Hard constraint:** Zero budget. No paid services, no API keys that require credit cards. Everything must run in a single Node.js process against a single SQLite file.

---

## Project Structure

```
horizon/
├── client/                    # React 19 + Vite frontend
│   └── src/
│       ├── components/        # UI components by domain
│       │   ├── sheets/        # Character + NPC sheet views
│       │   ├── chat/          # Chat panel, dice embeds
│       │   ├── dice/          # Dice tray, roll history
│       │   ├── background/    # Dynamic background layer
│       │   ├── gm/            # GM tools: sheet dock, quick-edit
│       │   ├── npc-gen/       # NPC generator UI
│       │   ├── maps/          # City map: Leaflet, pins, location search
│       │   └── mechanics/     # Pluggable mechanic components
│       ├── hooks/             # useWebSocket, useAuth, useCampaign, useSheet, useMapSync
│       ├── mechanics/         # Built-in mechanic plugins (wild-magic/, fear-tracker/)
│       ├── stores/            # Zustand stores (authStore, campaignStore, wsStore, mapStore)
│       ├── api/               # API client with JWT interceptor
│       └── styles/            # CSS custom properties (dark theme)
├── server/                    # Fastify + Socket.IO backend
│   └── src/
│       ├── routes/            # REST API route handlers
│       ├── services/          # Business logic: auth, dice, campaign, sheet, map-pins
│       ├── ws/                # WebSocket event handlers (sheets, chat, dice, map, mechanics)
│       ├── mechanics/         # Server-side mechanic handlers (wild-magic, fear-tracker)
│       ├── models/            # Database query functions
│       ├── middleware/        # Auth (JWT), error handler, rate limiter, logger
│       └── migrations/        # SQL migration files (additive only!)
├── shared/                    # Shared between client and server
│   ├── types.ts               # User, Campaign, Character, NPC, Session, DiceRoll, ChatMessage, etc.
│   ├── rules/                 # Pure functions: dice pool parser, stat calculations, fear rules
│   └── mechanic-interface.ts  # GameMechanic, MechanicProps, MechanicEvent, MechanicResult
└── plan/                      # Design documents (read-only reference)
    ├── vtt-design-doc.md
    └── implementation-plan.md
```

---

## Where We Are (Current Phase)

We are in **Phase 0 — Project Scaffold.** The monorepo skeleton does not exist yet. The first task is to create the directory structure, initialize npm workspaces, and get an empty server + client booting.

**What exists:** Design doc and implementation plan only.
**What to build now:** Everything in Phase 0 of `plan/implementation-plan.md`.
**What NOT to build yet:** Any actual features (auth, sheets, dice, etc.). Phase 0 is just the skeleton.

---

## How to Work on This Project

### Starting from scratch

```bash
# 1. Create monorepo structure
mkdir horizon && cd horizon
mkdir -p client/src server/src shared plan
mkdir -p .github

# 2. Initialize packages (see plan/implementation-plan.md §0.1–0.4)
npm init -y
cd shared && npm init -y && cd ..
cd server && npm init -y && cd ..
cd client && npm create vite@latest . -- --template react-ts && cd ..

# 3. Configure npm workspaces in root package.json
# 4. npm install dependencies
# 5. Create .vscode/launch.json and .vscode/tasks.json (see implementation plan §0.1.6–0.1.7)
```

### Daily development

```bash
npm run dev          # Starts both server (:3001) and client (:5173)
npm run build        # Builds all packages
npm test             # Runs Vitest suite
npm run dev -w server  # Start only the server
npm run dev -w client  # Start only the client
```

Or use VS Code: `Ctrl+Shift+D` → pick **"🎯 Launch Both"** → F5.

### Running tests

```bash
npm test                  # All tests
npm test -w shared        # Shared package tests only
npm test -w server        # Server tests only
npx playwright test       # E2E tests (from Phase 2 onward)
```

---

## Coding Conventions

### General

- **TypeScript everywhere.** No `any` without a comment explaining why.
- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- **Branch naming:** `phase/N-short-description` (e.g., `phase/1-auth`, `phase/2-sheet-sync`).
- **PR into `main`.** Self-review before marking ready.

### Frontend (client/)

- **Components:** One component per file. Named export for the component, default export only for pages.
- **Styling:** Plain CSS with CSS custom properties. No CSS-in-JS, no Tailwind, no Sass. Dark theme variables defined in `client/src/styles/theme.css`.
- **State:** Zustand stores in `client/src/stores/`. One store per domain (auth, campaign, websocket, map, sheets).
- **API calls:** Use the shared `api` client from `client/src/api/client.ts`. Never call `fetch()` directly.
- **WebSocket:** Use the `useWebSocket` hook from `client/src/hooks/useWebSocket.ts`. Never create raw Socket.IO connections in components.
- **Routing:** React Router v6+. Protected routes use `AuthGuard` wrapper.

### Backend (server/)

- **Routes:** One file per resource in `server/src/routes/`. Each exports a Fastify plugin.
- **Services:** Business logic in `server/src/services/`. Services are pure functions or classes — they don't know about HTTP.
- **WebSocket:** One file per event domain in `server/src/ws/` (e.g., `sheets.ts`, `chat.ts`, `dice.ts`, `map.ts`). Each exports a handler registration function.
- **Database:** All queries go through functions in `server/src/models/`. Never write raw SQL in routes or services.
- **Middleware:** Auth middleware verifies JWT and attaches `req.user`. Apply to all routes except `/api/auth/*` and `/api/health`.

### Shared (shared/)

- **Pure functions only.** No side effects, no database access, no HTTP. Just types, rules, and interfaces.
- **Types:** All domain types in `shared/types.ts`. Import from `shared` in both client and server.
- **Rules:** Dice logic, stat calculations, fear rules, and any other game mechanics that don't need the database. Both client and server can import them.

### Database

- **Migrations are additive.** Never edit a migration that's been applied. Create a new one.
- **JSON columns** for flexible data (`sheet_data`, `content`). SQLite JSON functions for querying into them when needed.
- **Migration runner** is in `server/src/migrations/runner.ts`. It reads `.sql` files and tracks applied migrations in a `_migrations` table.

---

## How to Add Things

### Adding a new REST endpoint

1. Add the route handler in `server/src/routes/<resource>.ts`
2. Add business logic in `server/src/services/<resource>.ts`
3. Add database queries in `server/src/models/<resource>.ts`
4. Update `shared/types.ts` with any new types
5. Update `plan/vtt-design-doc.md` §7 (API Sketch)

### Adding a new WebSocket event

1. Add the handler in `server/src/ws/<domain>.ts`
2. Register it in `server/src/ws/index.ts`
3. Add a client-side hook in `client/src/hooks/use<Feature>Sync.ts`
4. Update the Zustand store for that domain
5. Update `plan/vtt-design-doc.md` §4 with the new WS events

### Adding a new game mechanic

1. Define the mechanic interface in `shared/mechanic-interface.ts` (or extend it)
2. Add server handler in `server/src/mechanics/<mechanic-name>.ts`
3. Add React component in `client/src/mechanics/<mechanic-name>/`
4. Register both in their respective registries
5. Enable it per-campaign via `PUT /api/campaigns/:id/mechanics`

### Adding a new React component

1. Create `ComponentName.tsx` in the appropriate `client/src/components/<domain>/` folder
2. Style it with a matching `ComponentName.css` file (or add styles to `theme.css` for shared variables)
3. Export it from the domain's `index.ts` barrel file
4. Add a Zustand store slice if it manages state that other components need

---

## Important Constraints

### Do NOT:

- **Do not add a tactical battle map** (grid, tokens, fog of war, measurements). City-scale maps with pins are fine. Tactical combat maps violate the core design principle.
- **Do not add paid services or APIs that require a credit card.** Everything must run on the free tier (Render, Railway, or a home machine).
- **Do not add a separate database server** (PostgreSQL, MySQL, etc.). SQLite is the database. The design doc §2.2 explains why.
- **Do not add client-side dice RNG.** All dice rolls go through the server. The animation is purely cosmetic.
- **Do not edit existing migration files.** Add new ones.
- **Do not use CSS frameworks** (Tailwind, Bootstrap, etc.). Plain CSS with custom properties only.
- **Do not add Redux or other state management.** Zustand is already chosen.

### Always:

- **Read the design doc** (`plan/vtt-design-doc.md`) before making architectural decisions.
- **Check the implementation plan** (`plan/implementation-plan.md`) for the current phase and task dependencies.
- **Keep the single-process architecture.** The server is one Node.js process. No microservices, no worker threads (unless there's a very good reason).
- **Write tests** for shared rules and server services from Phase 1 onward.

---

## Safety Guardrails

### Never Violate

- **Never `git push` unless the user explicitly asks** or you're following an approved workflow (push.prompt.md).
- **Never `git commit` unless** the user asks or you're executing an approved workflow.
- **Never install new dependencies** without user confirmation.
- **Never bypass safety checks** (`--no-verify`, `--force`).
- **Never revert formatting-only changes** — commit them in a dedicated formatting commit.
- **All compile errors must be resolved before commit or push.**

### Confirm Before

- Deleting files or branches
- Dropping database tables or deleting data/
- `git push --force` or `git reset --hard`
- Amending published commits
- Modifying shared infrastructure or architectural patterns

### Task-Weight Tiering

Match ceremony to the work. Decide the tier first, then act:

- **Light** (< 5 min: typo, comment, one-liner): just confirm the branch is sane and run a compile check if you touched code. No checklists.
- **Standard** (focused change across a few files): run the pre-task and post-task skills (`.github/skills/pre-task/SKILL.md`, `.github/skills/post-task/SKILL.md`).
- **Full** (story or multi-file feature): run the complete `/implement` flow (decompose → subtasks → execute → verify).

### Autopilot Override

When you hit an explicit pause gate, STOP. Stopping IS the correct completion. Gates include:

- Missing required component (no plain CSS styles defined for a new UI element)
- Destructive change needed (file deletion, schema drop)
- New dependency required (npm install without prior approval)
- Blocking test failure (zero failures is the only acceptable state)
- Jira MCP failure (auth/connection — do not proceed on assumptions)
- Ambiguous acceptance criteria (ask, don't guess)

### Intent & Architecture

- Treat the design doc (`plan/vtt-design-doc.md`) and implementation plan as the intent baseline.
- Don't change architecture without discussion — present alternatives as recommendations.
- Don't build features from future phases (check `plan/implementation-plan.md` first).
- Only update documentation when the change makes it stale — don't proactively rewrite docs.

---

## Key Design Decisions (Don't Overturn These)

These are settled. Don't propose alternatives unless you have a very strong reason:

| Decision                         | Rationale                                                             | See                    |
| -------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| **Theater of the mind**          | No tactical maps. City maps with pins for narrative positioning only. | Design doc §6          |
| **Server-authoritative dice**    | Server generates, logs, broadcasts all rolls.                         | Design doc §6          |
| **JSON sheets in SQLite**        | Flexible schema, no migrations for stat changes.                      | Design doc §2.2, §6    |
| **Pluggable mechanics**          | Game systems are self-contained plugins with a standard interface.    | Design doc §4.8        |
| **Field-level last-write-wins**  | Sheet conflict resolution with presence indicators and undo.          | Design doc §6          |
| **JWT + refresh token rotation** | 15-min access token, 7-day refresh token, rotated on each use.        | Design doc §4.1        |
| **Render free tier hosting**     | 750 hrs/mo free. Fallback: Railway or home machine.                   | Design doc §2.1        |
| **Zustand for state**            | Lightweight, good middleware for WebSocket sync.                      | Implementation plan §9 |
| **Plain CSS**                    | Zero dependencies. Dark theme via CSS custom properties.              | Design doc §2          |

---

## Reference Documents

These are your primary sources of truth. Read them when you need context:

| Document                      | Purpose                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `plan/vtt-design-doc.md`      | Full system design: features, architecture, data model, API sketch, open questions |
| `plan/implementation-plan.md` | Task-level breakdown by phase with dependencies and milestones                     |

---

## Quick Context for Common Questions

**Q: Why not use Foundry/Roll20?**
A: Those are map-first VTTs. Horizon is theater-of-the-mind — built for narrative play with interconnected sheets and custom mechanics. Also, this is a custom Kids on Bikes system, not D&D.

**Q: Why SQLite instead of PostgreSQL?**
A: Zero cost, zero setup, single file. For 4–8 concurrent users, SQLite is more than fast enough. Migration to PostgreSQL is straightforward if the app ever needs it.

**Q: Why not use Google Maps?**
A: Requires an API key and billing account. OpenStreetMap via Leaflet is free, no key needed, and works for narrative positioning. Google Maps satellite view is a possible future option.

**Q: Why plain CSS instead of Tailwind?**
A: The existing Wild Magic Generator already has a dark theme in plain CSS. Zero dependencies, full control, no build-step overhead for styles.

**Q: What about mobile?**
A: Phase 4. The layout uses CSS Grid that reflows to single-column on small screens. Not a priority for Phase 0–3.
