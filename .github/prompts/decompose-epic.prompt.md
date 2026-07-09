---
description: 'Decompose a Horizon Jira epic into ordered stories with vertical value slicing, layer ordering (shared→server→client), and testability validation.'
---

# Decompose Epic

Break down a Horizon Jira epic (HZN project, `wollonof.atlassian.net`) into well-ordered stories. Use the Atlassian MCP to create stories directly in Jira. Stories must follow Horizon's monorepo layer ordering and theater-of-the-mind design principles.

## Procedure

1. **Read the epic** — fetch via Atlassian MCP, understand scope and acceptance criteria
2. **Read the design docs** — check `plan/vtt-design-doc.md` for architecture decisions and `plan/implementation-plan.md` for phase-level task breakdown
3. **Inspect existing code** — ground stories in real files/modules; note what already exists vs what needs building
4. **Draft stories by layer** — smallest vertical-value slices ordered: shared types/rules → server endpoints/handlers → client components/hooks/stores
5. **Order by dependency** — enforce testable delivery order:
   - Shared types and pure rules (no server/client dependency)
   - Server routes, services, WS handlers (depend on shared)
   - Client UI, hooks, stores (depend on server API contract)
   - Integration/E2E tests and polish
6. **Run sequencing check:**
   - Can the GM or player initiate the feature action?
   - Does the system process/respond to the action?
   - Can the user view/manage the resulting state?
   - Is the story independently testable (curl/server log for backend, UI interaction for client)?
7. **Run self-reflection rubric** — evaluate against the quality criteria below; score ≥4/5 on each before presenting
8. **Create in Jira** — one story at a time in execution order so HZN issue numbers match the sequence. **After each story is created, immediately call `editJiraIssue` to set `{"parent": {"key": "HZN-XX"}}` linking it to the parent epic.** The `createJiraIssue` tool does NOT auto-link stories to epics in next-gen Jira projects. Verify the parent link before creating the next story.

## Story Rules

- Each story must deliver user-visible value — something the GM or a player can see, do, or experience
- **Layer ordering:** shared first, then server, then client. A story may span layers but must list work in this order
- Include at least one accessibility acceptance criterion for every UI story (ARIA, keyboard nav, focus)
- Naming: action + domain (e.g., "Add stat-to-dice roll integration", "Sync character sheets in real time"); no vague titles
- Call out upstream dependencies explicitly — reference parent epic and prerequisite story keys
- Each story must be independently verifiable: the server story must be testable via curl or Vitest; the client story must be testable by interacting with the UI
- **Every story MUST be linked to its parent epic** via `editJiraIssue` immediately after creation. Orphaned stories (no epic parent) are a defect.

## Anti-Patterns to Avoid

- Backend-only stories with no user-facing change
- Placeholder UIs without functionality
- Massive unrelated bundles ("Add auth, dice, and chat")
- Refactors masquerading as value ("Clean up server structure" with no feature change)
- Components without plain CSS styling, accessibility, or tests
- Stories that assume Tactical Battle Maps (no grid, no tokens, no measurements)
- Stories that add paid services or external database dependencies

## Horizon-Specific Constraints

- No tactical battle maps — theater of the mind. City-scale maps (Leaflet/OpenStreetMap) are the only map feature.
- Plain CSS only — no Tailwind, no CSS-in-JS. Dark theme via `theme.css` custom properties.
- All dice RNG is server-side. Animation is cosmetic.
- SQLite via better-sqlite3 — no PostgreSQL, MySQL, or separate DB servers.
- Single Node.js process — Fastify handles HTTP + Socket.IO in one process.
- Zustand for state — no Redux.
- Zero budget — no paid APIs, no services requiring credit cards.

## Quality Statement

After decomposition, present a brief quality statement:

```
Evaluation criteria applied: [list 3-7 brief criteria names]
Stories created: [count]
Sequencing: shared → server → client order verified
```

## Inputs Needed

- Epic key (e.g., HZN-4) or description
- Current phase from the implementation plan
- Any known constraints or sequencing preferences
