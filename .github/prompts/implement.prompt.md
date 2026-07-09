---
description: 'Implement a Jira story end-to-end for Horizon. Creates Jira subtasks, executes them sequentially, runs tests, and validates against project conventions.'
---

# Implement Story

Plan and implement a Horizon Jira story (HZN project, `wollonof.atlassian.net`): fetch context, create subtasks, then execute them sequentially following Horizon's monorepo layer ordering (shared → server → client).

## Usage

```
/implement HZN-####
```

## Instructions

Execute the following steps **inline** — do not delegate planning to a subagent.

### Phase 1 — Fetch Context

1. Fetch the story via Atlassian MCP (`getJiraIssue`) using the key below.
2. Fetch the parent epic if linked.
3. Read the story's acceptance criteria, scope, and work-involved sections.
4. Read `plan/vtt-design-doc.md` for architecture decisions and `plan/implementation-plan.md` for phase-level context.
5. Read `.github/copilot-instructions.md` for project conventions.

### Phase 2 — Inspect Codebase

1. Determine which workspace packages will be touched (`shared/`, `server/`, `client/`).
2. Verify the files/components mentioned in the story exist in the codebase.
3. Check for existing Zustand stores, hooks, or services that should be reused.
4. Note the current phase from the implementation plan — do not build things from future phases.

### Phase 3 — Decompose & Create Subtasks

Structure:

```
1–N.  Implementation subtasks (the actual work, ordered shared → server → client)
N+1.  Verification & Wrap-Up (tests, typecheck, conventions check, Jira comment)
```

Do **not** create standalone "Preparation" or "Present Findings" subtasks. The pre-flight checklist runs inline before the first implementation subtask.

#### Implementation Subtasks

- Smallest vertical-value subtasks aligned to the parent story
- Ordered by layer: shared types/rules first, server endpoints/handlers second, client UI/hooks/stores last
- Each subtask includes: scope bullets, acceptance bullets
- Include targeted test runs within each subtask's acceptance
- Include an accessibility subtask when UI changes are in scope (ARIA, keyboard nav, focus management)
- Titles are specific and actionable (3–7 words each)

#### Verification & Wrap-Up Subtask (always last)

Summary: `Verification & Wrap-Up: Tests, typecheck, conventions, findings`

Scope:

- Run Vitest tests for affected workspace(s) — zero failures required
- Run TypeScript compilation check (`npm run build -w <package>`)
- Verify plain CSS conventions (no Tailwind, no CSS-in-JS, dark theme variables used)
- Verify no tactical battle map code, no paid APIs, no external database references
- Post a summary Jira comment on the parent story (changes, tests, risks)

#### Create in Jira

Use Atlassian MCP `createJiraIssue` to create each subtask:

- **One at a time**, in execution order. Wait for each issue key before creating the next.
- Use `issueTypeName: "Subtask"` for subtasks.
- Include Summary and Description with **Scope** and **Acceptance** bullet lists.
- **Always set the parent** via `editJiraIssue` with `{"parent": {"key": "HZN-XX"}}` immediately after each creation.
- **Always set the assignee** — call `atlassianUserInfo` once to get the current user's `accountId`, then include it in every `createJiraIssue` call. Never hardcode account IDs.
- Transition the story to **In Progress** before executing.

### Phase 4 — Build Todo List & Execute

1. **Run pre-flight checklist inline:** `git status` + confirm branch, check for uncommitted changes, verify `npm run build` passes.
2. Create a `manage_todo_list` that is an **exact 1:1 mirror** of the Jira subtasks. Each todo title is `HZN-XXXX Summary`.
3. Begin executing from the first subtask. Follow conventional commit format (`feat(scope):`, `fix(scope):`, `test(scope):`).
4. Push commits following `push.prompt.md` rules — small, logical, never `git add -A`.
5. Identify which existing docs will be created/updated.
6. If Confluence-backed, pull the current page version before editing.

### Phase 3D — Decompose & Create Subtasks

Structure for documentation stories:

```
1. Preparation (git state, pull existing pages, identify scope)
2–N. Write/update [document name] (one subtask per doc or section)
N+1. Review & Finalize (proofread, present to user)
```

#### Preparation Subtask

Summary: `Preparation: Git state, pull Confluence pages, scope review`

Scope:

- Run `git status` and confirm branch
- If Confluence-backed: pull current versions of all pages to be edited
- Scan learned rules relevant to `[STYLE]` category (tone, formatting)
- Transition story to In Progress and assign

#### Writing Subtasks

Summary: `Write [document/section name]`

Scope:

- Create or update the specified document
- Follow Confluence formatting conventions if applicable
- Include diagrams, tables, or code examples as needed

Acceptance:

- Document exists with complete content
- Formatting follows conventions
- Cross-references are correct

#### Review & Finalize Subtask (always last)

Summary: `Review & Finalize: Proofread, present summary`

Scope:

- Proofread all written content for consistency and completeness
- Present a summary of all docs created/updated to the user
- If Confluence-backed: remind user to publish when ready (do NOT auto-publish)
- Post summary Jira comment on the story
- Rule reflection — write learned rules if conventions were discovered

**No Launch Review, no test suites, no TypeScript checks, no Present Findings subtask.**

### Phase 4D — Build Todo List & Execute

1. Create a `manage_todo_list` mirroring the Jira subtasks.
2. Begin executing.

---

## Story Key

{{input}}

**Do NOT skip the planning phase. Do NOT start implementation before subtasks are created in Jira.**

## Story Key

{{input}}
