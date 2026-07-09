---
description: 'Run the full Post-Task verification on demand (compile, tests, conventions, findings).'
---

# Wrap-Up (Post-Task Verification)

Run the full post-task ceremony explicitly, regardless of task weight.

## Instructions

1. Read and execute the `post-task` skill (`.github/skills/post-task/SKILL.md`) step by step:
   - TypeScript compile check (`npm run build`)
   - Targeted tests (`npm test -w <affected>`)
   - Horizon convention check (no battle maps, no Tailwind, no paid APIs, no Redux, migrations additive)
   - Full test suite for story-level work (`npm test`)
   - Pattern capture (add to `learned-rules.md` if novel)
2. Present findings summary before calling `task_complete`.

Use this when you want the complete wrap-up even on a Light/Standard change. Otherwise tiering applies (see `instructions/guardrails.instructions.md` § Task-Weight Tiering).
