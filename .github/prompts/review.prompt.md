---
description: 'Run a multipart code review against a Jira story or described requirements. Verifies acceptance criteria coverage, convention compliance, test quality, and completeness. Use when: finishing a story, before PR, verifying work, or on demand with /review HZN-#### or /review "description".'
---

# Review

Run a comprehensive, multipart review of completed work against its requirements. Accepts a **Jira story key** (`/review HZN-####`) or a **freeform description** (`/review "added dice roller endpoint and animation"`).

## Input

{{input}}

## Instructions

Execute all phases sequentially. Do not skip phases. Present findings after each phase before continuing.

---

### Phase 1 — Understand Requirements

**If a Jira key was provided** (matches `HZN-\d+`):

1. Fetch the story via Atlassian MCP (`getJiraIssue`). If MCP is unavailable, stop and inform the user.
2. Fetch the parent epic if linked.
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
2. If the description is ambiguous, ask ONE round of clarifying questions, then proceed. Do not stall.

---

### Phase 2 — Identify Changes

1. Run `git diff --name-only HEAD~1` (or `git log --oneline -5` to find the right range). If uncommitted work exists, include `git diff --name-only` for unstaged changes.
2. Build a file manifest grouped by layer:

   | Layer  | Files Changed                                              |
   | ------ | ---------------------------------------------------------- |
   | Shared | `shared/src/types.ts`, `shared/src/rules/dice.ts`          |
   | Server | `server/src/routes/dice.ts`, `server/src/services/dice.ts` |
   | Client | `client/src/components/dice/DiceTray.tsx`, `DiceTray.css`  |
   | Config | `package.json`, `.vscode/`                                 |
   | Docs   | `plan/`, `README.md`                                       |

3. Run `git diff` to review the actual code changes in each file. Read new files in full. For modified files, read the changed sections plus surrounding context.

---

### Phase 3 — Code Quality & Convention Review

For each changed file, verify against Horizon conventions. Present violations as a table:

| File                                 | Line/Area | Violation                  | Severity    | Fix                                           |
| ------------------------------------ | --------- | -------------------------- | ----------- | --------------------------------------------- |
| `client/src/components/DiceTray.tsx` | L45       | Uses Tailwind class `flex` | 🔴 Critical | Replace with plain CSS class from `theme.css` |
| `server/src/routes/dice.ts`          | L30       | Raw SQL in route handler   | 🟡 Standard | Move query to `server/src/models/dice.ts`     |

#### Convention Checklist

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

#### Architecture & Pattern Review

- [ ] **Route/Service/Model separation** — routes call services, services call models, never raw SQL in routes
- [ ] **Zustand store scope** — one store per domain, no cross-store spaghetti
- [ ] **API calls through `client/src/api/client.ts`** — no raw `fetch()` calls
- [ ] **WebSocket through `useWebSocket` hook** — no raw Socket.IO in components
- [ ] **TypeScript strict** — no `any` without explanatory comment
- [ ] **React component structure** — one component per file, named exports, default only for pages

---

### Phase 4 — Completeness Verification

This is the most important phase. Map requirements to evidence.

#### A. Acceptance Criteria Coverage (Jira stories only)

For each acceptance criterion from the story, determine status:

| #   | Acceptance Criterion                       | Status     | Evidence                                                             |
| --- | ------------------------------------------ | ---------- | -------------------------------------------------------------------- |
| 1   | `POST /api/dice/roll` returns valid result | ✅ Met     | `server/src/routes/dice.ts:30-55`, route test in `dice.test.ts:80`   |
| 2   | Dice results logged to `dice_logs` table   | ✅ Met     | `server/src/services/dice.ts:45`, model test in `dice.model.test.ts` |
| 3   | CSS animation plays on roll                | ✅ Met     | `client/src/components/dice/DiceAnimation.tsx`, `DiceAnimation.css`  |
| 4   | Keyboard-operable roll buttons             | ⚠️ Partial | TabIndex set but missing Enter key handler                           |
| 5   | Paginated dice log history                 | ❌ Missing | No pagination in `GET /api/campaigns/:id/dice-log`                   |

#### B. Layer Coverage

Does the work touch the expected layers based on the story's "Work Involved" section?

| Layer                   | Expected? | Touched?                                                         | Status |
| ----------------------- | --------- | ---------------------------------------------------------------- | ------ |
| Shared types/rules      | Yes       | Yes (`shared/src/types.ts`)                                      | ✅     |
| Server routes/services  | Yes       | Yes (`server/src/routes/dice.ts`, `server/src/services/dice.ts`) | ✅     |
| Client components/hooks | Yes       | Yes (`DiceTray.tsx`, `DiceAnimation.tsx`)                        | ✅     |
| Tests                   | Yes       | Yes (`dice.test.ts`, `dice.model.test.ts`)                       | ✅     |
| Accessibility           | Yes       | ⚠️ (`DiceTray.tsx` has ARIA labels but missing keyboard handler) | ⚠️     |

#### C. Test Coverage Check

- [ ] Shared pure functions have tests (`npm test -w shared`)
- [ ] Server services have unit tests
- [ ] Server routes have Fastify `inject()` tests
- [ ] Server models have in-memory SQLite tests
- [ ] Client components have render tests (for UI stories)
- [ ] Client hooks have behavioral tests
- [ ] Client stores have state logic tests

#### D. Gap Analysis

Identify:

1. **Acceptance criteria with no corresponding change** — story said build X, X isn't in the diff
2. **Changes with no corresponding acceptance criterion** — possibly scope creep or unplanned work
3. **Partial implementations** — feature works but edge cases or error states are missing

#### E. Dependency Check (Jira stories only)

- [ ] Prerequisite stories (from the story's Dependencies section) are marked Done in Jira
- [ ] Phase-level dependencies from `plan/implementation-plan.md` are complete

---

### Phase 5 — Summary & Verdict

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

### Next Steps

1. [Action items for critical violations]
2. [Action items for missing acceptance criteria]
3. [Suggested improvements]
```

**Verdict rules:**

- **❌ REJECTED** — Any critical violation OR any acceptance criterion completely missing
- **⚠️ APPROVED WITH FINDINGS** — Standard violations only, all ACs at least partially met
- **✅ APPROVED** — Zero violations, all ACs met, test coverage adequate

After presenting the summary, if there are findings, offer: "Apply fixes with `/fix`."

---

## Review Scope by Task Weight

| Weight                     | Review Depth                                                      |
| -------------------------- | ----------------------------------------------------------------- |
| **Light** (< 5 min change) | Skip full review. Run convention checklist only on changed files. |
| **Standard** (few files)   | Run Phases 2–3. Phase 4 only if Jira key provided.                |
| **Full** (story)           | Run all phases. Always check acceptance criteria coverage.        |

Use `/review` alone to auto-detect weight from git diff. Use `/review HZN-####` or `/review "description"` to force Full review.
