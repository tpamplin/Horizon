---
description: 'Create a Jira story for Horizon with summary, why-it-matters, work-involved, and acceptance criteria. Use when writing new feature stories.'
---

# Create Story

Create a Jira story for the **Horizon** project (HZN) using the Atlassian MCP (`wollonof.atlassian.net`). Stories follow a theater-of-the-mind VTT convention: vertical slices across the npm workspace layers (shared → server → client).

## Mandatory Format

```markdown
[Brief overview of the feature and what it accomplishes for players or the GM]

**Why it matters**

- Player/GM value point 1 — what does this let someone do at the table?
- Player/GM value point 2
- Narrative/immersion value (if applicable)

**Work involved (brief)**

- Shared: types, rules, interfaces (if new data shapes or game logic)
- Server: routes, services, WebSocket handlers, database queries
- Client: components (one per file), hooks, Zustand store updates, plain CSS
- Testing: Vitest unit/integration (shared + server), Playwright E2E (from Phase 2 onward)
- Accessibility: keyboard navigation, focus management, ARIA labels for UI stories
```

## Rules

1. **Read the design doc first** — check `plan/vtt-design-doc.md` and `plan/implementation-plan.md` for the current phase and architecture decisions before writing the story.
2. **Read existing code** — review the codebase to ground requirements, but do NOT reference specific files, classes, or code by name in the story. Stories define work and outcomes; impl details are decided at execution time.
3. **Deliver user-visible value** — every story must do something the GM or a player can see/use. No backend-only or tests-only stories.
4. **Layer ordering** — shared types/rules first, then server endpoints/handlers, then client UI/hooks/stores. Within a story, list work in this order.
5. **Include accessibility** — at least one acceptance criterion for UI stories (ARIA, keyboard nav, focus management). No CSS framework — plain CSS custom properties only.
6. **Naming** — action + domain (e.g., "Add character stat roll button", "Sync sheet edits in real time"); no vague titles.
7. **Call out dependencies** — note upstream story or epic blockers explicitly. Reference the impl plan phase.
8. **Testing expectations** — Vitest unit/integration for shared rules and server services; Playwright E2E from Phase 2 onward. No paid testing services.
9. **Conventional commits** — mention expected commit scopes: `shared`, `server`, `client`, `plan`, `vscode`, `deps`.

## Horizon-Specific Constraints

- No tactical battle maps (theater of the mind). City-scale maps (Leaflet/OpenStreetMap) are the one exception.
- No Tailwind, Bootstrap, or CSS-in-JS. Plain CSS with `theme.css` custom properties.
- All dice RNG is server-side. Client dice animation is cosmetic only.
- SQLite only — no PostgreSQL, MySQL, or separate database servers.
- Single Node.js process — no microservices or worker threads.
- Zustand for state management — no Redux.
- Zero budget — no paid APIs, no services requiring credit cards.

## Inputs Needed

- Feature description or user goal
- Parent epic key (e.g., HZN-4)
- Target phase from the implementation plan
- Target domain (shared/server/client)
