---
name: post-task
description: 'Mandatory post-task verification after any code change. Use when: finishing a task, completing a story, before committing. Covers compile check, test run, convention validation, and pattern capture.'
---

# Post-Task Checklist

Steps after completing a **Standard** or **Full** code change. Match ceremony to task weight.

## When to Use

- **Light** (< 5 min): skip — just run a compile check for the workspace you touched.
- **Standard** (focused change): run steps 1–3.
- **Full** (story or multi-file feature): run all steps.

## Steps

### 1. TypeScript compile check

```bash
npm run build -w <touched-workspace>
```

If you touched multiple workspaces, run `npm run build` to check all. Zero errors required before proceeding.

### 2. Run targeted tests

```bash
npm test -w <touched-workspace>
```

Zero failures in changed code. If pre-existing failures exist in untouched code, document them explicitly — do not silently skip them. Fix any failures in code you changed.

### 3. Horizon convention check

Verify the following before committing:

- [ ] **No CSS frameworks** — Plain CSS with `theme.css` custom properties only. No Tailwind, Bootstrap, or CSS-in-JS.
- [ ] **No tactical battle maps** — No grid, tokens, fog of war, or measurement tools. City-scale maps (Leaflet/OpenStreetMap) are the only map code allowed.
- [ ] **No paid APIs** — No references to services requiring credit cards or API keys.
- [ ] **No external databases** — SQLite only. No PostgreSQL, MySQL, or separate database servers.
- [ ] **No Redux** — Zustand for state management only.
- [ ] **Migrations additive** — If you touched a migration file, it must be a new file (never edited an existing one).
- [ ] **Server-authoritative dice** — All random generation uses `server/src/services/dice.ts`. No client-side RNG.
- [ ] **Single process** — No worker threads, no microservices.

### 4. Run full test suite (Full tasks only)

```bash
npm test
```

All workspaces. Zero failures. This is the gate before pushing story-level work.

### 5. Git cleanliness check

```bash
git status
```

All changes must be committed or intentionally staged. Nothing left behind accidentally. Check that `node_modules/`, `dist/`, `data/`, and `.env` are not staged.

### 6. Pattern capture (optional but encouraged)

If you learned something reusable — a gotcha, a pattern, a convention — add it to `.github/instructions/learned-rules.md` under the appropriate domain section (Server, Client, Shared, Tooling). This prevents rediscovery. Examples:

- "better-sqlite3 is synchronous — no async/await needed"
- "Vite dev proxy must specify both /api and /ws paths"
- "Zustand stores should be one per domain (auth, campaign, websocket, map, sheets)"
