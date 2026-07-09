---
description: 'Use when writing or running tests for Horizon. Covers Vitest commands, test organization, coverage targets, and testing tiers.'
applyTo: '**/*.test.*'
---

# Testing Conventions

## Test Commands (always from repo root)

```bash
npm test                  # All workspaces (shared → server → client)
npm test -w shared        # Shared package only (pure functions, rules, types)
npm test -w server        # Server package only (services, routes, models)
npm test -w client        # Client package only (components, hooks, stores)
npx playwright test       # E2E tests (from Phase 2 onward)
```

**Never `cd` into subdirectories to run tests.** Always use npm workspace commands from the repo root.

## Targeted Tests

```bash
# Run a specific test file
npm test -w shared -- --run path/to/test.test.ts

# Run tests matching a pattern
npm test -w server -- -t "dice pool parser"

# Watch mode for development
npm test -w shared -- --watch
```

## Test Organization

| Workspace | Test Location                         | What to Test                                                                   |
| --------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `shared/` | `shared/rules/__tests__/`             | Pure functions: dice parser, stat calculations, fear rules. No mocking needed. |
| `server/` | `server/src/services/__tests__/`      | Business logic: auth, dice, campaign, sheet services                           |
| `server/` | `server/src/routes/__tests__/`        | HTTP endpoints via Fastify `inject()`                                          |
| `server/` | `server/src/models/__tests__/`        | Database queries with in-memory SQLite (`:memory:`)                            |
| `client/` | `client/src/components/**/__tests__/` | Component rendering, user interactions                                         |
| `client/` | `client/src/hooks/__tests__/`         | Custom hooks: useAuth, useWebSocket, useSheetSync                              |
| `client/` | `client/src/stores/__tests__/`        | Zustand store logic                                                            |

## Coverage Targets

| Workspace          | Target      | Rationale                                                          |
| ------------------ | ----------- | ------------------------------------------------------------------ |
| `shared/rules/`    | ≥90%        | Pure functions — easy to test, critical for game logic correctness |
| `server/services/` | ≥80%        | Business logic — where bugs hurt most                              |
| `server/routes/`   | ≥70%        | Integration-level — tested via inject()                            |
| `client/`          | Best effort | UI testing has diminishing returns; prioritize critical paths      |

## Testing Tiers

- **During implementation:** targeted tests only (`npm test -w <workspace> -- --run <file>`)
- **At subtask completion:** workspace-level tests (`npm test -w <workspace>`)
- **At story wrap-up:** full suite (`npm test` — all workspaces)
- **Before PR:** full suite + `npm run build`
- **E2E:** Playwright from Phase 2 onward (`npx playwright test`)

## Testing Rules

1. **Never ignore a failing test** — fix it immediately. Zero failures is the only acceptable state for committed code.
2. **Run from repo root** — never `cd` into subdirectories to run tests.
3. **Pre-existing failures must be documented** — if you encounter test failures in code you didn't change, note them explicitly rather than silently skipping.
4. **In-memory SQLite for model tests** — use `:memory:` for fast, isolated, no-cleanup database tests.
5. **Fastify inject() for route tests** — don't start a real server; use `app.inject()` for HTTP-level testing.
6. **Pure functions first** — shared rules should have the highest coverage because they're the easiest to test and the most critical for correctness.

## PR Readiness Gate

Before creating a pull request, run these checks in order:

```bash
# 1. Full build — zero TypeScript errors
npm run build

# 2. Full test suite — zero failures
npm test

# 3. Migration change detection (if server/ touched)
.github/scripts/detect-migration-changes.ps1

# 4. Branch up to date with main
git fetch origin main && git merge origin/main
```

Only create the PR when all four pass. If the full suite is slow, at minimum run the affected workspace tests.

## Accessibility Testing

For UI stories, manual verification is required:

- [ ] All interactive elements are keyboard-navigable (Tab, Enter, Escape)
- [ ] Focus management works (focus trapping in modals, focus restoration on close)
- [ ] ARIA labels on icon-only buttons and form inputs
- [ ] Dark theme contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

Automated accessibility testing via Playwright axe-core can be added in Phase 4+.
