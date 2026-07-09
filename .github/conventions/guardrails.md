# Hard Guardrails (Long-Form)

Non-negotiable rules that apply to ALL tasks. This is the long-form detail file — loaded when clarification is needed. The lean always-loaded version is `instructions/guardrails.instructions.md`.

## Security & Safety

1. **Never run `git push` unless the user explicitly asks** or the active workflow explicitly authorizes it (push.prompt.md, pr.prompt.md).
2. **Never run `git commit` unless** the user explicitly asks or the active workflow is an approved autonomous workflow.
3. **Never revert or discard formatting-only changes** — commit them in a dedicated `style` commit.
4. **Never bypass safety checks** (`--no-verify`, `--force`). If a hook blocks you, fix the issue, don't skip the hook.
5. **All compile errors must be resolved before commit or push.** No exceptions.

## Destructive Actions (Require Confirmation)

The following actions require explicit user approval before execution:

- Deleting files or branches
- Dropping database tables or deleting the `data/` directory
- `git push --force` or `git reset --hard`
- Amending published commits (already pushed to origin)
- Modifying shared infrastructure (tsconfig, eslint, package.json workspaces)
- Modifying architectural patterns (e.g., adding a new state management library, changing the database)

## Test Policy

- **Never ignore test failures.** Fix immediately. Zero failures is the only acceptable state for committed code.
- Run targeted tests during implementation (`npm test -w <workspace>`).
- Run full suite at Verification & Wrap-Up (`npm test`).
- Use root scripts only. Never `cd` into subdirectories to run tests.
- Pre-existing failures in untouched code must be documented, not silently skipped.

## Self-Improvement Protocol

- **Before any task:** Check the `<skills>` list for a matching skill. If found, follow it.
- **After any task:** If you learned something reusable, update or create a skill using the `skill-authoring` skill.
- Knowledge goes into skills (lazy-loaded). Only hard safety rules and meta-behavior go here.
- If a learned rule applies broadly, promote it to a skill or this file.

## Task-Weight Tiering (Decision Tree)

```
Is this a typo, comment, or one-liner (< 5 min)?
├── YES → Light: Branch sanity check + compile check if code touched. Done.
└── NO → Is this a focused change across a few files?
    ├── YES → Standard: Run pre-task steps 1-3 + post-task steps 1-3. Done.
    └── NO → Full (story/multi-file): Run the complete /implement flow.
```

## Horizon-Specific Safety Checks

Before any commit, verify:

- [ ] No `node_modules/`, `dist/`, `data/`, or `.env` files staged
- [ ] No tactical battle map code (grid, tokens, measurements)
- [ ] No CSS frameworks (Tailwind, Bootstrap, CSS-in-JS) — plain CSS only
- [ ] No paid API references or external database dependencies
- [ ] No Redux imports (Zustand only)
- [ ] Migration files are additive only (new file, never edited)
- [ ] All dice RNG goes through `server/src/services/dice.ts` — no client-side random

## Agent Architecture

### Skill-First Protocol

1. Check `<skills>` for a matching skill before starting any workflow.
2. If found, read it and follow its steps exactly.
3. If none exists and you did something reusable, create one via `skill-authoring`.

### Instruction Loading

- `copilot-instructions.md` — always loaded (project context)
- `instructions/guardrails.instructions.md` — always loaded (safety rules)
- Domain instructions (`backend.instructions.md`, `testing.instructions.md`) — loaded when `applyTo` matches
- Skills — lazy-loaded from `<skills>` list on demand

### Tier-Aware Ceremony

Match checklist thoroughness to task weight. Don't run full pre/post-task on a typo fix. Don't skip conventions on a multi-file feature.
