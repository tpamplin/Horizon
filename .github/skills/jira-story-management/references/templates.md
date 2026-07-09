# Jira Writeup Templates (Horizon)

## Story Format

- **Summary:** action + domain, specific and actionable (3–7 words)
- **Description:** follows the mandatory Horizon story structure

### Story Description Structure

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

**Acceptance Criteria**

- [Specific, testable outcome 1]
- [Specific, testable outcome 2]
- [Accessibility criterion for UI stories]

**Dependencies**

- Upstream: [parent epic or prerequisite story keys]
- Blocked by: [any blockers]
- Target phase: [from implementation plan]
```

### Example: Dice Engine Story

```markdown
Create the server-authoritative dice roller service and REST endpoint. Players request rolls; server generates, logs, and returns results. CSS keyframe animation is purely cosmetic.

**Why it matters**

- Dice are the core mechanic of the VTT — every stat check, conflict, and wild magic surge depends on this
- Server-side RNG ensures fair, auditable rolls — no player can fudge results
- Stat-integrated quick-roll makes the character sheet interactive

**Work involved (brief)**

- Shared: verify dice pool parser and roll resolver from Phase 0 (shared/rules/dice.ts)
- Server: create dice service (server/src/services/dice.ts) with RNG + dice_logs insert, POST /api/dice/roll endpoint, GET /api/campaigns/:id/dice-log endpoint
- Client: DiceTray component with custom roll input + Quick Roll buttons, DiceAnimation CSS keyframe spin, StatRollButton on character sheets, DiceLogPanel scrollable history, DiceCard embed for chat
- Testing: Vitest unit tests for dice service + route tests via Fastify inject()
- Accessibility: keyboard-operable roll buttons, ARIA labels on dice results

**Acceptance Criteria**

- POST /api/dice/roll with { pool: "3d6", reason: "Cognition check", character_id } returns valid result
- Dice results are logged to dice_logs table with roller, pool, individual results, total, reason, timestamp
- Click a stat on a character sheet → correct dice pool is rolled → CSS animation plays → result appears
- DiceCard embed auto-posts to chat on every roll
- DiceLogPanel shows paginated history per session
- All dice roll buttons are keyboard-operable (Enter/Space to roll)
- GET /api/campaigns/:id/dice-log returns paginated results

**Dependencies**

- Upstream: HZN-25 (Phase 1 epic)
- Blocked by: Phase 1.3 Character Sheets (stats drive dice pools), Phase 0 Shared Rules (dice pool parser)
- Target phase: Phase 1
```

## Epic Format

- **Summary:** short name with phase prefix (e.g., "Phase 1.1 — Auth")
- **Description:** Goal → Dependencies → Stories to Decompose (checklist by section) → Milestone → Reference

### Epic Description Structure

```markdown
## Goal

[What this epic delivers. One paragraph.]

**Depends on:** [Prerequisite epics or phases]

### Stories to Decompose

- [ ] Task ID: Brief description — what it does
- [ ] Task ID: Brief description — what it does

**Milestone:** [How we know this epic is done — concrete, testable]

**Est. effort:** [Time estimate for solo developer]

## Reference

- Implementation plan: plan/implementation-plan.md §X.Y
- Design doc: plan/vtt-design-doc.md §X.Y
```

> **Important:** Do NOT include recommended story order, story lists with full descriptions, or other story-planning content in the epic description. That's what child issues are for. The epic description should contain the checklist of what needs to be decomposed — not the decomposition itself.
