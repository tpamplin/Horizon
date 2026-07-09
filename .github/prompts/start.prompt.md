---
description: 'Initialize a new work session by reading instruction files and confirming readiness.'
---

# Session Start

Read and acknowledge the following files before proceeding with any work:

1. `.github/copilot-instructions.md` — Project context, tech stack, conventions, constraints
2. `.github/instructions/guardrails.instructions.md` — Hard safety rules and task-weight tiering
3. `.github/instructions/learned-rules.md` — Accumulated gotchas and patterns

After reading all three, respond with:

- Current branch and git status
- Current phase from `plan/implementation-plan.md`
- A one-sentence confirmation that you've read the rules and are ready

Then wait for the user's task. Do not start any work until the user gives a task.
