---
description: 'Run the full Pre-Task checklist on demand (git state, build check, instruction loading).'
---

# Prep (Pre-Task Checklist)

Run the full pre-task ceremony explicitly, regardless of task weight.

## Instructions

1. Read and execute the `pre-task` skill (`.github/skills/pre-task/SKILL.md`) step by step:
   - Check git state (`git status` + branch)
   - Verify build passes (`npm run build`)
   - Read relevant instruction files (`.github/copilot-instructions.md`, plan docs, domain instructions)
   - Check for in-progress work (git log, Jira subtasks)
   - Verify current phase from implementation plan
2. Report the verification checklist results before proceeding.

Use this when you want the complete pre-task pass even on a Light/Standard change. Otherwise tiering applies (see `instructions/guardrails.instructions.md` § Task-Weight Tiering).
