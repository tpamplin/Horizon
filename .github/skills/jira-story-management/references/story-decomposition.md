# Story Decomposition & Quality (Horizon)

## Story Decomposition into Subtasks

- Create the smallest useful subtasks that deliver vertical value aligned to the parent story
- **Order by dependency** — shared types first, server endpoints second, client UI last
- **Create subtasks in sequential execution order** — Jira issue numbers should match the intended execution sequence
- End every story with a **Verification & Wrap-Up** subtask:
  - Run `npm test -w <affected-workspace>` — zero failures
  - Run `npm run build` — zero errors
  - Verify Horizon conventions (no Tailwind, no battle maps, no paid APIs, no external DBs, no Redux)
  - Post a summary Jira comment on the parent story (changes, tests, risks)
- Include an **Accessibility subtask** when UI changes are in scope (keyboard nav, focus management, ARIA labels)
- Each subtask includes: **Scope** bullets and **Acceptance** bullets
- Titles are specific and actionable (3–7 words)

## Story Creation Guidance (value-focused)

- Stories must deliver user-visible value — something the GM or a player can see, do, or experience
- Mandatory structure per story: Why it matters → Work involved (Shared / Server / Client / Testing / Accessibility) → Acceptance Criteria → Dependencies
- No standalone "tests only," "accessibility only," or "error handling only" stories — fold into functional scope
- Implement edge cases and failure behaviors within the same story
- Provide at least one accessibility acceptance criterion for UI stories

### Value Slicing

- Deliver smallest coherent outcome first
- Include form + validation + data + errors together
- Defer non-critical refinements only with explicit follow-ups

### Anti-Patterns to Avoid

- Backend-only stories with no user-facing change
- Placeholder UIs without functionality
- Massive unrelated bundles ("Add auth, dice, and chat")
- Refactors masquerading as value ("Clean up server structure")
- Components without plain CSS styling, accessibility, or tests
- Stories that assume tactical battle maps (grid, tokens, measurements)
- Stories that add paid services or external database dependencies

### Naming

- Action + domain (e.g., "Add stat-to-dice roll integration", "Sync character sheets in real time")
- No vague titles like "Setup" or "Improvements"

### Dependencies

- Call out upstream blockers explicitly — reference parent epic and prerequisite story keys
- Consider merging prerequisites when reasonable
- Avoid duplicate shared helpers

### Testing Expectations

- Shared rules: Vitest unit tests — pure functions, no mocking needed
- Server services: Vitest unit tests + Fastify inject() for routes + in-memory SQLite for models
- Client: Vitest component tests + hook tests + store tests
- E2E: Playwright from Phase 2 onward
- Coverage: ≥90% for shared rules, ≥80% for server services, best-effort for client

## Epic & Story Sequencing (VTT-Adapted)

When creating epics, stories, or subtasks, enforce a **testable delivery order**:

1. Shared types and pure rules (no server/client dependency)
2. Server routes, services, WS handlers (depend on shared)
3. Client UI, hooks, stores (depend on server API contract)
4. Integration/E2E tests and polish

**Sequencing check — run before creating Jira items:**

1. Can the GM or player initiate the feature action?
2. Does the system process/respond to the action?
3. Can the user view/manage the resulting state?
4. Is each story independently verifiable (curl/server log for backend, UI interaction for client)?

Always place **entry-point UX before downstream processing UX**. Example: auth must work before campaigns, campaigns before character sheets, character sheets before dice integration.

## Self-Reflection & Optimization

**BEFORE presenting any story breakdown, epic, or subtask set:**

1. **Evaluate against these criteria** (1–5 scale, internal only):
   - User value delivery (no backend-only, no tests-only stories)
   - Vertical slicing completeness (shared + server + client + tests in same story where applicable)
   - Anti-pattern avoidance (no battle maps, no Tailwind, no paid APIs, no massive bundles)
   - Clear acceptance signals (specific, testable, observable outcomes)
   - Accessibility inclusion (at least one criterion for UI stories)
   - Naming clarity (action + domain, no vague titles)
   - Test coverage expectations specified
2. **Score each criterion.** Any scoring ≤3 requires revision.
3. **Iterate** — revise and re-evaluate until all criteria ≥4 (max 2 iteration rounds).
4. **Present optimized output** with quality statement:

```
Evaluation criteria applied: [list 3-7 criteria names without scores]
```

## Code Inspection

- Inspect existing code when writing stories to ground requirements in reality
- **Do NOT reference specific files, classes, or code by name in story output.** Code may change before implementation.
- Stories define the work, method, and outcomes — not implementation details.
- Implementation decisions are made at execution time.
