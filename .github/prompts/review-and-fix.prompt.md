---
description: 'Run a full review, then immediately auto-fix all fixable findings. Combines /review and /fix-review-findings into a single pass. Use when: finishing a story, before PR, or verifying work with /review-and-fix HZN-#### or /review-and-fix "description".'
---

# Review & Fix

Run a comprehensive, multipart review of completed work, then automatically apply fixes for every fixable finding. Accepts a **Jira story key** (`/review-and-fix HZN-####`) or a **freeform description** (`/review-and-fix "added dice roller"`).

## Input

{{input}}

---

## ⚠️ Hard Rules — Never Violate

### Do Not Skip

**Every phase must complete before the next begins.** If a phase produces no output, explain why (e.g., "No violations found" or "No dependencies to check"). Never silently skip a phase. If a phase cannot complete (missing data, tool failure, ambiguous input), **stop and report why.**

### When in Doubt, Ask

If any of the following conditions arise, **pause and ask the user** before proceeding:

- An acceptance criterion is ambiguous or can be interpreted multiple ways
- A violation's severity is unclear (is it critical or standard?)
- A finding requires a design decision (e.g., "should this use a dropdown or a modal?")
- A dependency status is unknown (Jira unreachable, epic not found)
- A proposed fix could change intended behavior
- Two findings conflict with each other
- A file has changed since the review started (concurrent edit detection)
- The Jira transition workflow is non-standard and the right transition isn't obvious

**Do not guess. Do not assume. Ask.**

### Concurrent Edit Detection

If any file operation fails unexpectedly:

- `replace_string_in_file` reports "string not found" when the old-string was verified moments earlier
- A file's content differs from what was just read
- Unexplained merge conflicts or dirty-tree changes

**→ Stop immediately.** Report: "⚠️ Concurrent edit detected on `<file>` — another agent may be working on this file. Halting to avoid conflicts." Do NOT retry. Ask the user how to proceed.

---

## Phase 1 — Understand Requirements

**If a Jira key was provided** (matches `HZN-\d+`):

1. Fetch the story via Atlassian MCP (`getJiraIssue`). If the Atlassian MCP tools are disabled, activate them first. If activation or fetch fails, **stop and inform the user.**
2. Fetch subtasks and parent epic if linked.
3. Extract from the story:
   - **Acceptance Criteria** — each AC becomes a checklist item in Phase 4
   - **Work Involved** — which layers were expected to change (shared, server, client)
   - **Dependencies** — prerequisite stories that should already be complete
   - **Target phase** — from the implementation plan reference
4. Read `plan/vtt-design-doc.md` for relevant architectural decisions.
5. Read `plan/implementation-plan.md` to confirm the target phase and dependencies.

**If a freeform description was provided:**

1. Parse the description into concrete requirements:
   - What feature/change was requested?
   - What layers should be affected (shared, server, client)?
   - What are the observable outcomes?
2. **If the description is ambiguous, ask ONE round of clarifying questions, then proceed.** Do not guess.

**Gate check:** Before moving to Phase 2, confirm you have a clear list of what must be verified. If any AC or requirement is ambiguous, pause and ask.

---

## Phase 2 — Identify Changes

1. Run ALL of the following to identify changes:
   - `git status --short` — check for uncommitted work
   - `git log --oneline -10` — find the commit range to review
   - `git diff --name-only <base>..HEAD` where `<base>` is the commit BEFORE the story's work began. **Never rely on `HEAD~1` alone** — stories often span multiple commits. If unsure of the base, use `git log --oneline -15` and trace back to the last commit clearly NOT part of this story.
   - If the working tree is clean and `git diff <base>..HEAD` is empty, **expand the range** (e.g., `HEAD~5`, `HEAD~10`) until changes appear. Check `git log --oneline` to identify the commit where this story's work began.
2. **If no changes are found after exhausting all ranges, stop and report:** "No changes detected — the story may not be implemented yet. Checked: unstaged, staged, and last 10 commits. Please confirm the commit range." Do NOT proceed to Phase 3 with zero files.
3. Build a file manifest grouped by layer:

   | Layer  | Files Changed                                              |
   | ------ | ---------------------------------------------------------- |
   | Shared | `shared/src/types.ts`, `shared/src/rules/dice.ts`          |
   | Server | `server/src/routes/dice.ts`, `server/src/services/dice.ts` |
   | Client | `client/src/components/dice/DiceTray.tsx`, `DiceTray.css`  |
   | Config | `package.json`, `.vscode/`                                 |
   | Docs   | `plan/`, `README.md`                                       |

4. Read **every new file in full.** For modified files, read the changed sections plus surrounding context.

