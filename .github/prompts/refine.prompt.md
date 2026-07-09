---
mode: agent
description: "Refine AI workflows to fix a problem or achieve a desired behavior. Use when AI isn't following the right process, or when you want to change how the AI handles certain situations."
---

# Refine AI Workflows

The user has identified a problem with AI behavior or wants to change how the AI handles certain situations. Surgically update the instruction system so the desired behavior is reliably produced.

## Input

{{input}}

## Process

### Phase 1 — Understand the Goal

1. Parse the user's input into: problem statement / desired outcome, trigger conditions, scope.
2. If ambiguous, ask ONE round of clarifying questions.

### Phase 2 — Comprehensive Discovery

Read the `.github/` directory thoroughly:

1. **Always read:** `copilot-instructions.md`, `instructions/guardrails.instructions.md`
2. **Read if related:** All files in `instructions/`, `skills/`, `prompts/`, `conventions/` that touch the affected scope
3. **Catalog:** files that already address part of the problem (may need updating), files that conflict (must fix), gaps (may need new content)

### Phase 3 — Plan Changes

State: which files to modify/create and why, what each change achieves.

### Phase 4 — Implement

- **Clarity over brevity** — rules must be unambiguous
- **Single source of truth** — each rule in ONE canonical location
- **Imperative voice** — "Always do X" or "Never do Y"
- **Context-aware placement** — scoped instruction files > root copilot-instructions
- **Preserve existing intent** — don't remove rules unless explicitly asked

### Phase 5 — Self-Review

Check for: contradictions, ambiguity, completeness, duplication, scoping, readability. Fix issues found.

### Phase 6 — Report

Present: summary of changes, files modified/created, trade-offs, offer to test.

## Constraints

- Never weaken safety rules unless explicitly asked
- Never remove content without replacement unless clearly obsolete
- When in doubt, ask — limit to one round
