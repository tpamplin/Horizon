---
description: 'Implement a Jira story end-to-end for Horizon. Creates Jira subtasks, executes them sequentially, runs tests, and validates against project conventions.'
---

# Implement Story

Plan and implement a Horizon Jira story (HZN project, `wollonof.atlassian.net`): fetch context, create subtasks, then execute them sequentially following Horizon's monorepo layer ordering (shared → server → client).

## Usage

```
/implement HZN-####
```

> **Note:** If the user types `SS-####` instead of `HZN-####`, treat it as `HZN-####` — the developer works on both projects and may mix up the keys. This is the only allowed cross-project reference.

## Instructions

Execute the following steps **inline** — do not delegate planning to a subagent.

### Phase 1 — Fetch Context & Classify

1. Fetch the story via Atlassian MCP (`getJiraIssue`) using the key below.
2. Fetch the parent epic if linked.
3. Read the story's acceptance criteria, scope, and work-involved sections.
4. Read `plan/vtt-design-doc.md` for architecture decisions and `plan/implementation-plan.md` for phase-level context.
5. Read `.github/copilot-instructions.md` for project conventions.
6. **Classify the story type:**
   - **Documentation-Only** — acceptance is about writing/updating markdown files (README, plan docs, .github instructions/prompts/skills) with no production code changes → follow the Documentation Path below after Phase 2.
   - **Code Implementation** — everything else (shared, server, client) → continue to Phase 3 below.

### Phase 2 — Inspect Codebase

1. Determine which workspace packages will be touched (`shared/`, `server/`, `client/`).
2. Verify the files/components mentioned in the story exist in the codebase.
3. Check for existing Zustand stores, hooks, or services that should be reused.
4. Note the current phase from the implementation plan — do not build things from future phases.

---

## Code Implementation Path (default)

### Phase 3 — Decompose & Create Subtasks

Structure:

```
1–N.  Implementation subtasks (actual work, ordered shared → server → client)
N+1.  Verification & Wrap-Up (tests, typecheck, conventions, Jira comment)
```

Do **not** create standalone "Preparation" or "Present Findings" subtasks. Pre-flight runs inline before the first implementation subtask.

#### Implementation Subtasks

- Smallest vertical-value subtasks aligned to the parent story
- Ordered by layer: shared types/rules first, server endpoints/handlers second, client UI/hooks/stores last
- Each subtask includes: scope bullets, acceptance bullets
- Include targeted test runs within each subtask's acceptance
- Include an accessibility subtask when UI changes are in scope (ARIA, keyboard nav, focus management)
- Titles: specific and actionable, 3–7 words

#### Verification & Wrap-Up Subtask (always last)

Summary: `Verification & Wrap-Up: Tests, typecheck, conventions, findings`

Scope:

- Run Vitest tests for affected workspace(s) — zero failures
- Run TypeScript compilation check (`npm run build -w <package>`)
- Verify Horizon conventions: plain CSS only, no battle maps, no paid APIs, no Redux, no external DBs
- Post a summary Jira comment on the parent story (changes, tests, risks)

#### Create in Jira

Use Atlassian MCP `createJiraIssue` to create each subtask:

- **One at a time**, in execution order. Wait for each issue key before creating the next.
- Use `issueTypeName: "Subtask"` for subtasks.
- Include Summary and Description with **Scope** and **Acceptance** bullet lists.
- **Always set the parent** via `editJiraIssue` with `{"parent": {"key": "HZN-XX"}}` immediately after each creation.
- **Always set the assignee** — call `atlassianUserInfo` once for the current user's `accountId`. Never hardcode account IDs.
- Transition the story to **In Progress** before executing.

### Phase 4 — Build Todo List & Execute

1. **Run pre-flight checklist inline:** `git status` + confirm branch, check for uncommitted changes, verify `npm run build` passes.
2. Create a `manage_todo_list` that is an **exact 1:1 mirror** of the Jira subtasks. Each todo title is `HZN-XXXX Summary`.
3. Execute subtasks sequentially. Follow conventional commit format (`feat(scope):`, `fix(scope):`, `test(scope):`).
4. Identify which project docs may need updates (README, plan docs, learned-rules) as work proceeds.
5. **Do NOT push commits** — pushing is a separate workflow (`/push` or `/pr`). The implement flow builds, tests, and verifies.

---

## Documentation Path

**Skip:** Codebase inspection for implementation, test suites, TypeScript checks on server/client code, UI verification.

A documentation story produces markdown files in `plan/`, `.github/`, or the repo root. No production code changes.

### Phase D1 — Inspect Existing Docs

1. Read any existing docs that will be modified or that provide context.
2. Identify target files: markdown in `plan/`, `.github/`, or `README.md`.

### Phase D2 — Create Subtasks

Structure:

```
1. Review existing docs and scope changes
2–N. Write/update [document name] (one subtask per doc or section)
N+1. Review & Finalize (proofread, present to user)
```

### Phase D3 — Execute

1. Create a `manage_todo_list` mirroring the Jira subtasks.
2. Execute sequentially. After each writing subtask, verify output against Horizon conventions: project name is "Horizon", no SS-* keys, no AmpdUp references, correct tool names.
3. At Review & Finalize: proofread all content, present summary, post Jira comment.

**No compile checks, no test suites, no UI verification.** Documentation-only stories are verified by human review of the output.

---

## Story Key

{{input}}

**Do NOT skip the planning phase. Do NOT start implementation before subtasks are created in Jira.**