**Gate check:** Before moving to Phase 3, confirm you have read every file in the manifest. If any file is unreadable or its purpose is unclear, pause and ask.

---

## Phase 3 — Code Quality & Convention Review

For each changed file, verify against Horizon conventions. Present ALL violations as a table — do not summarize or collapse:

| File | Line/Area | Violation | Severity | Fix |
| ---- | --------- | --------- | -------- | --- |

### Convention Checklist (every item must be checked)

- [ ] **No tactical battle map code** — grid, tokens, fog of war, measurements
- [ ] **No CSS frameworks** — Tailwind, Bootstrap, CSS-in-JS. Plain CSS with `theme.css` variables only.
- [ ] **No client-side dice RNG** — all random generation goes through `server/src/services/dice.ts`
- [ ] **No Redux** — Zustand stores only. One store per domain.
- [ ] **No paid API references** — zero budget constraint
- [ ] **No external databases** — SQLite only. No PostgreSQL, MySQL, separate DB servers.
- [ ] **Migration files additive only** — new `NNN_description.sql` file, never edited existing
- [ ] **New UI components have associated plain CSS** — matching `.css` file or `theme.css` additions
- [ ] **Server-authoritative patterns** — server generates, logs, broadcasts; client displays
- [ ] **Single-process architecture** — no worker threads, no microservices

### Architecture & Pattern Review (every item must be checked)

- [ ] **Route/Service/Model separation** — routes call services, services call models, never raw SQL in routes
- [ ] **Zustand store scope** — one store per domain, no cross-store spaghetti
- [ ] **API calls through `client/src/api/client.ts`** — no raw `fetch()` calls
- [ ] **WebSocket through `useWebSocket` hook** — no raw Socket.IO in components
- [ ] **TypeScript strict** — no `any` without explanatory comment
- [ ] **React component structure** — one component per file, named exports, default only for pages

**Gate check:** If any checklist item is unchecked (violation found), it must appear in the violations table with severity and fix. If a checklist item is not applicable, mark it N/A with a brief reason.

---

## Phase 4 — Completeness Verification

### A. Acceptance Criteria Coverage (Jira stories only)

For **every** acceptance criterion from the story, determine status. Do not skip any AC:

| #   | Acceptance Criterion | Status | Evidence |
| --- | -------------------- | ------ | -------- |

### B. Layer Coverage

| Layer | Expected? | Touched? | Status |
| ----- | --------- | -------- | ------ |

### C. Test Coverage Check

- [ ] Shared pure functions have tests (`npm test -w shared`)
- [ ] Server services have unit tests
- [ ] Server routes have Fastify `inject()` tests
- [ ] Server models have in-memory SQLite tests
- [ ] Client components have render tests (for UI stories)
- [ ] Client hooks have behavioral tests
- [ ] Client stores have state logic tests

**Run the full test suite** (`npm test -- --run`) and report the results. Zero failures required.

### D. Gap Analysis

Identify **every** gap:

1. Acceptance criteria with no corresponding change
2. Changes with no corresponding acceptance criterion (scope creep)
3. Partial implementations (edge cases or error states missing)

**Multi-agent caveat:** Before classifying a gap as critical, check whether the missing work belongs to a different subtask (still in progress) or a future story. Note the gap and its owner.

### E. Dependency Check (Jira stories only)

- [ ] Prerequisite stories from the story's Dependencies section are marked Done in Jira
- [ ] Phase-level dependencies from `plan/implementation-plan.md` are complete

**Gate check:** If any dependency is not Done and the story depends on it, **stop and report.** Do not proceed to fixing until dependencies are resolved.

---

## Phase 5 — Summary & Verdict

Present a structured summary:

```markdown
## Review Summary — [HZN-#### or Description]

### Completeness

- **Acceptance criteria:** [X]/[Y] met ([Z] partial, [W] missing)
- **Layer coverage:** [layers with gaps]
- **Test coverage:** [assessment]

### Violations

- **[N] critical** — must fix before merge
- **[N] standard** — should fix
- **[N] advisory** — consider

### Verdict

[✅ APPROVED / ⚠️ APPROVED WITH FINDINGS / ❌ REJECTED]
```

**Verdict rules:**

- **❌ REJECTED** — Any critical violation OR any acceptance criterion completely missing. **Do not auto-fix a rejected review.** Stop and present findings to the user.
- **⚠️ APPROVED WITH FINDINGS** — Standard violations only, all ACs at least partially met. **Proceed to Phase 6 to auto-fix standard violations.**
- **✅ APPROVED** — Zero violations, all ACs met, test coverage adequate. **Skip Phase 6, proceed directly to Phase 7.**

---

## Phase 6 — Auto-Fix Findings

