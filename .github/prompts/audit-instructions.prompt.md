---
description: 'Audit all Horizon instruction files for contradictions, gaps, inefficiencies, and alignment with desired AI behaviors. Fixes contradictions and inefficiencies automatically. Reports all changes. Use when: /audit-instructions "the AI keeps doing X and I want it to do Y" or /audit-instructions "make sure all prompts enforce Z".'
---

# Audit Instructions

Audit every instruction file in the Horizon project for contradictions, gaps, inefficiencies, and misalignment with desired AI behaviors. Fix what can be fixed automatically. Report everything.

## Input

{{input}}

---

## ⚠️ Hard Rules

### Scope: Instruction Files Only

This prompt audits and modifies **only** instruction files — never source code, configuration, or data. Instruction files are:

| Directory                                | Purpose                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| `.github/prompts/*.prompt.md`            | Slash-command workflows (`/review`, `/implement`, `/fix`, etc.) |
| `.github/skills/*/SKILL.md`              | Reusable skill procedures (`git-commit`, `pre-task`, etc.)      |
| `.github/instructions/*.instructions.md` | Domain-specific rules loaded by `applyTo` patterns              |
| `.github/conventions/*.md`               | Shared conventions and guardrails                               |
| `.github/agents/*.agent.md`              | Custom agent mode definitions                                   |
| `.github/copilot-instructions.md`        | Global project-wide instructions                                |
| `.github/skills/*/references/*.md`       | Skill reference documents                                       |

### Do Not Change Behavior Unless Instructed

- **Fix automatically:** contradictions between files, duplicate rules, dead references, broken applyTo patterns, inefficiencies (overly large files that should be lazy-loaded, redundant checks across files)
- **Require confirmation:** adding new rules, removing existing rules, changing workflow order, modifying acceptance criteria patterns, altering safety gates

### When in Doubt, Ask

If the user's description is ambiguous, or a potential fix might change intended behavior, **pause and ask** before editing.

---

## Phase 1 — Parse the Audit Request

Extract from `{{input}}`:

1. **The observed behavior** — what did the AI do?
2. **The desired behavior** — what should it do instead?
3. **The context** — when/where did this happen (specific prompt, skill, phase)?
4. **The severity** — is this a minor annoyance or a workflow-breaking issue?

If any of these are unclear, ask ONE round of clarifying questions.

---

## Phase 2 — Inventory All Instruction Files

Build a complete inventory. Every file must be accounted for:

1. List every `.md` file under `.github/` (use `file_search` with glob `.github/**/*.md`)
2. For each file, extract:
   - **Frontmatter** — `description`, `applyTo` patterns, `name`
   - **Trigger conditions** — "Use when:" sections, skill descriptions
   - **Rules/constraints** — hard rules, never-violate lists, checklist items
   - **Cross-references** — references to other files, skills, or prompts

---

## Phase 3 — Structural Audit (Automatic Fixes)

Check every instruction file for structural issues. Fix automatically:

### 3.1 Dead References

- Does file A reference file B, but file B doesn't exist?
- Does a skill's `description` mention a trigger that no prompt invokes?
- Does an `applyTo` pattern match no files in the workspace?

**Fix:** Remove dead references. Add a comment noting what was removed.

### 3.2 Duplicate Rules

- Is the same constraint stated in both `copilot-instructions.md` AND `guardrails.instructions.md`?
- Do two skills describe the same workflow?
- Does a skill overlap with a prompt?

**Fix:** Keep the rule in the most specific file. Remove from the more general file. Add a cross-reference instead.

### 3.3 Inefficient Loading

- Is a large instruction file loaded eagerly (no `applyTo` pattern, or `applyTo: **`)?
- Could a section be split into a lazy-loaded reference document?
- Does `copilot-instructions.md` contain detail that should be in a lazy-loaded conventions file?

**Fix:** Move detailed sections to lazy-loaded files. Keep summaries in always-loaded files. The `guardrails.instructions.md` pattern is the reference: always-loaded file is lean, detail lives in `conventions/guardrails.md`.

### 3.4 Broken Frontmatter

- Is YAML frontmatter malformed?
- Is `applyTo` using a glob that won't match (wrong directory, wrong extension)?
- Is `description` missing required "Use when:" triggers?

**Fix:** Repair YAML, correct globs, add "Use when:" if missing.

### 3.5 Contradictory Rules

