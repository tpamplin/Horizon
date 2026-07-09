---
description: 'Always-loaded hard rules and task-weight tiering for Horizon. Full procedural detail lives in conventions/guardrails.md (lazy-loaded).'
applyTo: '**'
---

# Hard Rules (Always-Loaded)

Keep this file lean. The long form lives in `.github/conventions/guardrails.md` — load it when you need detail. Procedural how-tos live in skills.

## Task-Weight Tiering

Match ceremony to the work. Decide the tier first, then act.

- **Light** (< 5 min: typo, one-liner, comment): just branch sanity + compile check if code touched. No checklists.
- **Standard** (focused change across a few files): run pre-task steps 1-3 + post-task steps 1-3.
- **Full** (story or multi-file feature): run the complete `/implement` flow.

Want the full ceremony explicitly? Use `/prep`, `/wrapup`, `/review`.

## Safety (Never Violate)

- **Never `git push`** unless user explicitly asks OR following an approved prompt (push, pr).
- **Never `git commit`** unless user asks OR executing an approved workflow.
- **Confirm before destructive/irreversible actions**: deleting files/branches, dropping tables, `rm -rf`, `git push --force`, `git reset --hard`, amending published commits, modifying shared infra.
- **Never bypass safety checks** (`--no-verify`). Never revert formatting-only changes — commit them separately.
- **Never install new dependencies** without user confirmation.
- **All compile errors must be resolved before commit/push.**

## Test Policy

- **Never ignore test failures** — fix immediately. Zero failures is the only acceptable state.
- Run targeted tests during implementation; full suites at wrap-up.
- Use root scripts (`npm test -w <ws>`). Never `cd` into subdirectories.

## Intent & Architecture

- Treat `plan/vtt-design-doc.md` and `plan/implementation-plan.md` as the intent baseline.
- Don't change architecture without discussion — present alternatives as recommendations.
- Don't build features from future phases.
- Only update documentation when the change makes it stale — don't proactively rewrite docs.

## Skill-First Protocol

1. Check `<skills>` for a matching skill before starting any workflow.
2. If found, read it and follow its steps exactly.
3. If none exists and you did something reusable, create one via `skill-authoring` skill.
