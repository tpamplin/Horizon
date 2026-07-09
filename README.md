<h1 align="center">🌅 Horizon</h1>
<p align="center"><strong>A theater-of-the-mind virtual tabletop</strong></p>
<p align="center">Built for narrative play &middot; No tactical maps &middot; Just shared imagination</p>

---

Horizon is a **virtual tabletop** designed for a custom **Kids on Bikes-based TTRPG**. Unlike grid-and-token VTTs like Foundry or Roll20, Horizon is built for **narrative, theater-of-the-mind play** — the table is a shared space for character sheets, dice, atmosphere, and custom game mechanics.

## Why Horizon?

- 🧠 **Theater of the mind** — No battle maps, no tokens, no measurements. The GM's narration sets the scene; dynamic backgrounds set the mood.
- 🗺️ **City maps for narrative positioning** — Real OpenStreetMap city maps with pins for keeping track of where everyone is in town. No grid — just a shared sense of place.
- 📋 **Interconnected character sheets** — GM and players share real-time character data. GM can edit anything on the fly.
- 🎲 **Server-authoritative dice** — All rolls happen server-side. Results are logged, immutable, and broadcast to everyone.
- 🎨 **Dynamic backgrounds** — GM sets the scene with atmospheric images. No tactical grids.
- ⚙️ **Pluggable mechanics engine** — Custom game systems (Wild Magic, Fear/Sanity, Chase sequences) are self-contained plugins with a standard interface.

## Tech Stack

| Layer     | Technology                                             |
| --------- | ------------------------------------------------------ |
| Frontend  | React 19 + TypeScript + Vite (plain CSS, dark theme)   |
| Backend   | Node.js + Fastify (single process: HTTP + WebSocket)   |
| Real-time | Socket.IO                                              |
| Database  | SQLite via `better-sqlite3` (single file, zero config) |
| Auth      | JWT + bcrypt (15-min access + 7-day refresh token)     |
| Maps      | Leaflet + OpenStreetMap (free, no API key)             |
| Testing   | Vitest + Playwright                                    |
| Monorepo  | npm workspaces (`client/`, `server/`, `shared/`)       |

**Zero budget.** No paid services, no API keys that require credit cards. Everything runs in a single Node.js process against a single SQLite file.

## Quick Start

```bash
# Clone
git clone https://github.com/tpamplin/Horizon.git
cd Horizon

# Install all dependencies (monorepo)
npm install

# Start both server and client
npm run dev
# Server → http://localhost:3001
# Client → http://localhost:5173

# Or use VS Code:
# Ctrl+Shift+D → "🎯 Launch Both" → F5
```

### Available Scripts

| Command                 | Description                        |
| ----------------------- | ---------------------------------- |
| `npm run dev`           | Start server + client concurrently |
| `npm run dev -w server` | Start server only                  |
| `npm run dev -w client` | Start client only                  |
| `npm run build`         | Build all packages                 |
| `npm test`              | Run all tests (Vitest)             |
| `npm run lint`          | Lint all TypeScript files          |
| `npm run format`        | Format with Prettier               |

## Project Structure

```
horizon/
├── client/              # React 19 + Vite frontend
│   └── src/
│       ├── components/  # UI by domain (sheets, chat, dice, maps, etc.)
│       ├── hooks/       # useWebSocket, useAuth, useCampaign, etc.
│       ├── mechanics/   # Pluggable mechanic plugins
│       ├── stores/      # Zustand stores
│       └── styles/      # CSS custom properties (dark theme)
├── server/              # Fastify + Socket.IO backend
│   └── src/
│       ├── routes/      # REST API handlers
│       ├── services/    # Business logic
│       ├── ws/          # WebSocket event handlers
│       ├── mechanics/   # Server-side mechanic handlers
│       ├── models/      # Database query functions
│       └── migrations/  # SQL migration files
├── shared/              # Shared types, rules, interfaces
├── plan/                # Design documents
│   ├── vtt-design-doc.md
│   └── implementation-plan.md
└── .github/             # Copilot instructions + prompts
```

## Development Status

**Phase 0 — Project Scaffold** (in progress)

| Phase                   | Status         | Description                                      |
| ----------------------- | -------------- | ------------------------------------------------ |
| 0 — Scaffold            | 🟡 In progress | Monorepo skeleton, tooling, configs              |
| 1 — Foundation MVP      | ⬜ Planned     | Auth, campaigns, sheets, dice, chat, backgrounds |
| 2 — Real-Time Core      | ⬜ Planned     | WebSocket sync, live sheets, presence, sessions  |
| 3 — Mechanics & Tools   | ⬜ Planned     | Wild Magic, NPC generator, GM screen, city maps  |
| 4 — Atmosphere & Polish | ⬜ Planned     | Music, spotlight mode, transitions, mobile       |
| 5 — Ecosystem           | ⬜ Planned     | Import/export, sharing, public API               |

See [`plan/implementation-plan.md`](plan/implementation-plan.md) for the full task-level roadmap.

## Design Philosophy

Horizon is deliberately **not** a grid-and-token VTT. There is no canvas, no fog of war, no measurement tools. The game happens in everyone's heads — Horizon provides the shared reference points: character sheets, dice results, atmospheric backgrounds, and city-scale maps for spatial context. Every design decision flows from this principle.

For the full design rationale, architecture, data model, and API sketch, see [`plan/vtt-design-doc.md`](plan/vtt-design-doc.md).

## License

MIT
