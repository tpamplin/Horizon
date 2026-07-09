---
name: pre-task
description: 'Mandatory pre-flight checklist before any code change. Use when: starting any task, beginning a story, before writing code. Covers git state, build check, instruction loading, and in-progress work detection.'
---

# Pre-Task Checklist

Steps before beginning a **Standard** or **Full** code change. Match ceremony to task weight.

## When to Use

- **Light** (< 5 min: typo, one-liner, comment): skip this skill — just confirm branch is sane and run a compile check if you touched code.
- **Standard** (focused change across a few files): run steps 1–3.
- **Full** (story or multi-file feature): run all steps.

## Steps

### 1. Check git state

```bash
git status && git branch --show-current
```

Know the branch and uncommitted state before touching anything. Confirm you're on the correct branch — Horizon uses `phase/N-short-description` branch naming. If you're on `main`, ask whether to create a phase branch.

### 2. Verify build passes

```bash
npm run build
```

Zero errors required before starting work. If the build is already broken, fix pre-existing failures or note them explicitly before proceeding. Never start new work on a broken build.

### 3. Read relevant instruction files

- **Always:** `.github/copilot-instructions.md` — project context, tech stack, conventions, constraints
- **Always:** `plan/implementation-plan.md` — know the current phase; don't build things from future phases
- **If touching `server/`:** `.github/instructions/backend.instructions.md`
- **If touching `client/`:** check for existing Zustand stores, hooks, and plain CSS patterns to reuse
- **If touching `shared/`:** remember — pure functions only, no side effects, no HTTP, no database access

### 4. Check for in-progress work

```bash
git log --oneline -10
```

Review recent commits. If mid-story, review the Jira story and any open subtasks via Atlassian MCP. **Never start new work if a subtask is In Progress — finish it first.** If the story is Done but the branch has uncommitted work, resolve before starting new work.

### 5. Verify the phase

Open `plan/implementation-plan.md` and confirm:

- The current phase matches what you're about to build
- You're not building features from future phases
- Any dependencies from prior phases are actually complete

---

## Horizon-Specific Checks

- No tactical battle map code (grid, tokens, measurements). City-scale maps via Leaflet are the only map feature.
- Plain CSS only — no Tailwind, Bootstrap, or CSS-in-JS.
- All dice RNG is server-side. Client animation is cosmetic.
- SQLite only — no PostgreSQL, MySQL, or separate database servers.
- Single Node.js process — no microservices or worker threads.
- Zustand for state management — no Redux.
- Zero budget — no paid APIs, no services requiring credit cards.
