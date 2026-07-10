# Subtask Execution Workflow (Horizon)

## Standard Workflow

- Use Atlassian MCP (`wollonof.atlassian.net`) for Jira context; never ask the user for keys/status if MCP is available.
- **Always set the parent** via `editJiraIssue` with `{"parent": {"key": "HZN-XX"}}` immediately after each subtask creation. The `createJiraIssue` tool does NOT auto-link to the parent story in next-gen Jira projects.
- **Always set the assignee** — call `atlassianUserInfo` once to get the current user's `accountId`, then include `assignee_account_id` in every `createJiraIssue` call. Never hardcode account IDs.
- Transition a subtask to **In Progress** before making any code or doc changes.
- Focus on one subtask at a time unless explicitly allowed otherwise.

### CRITICAL — Create Subtasks in Dependency Order (One at a Time)

**Subtask keys become the permanent execution sequence.** If subtasks are created out of order, the keys won't reflect the dependency chain and the board will be confusing. This applies to story decomposition into subtasks too.

1. **Write the execution order BEFORE creating anything** — a numbered list of subtasks in dependency sequence.
2. **Create one subtask at a time.** Call `createJiraIssue`, wait for the response, record the key.
3. **Verify the key matches your expected position.**
4. **Only then** create the next subtask.
5. **Never batch or parallelize subtask creation.** Do not create subtask #2 until subtask #1's key is confirmed.

### Jira Description Formatting

When calling `createJiraIssue`, the `description` must use real newline characters, not escaped `\n` sequences. Pass as a multi-line string with actual newlines.

## Execution Rules

- **Never skip a subtask** — pick the next open subtask in order when directed to continue.
- If a subtask is already In Progress, verify completeness. If anything is missing, finish it before moving on.
- After implementing, run targeted tests (`npm test -w <workspace>`). Failures in changed code must be fixed before marking Done.
- Before marking Done, post a concise Jira comment on the parent story covering changes, tests added, tests run, and follow-up risks.
- Proceed to the next subtask only after acceptance or explicit direction.
- **Jira connectivity issues:** If an MCP call fails (auth/connection), stop and inform the user — do not proceed on assumptions.

## Story Verification & Wrap-Up

The final subtask of every story:

1. Run `npm test` — zero failures across all workspaces
2. Run `npm run build` — zero TypeScript errors
3. Verify Horizon conventions (no battle maps, no Tailwind, no paid APIs, no external DBs, no Redux)
4. Post summary Jira comment on the parent story
5. Transition story to Done (or In Review, per user preference)

## Horizon-Specific Subtask Patterns

### Shared subtasks

- Types, interfaces, pure functions
- Verify: `npm run build -w shared && npm test -w shared`

### Server subtasks

- Routes, services, WS handlers, models, middleware, migrations
- Verify: `npm run build -w server && npm test -w server`
- Route tests use Fastify `inject()`, model tests use in-memory SQLite

### Client subtasks

- Components, hooks, stores, styles
- Verify: `npm run build -w client && npm test -w client`
- Plain CSS only — verify no Tailwind/CSS-in-JS in post-task check

### Accessibility subtasks

- Keyboard navigation, focus management, ARIA labels
- Manual verification checklist (see testing.instructions.md)