- Does file A say "always do X" but file B says "never do X"?
- Does a prompt's phase order conflict with a skill's step order?
- Do two files specify different test commands for the same workspace?

**Fix:** Resolve in favor of the more specific file. If equally specific, prefer the newer/more recently updated file. Note the conflict in the report.

---

## Phase 4 — Behavioral Alignment Audit

Map the user's described behavior to the instruction files:

### 4.1 Find the Gap

1. Identify which instruction file(s) govern the context where the behavior occurred
2. Determine whether the existing instructions:
   - **Missing:** No rule covers the desired behavior → need to add one
   - **Contradictory:** A rule exists but says the opposite → need to fix it
   - **Ambiguous:** A rule exists but is too vague to enforce the behavior → need to clarify it
   - **Unenforced:** A rule exists but no checkpoint/gate enforces it → need to add a gate

### 4.2 Check for Downstream Effects

Before adding or changing a rule, verify:

1. Does this change affect any existing prompt's phase order or gate checks?
2. Does this contradict any existing convention or design decision?
3. Will this make other workflows harder or more verbose?

If yes, pause and present the conflict to the user.

### 4.3 Apply the Fix

Based on the gap type:

| Gap Type      | Action                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing rule  | Add to the most specific applicable file. For broad rules → `copilot-instructions.md`. For domain-specific → `instructions/*.md`. For workflow-specific → the relevant prompt or skill. |
| Contradictory | Remove or update the conflicting rule. Explain the resolution.                                                                                                                          |
| Ambiguous     | Add specificity: concrete examples, "do this, not that" pairs, explicit gate checks.                                                                                                    |
| Unenforced    | Add a phase gate, a checklist item, or a verification step that catches the violation.                                                                                                  |

---

## Phase 5 — Efficiency Audit

Look for instruction files that create unnecessary work:

### 5.1 Overly Verbose Files

- Is a prompt repeating the same convention checklist that already lives in `guardrails.instructions.md`?
- Is a skill restating rules from `copilot-instructions.md` instead of cross-referencing?

**Fix:** Replace duplication with a cross-reference. Example: instead of repeating the convention checklist, say "Run the convention checklist from `.github/instructions/guardrails.instructions.md`."

### 5.2 Redundant Phase Gates

- Does a prompt have a "verify build" step AND the post-task skill also verifies the build?
- Do two prompts both require reading the same design doc section?

**Fix:** Consolidate. If post-task already handles build verification, prompts should reference post-task instead of repeating it.

### 5.3 Missing Early-Exit Paths

- Does a prompt force all phases even when early phases find no issues?
- Is there a "skip to Phase N if X" path that would save time?

**Fix:** Add early-exit conditions where appropriate. Example: "If no violations found in Phase 3, skip Phase 6 (auto-fix)."

---

## Phase 6 — Report

Present a structured audit report:

```markdown
## Audit Report — [date]

### Request

[User's description of desired behavior]

### Files Audited

[N] instruction files across [categories]

### Structural Fixes (Automatic)

| File | Issue | Fix |
| ---- | ----- | --- |
| ...  | ...   | ... |

### Behavioral Alignment

| Desired Behavior | Gap Type | File Updated | Change |
| ---------------- | -------- | ------------ | ------ |
| ...              | ...      | ...          | ...    |

### Efficiency Improvements

| File | Issue | Fix |
| ---- | ----- | --- |

### Items Requiring Confirmation

| Item | Reason | Recommendation |
| ---- | ------ | -------------- |
| ...  | ...    | ...            |

### Summary

- [N] structural fixes applied automatically
- [N] behavioral alignments applied
- [N] efficiency improvements made
- [N] items deferred for user confirmation
- [N] instruction files remain unchanged
```

---

## Post-Audit Verification

After all changes:

1. Check that no `applyTo` patterns are broken (affected files still exist)
2. Verify no cross-references point to deleted content
3. Confirm all frontmatter is valid YAML
4. If any prompt was modified, note that `/review-and-fix` should be run on the changes

---

## Anti-Patterns

- ❌ Editing source code files (this is an instruction audit, not a code review)
- ❌ Adding rules that change existing workflow behavior without user confirmation
- ❌ Removing safety gates (never-violate rules, push/commit restrictions, destructive-action confirmations)
- ❌ Duplicating rules across files instead of cross-referencing
- ❌ Making always-loaded files larger instead of moving detail to lazy-loaded files
- ❌ Changing skill trigger descriptions without checking if they would cause false-positive skill loading
