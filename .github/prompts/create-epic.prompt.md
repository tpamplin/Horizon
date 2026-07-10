---
description: 'Create a detailed Jira epic for Horizon from a user description. Expands rough ideas into a full epic with goal, story checklist, milestone, and design-doc grounding so nothing is forgotten.'
---

# Create Epic

Turn a user's feature description into a detailed Horizon Jira epic (HZN project, `wollonof.atlassian.net`) and write it directly to Jira via Atlassian MCP. The epic captures the full scope — goal, dependencies, stories-to-decompose checklist, milestone, and reference — so the team can decompose and implement it later without losing context.

## Procedure

### 1. Understand the Intent

Parse the user's description. Ask clarifying questions if the scope, target phase, or user value is ambiguous. Pin down:

- **What** — the feature or capability being built
- **Who** — GM, player, or both
- **Why** — the table-level value (immersion, speed, fairness, narrative power)
- **When** — target phase from `plan/implementation-plan.md`
- **Constraints** — anything the user explicitly rules in or out

### 2. Ground in the Project

1. **Read the design doc** — `plan/vtt-design-doc.md` for architecture decisions relevant to the feature
2. **Read the implementation plan** — `plan/implementation-plan.md` for the target phase and dependencies
3. **Inspect existing code** — note what already exists vs. what needs building. Do NOT reference specific files or classes by name in the epic — epics define scope, not implementation details
4. **Check existing epics** — search Jira (HZN project) for related or overlapping epics to avoid duplication

### 3. Draft the Epic

Build the epic description using the mandatory Horizon Epic Format:

```markdown
## Goal

[One paragraph. What this epic delivers. Concrete outcomes, not aspirations.
Who benefits (GM/player/both) and what they can do when it's done.]

**Depends on:** [Prerequisite epics or phases, or "None" if it stands alone]

### Stories to Decompose

- [ ] Brief description — what the story delivers (one line each)
- [ ] Brief description — what the story delivers (one line each)
- [ ] ...

**Milestone:** [How we know this epic is done — concrete, testable, observable.
Not "code is written." Think: "A player can register, log in, and access a protected page."
Or: "The GM can create a campaign, invite players, and see them join in real time."]

**Est. effort:** [Time estimate for solo developer: hours/days/weeks]

## Reference

- Implementation plan: plan/implementation-plan.md §X.Y
- Design doc: plan/vtt-design-doc.md §X.Y
```

#### Story Checklist Rules

- Each checklist item is a **one-line summary** of a story to be created later (via `/decompose-epic` or `/create-story`). Do NOT write full story descriptions in the epic.
- Order checklist items by **layer dependency**: shared types/rules → server endpoints/handlers → client UI/hooks/stores → integration/polish
- Every checklist item must deliver **user-visible value** — something the GM or a player can see, do, or experience
- Include testing and accessibility as explicit checklist items where applicable (e.g., "Add Vitest coverage for dice pool parser edge cases", "Add keyboard navigation and ARIA labels for the login form")
- 5–15 checklist items is typical. Fewer than 5 may be too coarse; more than 15 may need splitting into multiple epics

### 4. Run Quality Check (Internal)

Before creating in Jira, verify the epic against these criteria. Revise until all pass:

- **Goal clarity** — can someone who hasn't read the design doc understand what this delivers?
- **Value anchoring** — is the table-level benefit clear (not just technical deliverables)?
- **Checklist completeness** — are all layers covered (shared → server → client → testing → accessibility)?
- **Dependency honesty** — are prerequisite epics/phases correctly identified?
- **Milestone testability** — can you objectively verify "yes, this is done"?
- **Horizon compliance** — no battle maps, no Tailwind/CSS-in-JS, no paid APIs, no external databases, no Redux
- **Scope discipline** — no features from future phases, no gold-plating

### 5. Create in Jira

1. Call `createJiraIssue` with:
   - `projectKey: "HZN"`
   - `issueTypeName: "Epic"`
   - `summary`: short name with phase prefix (e.g., "Phase 1.2 — Character Sheets")
   - `description`: the full epic body from Step 3
2. **Wait for the response** — capture the HZN epic key
3. Report the created epic key and URL to the user

### 6. Present Summary

After creation, present a concise summary:

```
Epic created: HZN-XX — "Phase X.Y — Feature Name"
URL: https://wollonof.atlassian.net/browse/HZN-XX
Stories to decompose: N items
Next step: /decompose-epic HZN-XX
```

## Horizon-Specific Constraints (Never Violate)

- **Theater of the mind** — no tactical battle maps, grid, tokens, or measurements. City-scale maps (Leaflet/OpenStreetMap) for narrative positioning are the one exception
- **Server-authoritative dice** — all RNG is server-side. Client animation is cosmetic
- **SQLite only** — no PostgreSQL, MySQL, or separate database servers
- **Single process** — no microservices or worker threads
- **Plain CSS** — no Tailwind, Bootstrap, or CSS-in-JS. Dark theme via `theme.css` custom properties
- **Zustand** — no Redux or other state management
- **Zero budget** — no paid APIs, no services requiring credit cards
- **Layer ordering** — shared types/rules → server → client → integration tests

## Anti-Patterns

- Vague goals like "Improve the UI" or "Add features"
- Epics that are really just one big story (decompose it now)
- Epics that span multiple unrelated domains (split them)
- Checklist items that are backend-only with no user-facing change
- Checklist items that are pure refactors with no feature change
- Epics that assume infrastructure from future phases
- Duplicating an existing epic — search Jira first
