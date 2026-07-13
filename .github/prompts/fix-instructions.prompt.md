---
description: 'Quick-fix an instruction file to align it with a desired AI behavior. No full audit — just find the gap, fix it, report it. Use when: you just described a behavior issue and want it fixed without a full audit, or after /audit-instructions identified a specific gap to close. Use: /fix-instructions "the AI should do X when Y happens".'
---

# Fix Instructions

Quickly identify and fix the specific instruction gap causing an unwanted AI behavior — no full audit. Finds the relevant instruction file(s), determines what's missing or wrong, applies the fix, and reports.

## Input

{{input}}

---

## ⚠️ Hard Rules

- **Scope: instruction files only** — `.github/prompts/`, `.github/skills/`, `.github/instructions/`, `.github/conventions/`, `.github/agents/`, `.github/copilot-instructions.md`. Never touch source code.
- **Minimal changes** — fix only what's needed to address the described behavior. Don't restructure files or add unrelated rules.
- **Never remove safety gates** — push restrictions, commit confirmations, destructive-action warnings.
- **If the fix isn't obvious, ask** — don't guess at what rule to add or where.

---

## Phase 1 — Understand the Problem

From `{{input}}`, extract:

1. **The behavior** — what the AI did that was wrong (or what it should do but doesn't)
2. **The context** — which workflow, prompt, or situation triggers this
3. **The fix direction** — what should happen instead

If ambiguous, ask ONE clarifying question.

---

## Phase 2 — Find the Relevant Files

Don't inventory everything. Search surgically:

1. **If the user mentions a specific prompt or skill** (e.g., "during `/review`") → start with that file
2. **If the behavior is cross-cutting** (e.g., "the AI never checks X before Y") → check `copilot-instructions.md` and `guardrails.instructions.md`
3. **If the behavior is domain-specific** (e.g., "server routes are missing validation") → check `instructions/backend.instructions.md`

Read only the files likely to govern the behavior. Stop when you find where the rule should live.

---

## Phase 3 — Identify the Gap

For each relevant file, determine:

| Gap Type       | Check                                   | Example                                              |
| -------------- | --------------------------------------- | ---------------------------------------------------- |
| **Missing**    | No rule exists for this behavior        | "No rule says to ask before creating files"          |
| **Wrong**      | A rule exists but says the opposite     | "Rule says auto-commit, but user wants confirmation" |
| **Vague**      | A rule exists but isn't specific enough | "Rule says 'be careful' but doesn't define careful"  |
| **Unenforced** | A rule exists but has no checkpoint     | "Rule says check build, but no gate enforces it"     |

---

## Phase 4 — Apply the Fix

Based on the gap type:

| Gap        | Action                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| Missing    | Add the rule to the most specific applicable file. Prefer domain instructions over global copilot-instructions. |
| Wrong      | Update the rule. If the old rule was intentional (e.g., a safety gate), pause and ask.                          |
| Vague      | Add specificity: concrete examples, "do this, not that", explicit conditions.                                   |
| Unenforced | Add a gate: a checklist item, a phase step, a "stop and ask" condition.                                         |

**Placement rules:**

- Rules affecting all workflows → `copilot-instructions.md`
- Rules for server code → `instructions/backend.instructions.md`
- Rules for client code → `copilot-instructions.md` (client conventions section)
- Rules for a specific prompt → that prompt's `.prompt.md`
- Rules for a specific skill → that skill's `SKILL.md`
- Gotchas and learned patterns → `instructions/learned-rules.md`

---

## Phase 5 — Verify

1. Re-read the changed file — does the fix read clearly?
2. Check for contradictions — does the new rule conflict with any other instruction you read?
3. If the fix adds a gate or checkpoint, verify it won't break the workflow for the common case.

---

## Phase 6 — Report

```markdown
## Fix Applied

### Problem

[One-line description of the behavior issue]

### Root Cause

[Which file was missing/wrong, and why]

### Fix

[What was changed and where]

### Files Modified

- `path/to/file.md` — [what changed]
```

If no fix was possible (ambiguous request, would break a safety gate, requires architectural discussion), report why and ask the user for direction.

---

## Anti-Patterns

- ❌ Doing a full .github/ inventory when the user named a specific prompt
- ❌ Adding rules to copilot-instructions.md when they belong in a domain-specific instructions file
- ❌ Changing workflow phase order without confirmation
- ❌ Removing or weakening safety gates
- ❌ Adding verbose prose to already-large files — prefer cross-references
- ❌ Fixing problems the user didn't describe