> **Only execute this phase if the verdict is ⚠️ APPROVED WITH FINDINGS.**

Apply fixes for every fixable finding from Phase 3 and Phase 4. Follow priority order: **critical first, then standard, then advisory.**

### Fix Prioritization

| Priority    | Category                                                                            | Action                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Critical | Convention violations, broken builds, test failures, missing AC coverage            | **Fix immediately.** If a critical finding cannot be auto-fixed (e.g., missing AC requires new feature work), **stop and ask the user.** |
| 🟡 Standard | Missing error handling, empty catch blocks, unused imports, missing component tests | **Auto-fix.** Apply the standard fix pattern from Horizon conventions.                                                                   |
| 🔵 Advisory | Scope-adjacent work, design refinements, naming suggestions                         | **Defer with note.** Apply only if the fix is trivial (< 3 lines). Otherwise, note for human review.                                     |

### What to Fix vs. What to Defer

| Finding                                                    | Action                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Tailwind/CSS-in-JS used                                    | Replace with plain CSS + `theme.css` custom properties   |
| Battle map code (grid, tokens, measurements)               | **Stop — ask user.** This is an architectural violation. |
| Client-side dice RNG                                       | Move to `server/src/services/dice.ts`                    |
| Redux imports                                              | Replace with Zustand stores                              |
| Paid API references                                        | Remove; use free alternatives                            |
| External database references                               | Remove; SQLite only                                      |
| Migration file edited (not additive)                       | Revert; create a new migration file instead              |
| Missing test coverage                                      | Add Vitest tests                                         |
| Empty catch block                                          | Add error state + `console.error`                        |
| Unused import                                              | Remove it                                                |
| Missing JSDoc                                              | Add JSDoc description                                    |
| `any` without comment                                      | Add type or explanatory comment                          |
| Component tests missing (deferred to Verification subtask) | **Defer** — note the owning subtask                      |
| Design decision needed (e.g., icon style)                  | **Defer** — ask user for direction                       |

### Fix Procedure

For each fixable finding:

1. **Apply the fix** — edit the file, add the test, update the config.
2. **Verify immediately:**
   - `npm run build` — must pass
   - `npm test -- --run` — zero failures
3. **If build or tests fail**, revert the fix and report: "⚠️ Fix for `<finding>` caused a build/test failure. Reverted. Human review needed."
4. **Report each fix** as it's applied with a one-line summary.

### Deferred Items

After auto-fixing, list every finding that was deferred and why:

| Finding                             | Reason for Deferral                   | Recommended Owner |
| ----------------------------------- | ------------------------------------- | ----------------- |
| Die icons not hexagonal             | Design decision needed                | Ask user          |
| Component tests for track modifiers | Owned by HZN-212 Verification subtask | HZN-212           |

---

## Phase 7 — Post-Fix Verification & Auto-Transition

### Verification

1. Run `npm run build` — must pass with zero errors.
2. Run `npm test -- --run` — must pass with zero failures.
3. Report final test count and any new tests added.

### Auto-Transition (Jira stories only)

If the final verdict is effectively **✅ APPROVED** (all fixable findings resolved, only deferred items remain) and the review was for a Jira story (not a freeform description):

1. Check the issue type from Phase 1 (`issuetype.name`).
2. **If the issue is an Epic** — do NOT transition. State that epics must be closed manually.
3. **If the issue is NOT an Epic:**
   - Fetch available transitions via `getTransitionsForJiraIssue`.
   - Find the transition matching `Done` (case-insensitive).
   - If found, transition via `transitionJiraIssue`.
   - Report: "✅ HZN-#### transitioned to Done."
   - If "Done" is not available, report available transitions and ask the user to transition manually.

### Final Report

```markdown
## Review & Fix Complete — [HZN-#### or Description]

### Review Verdict

[Original verdict from Phase 5]

### Fixes Applied

- [N] fixes applied automatically
- [N] findings deferred

### Deferred Items

[Table from Phase 6]

### Final State

- Build: [pass/fail]
- Tests: [N]/[N] passing
- Jira: [transition status]

### Items Needing Human Attention

- [Any deferred findings that need user decisions]
```

---

## Scope by Task Weight

| Weight                     | Behavior                                                                         |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Light** (< 5 min change) | Skip full review. Run convention checklist only. No auto-fix.                    |
| **Standard** (few files)   | Run Phases 2–5. Phase 4 only if Jira key provided. Auto-fix standard violations. |
| **Full** (story)           | Run all phases. Always auto-fix standard violations.                             |

Use `/review-and-fix` alone to auto-detect weight from git diff. Use `/review-and-fix HZN-####` to force Full.
