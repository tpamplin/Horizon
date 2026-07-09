---
description: 'Run a code quality review on changed files. Use when: finishing a story, before PR, or on demand.'
---

# Review

Run a code quality review on files changed in the current session.

## Instructions

1. Identify all files modified in this session (check git diff, recent commits)
2. For each file, check against Horizon conventions:
   - [ ] No tactical battle map code (grid, tokens, measurements)
   - [ ] No CSS frameworks (Tailwind, Bootstrap, CSS-in-JS) — plain CSS only
   - [ ] No client-side dice RNG — all dice go through server
   - [ ] No Redux — Zustand only
   - [ ] No paid API references
   - [ ] No external database references (SQLite only)
   - [ ] Migration files are additive only (new, not edited)
   - [ ] All new UI components have associated plain CSS
   - [ ] Server-authoritative patterns followed
   - [ ] Single-process architecture respected
3. For each violation found, note: file, line/area, what's wrong, suggested fix
4. Present findings as a checklist. Offer to apply fixes with `/fix`.
5. Files with zero violations → mark as clean.

Use `/review` to force a check at any time. By default this runs as part of the post-task verification for Standard and Full tasks.
