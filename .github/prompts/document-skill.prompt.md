---
mode: agent
description: 'Document what was just done as a reusable skill. Use after completing novel work that should be repeatable.'
---

# Document Skill

Document the current session's work as a reusable skill for Horizon.

## Steps

1. **Review what was done** — Identify the repeatable workflow performed in this session.
2. **Check for existing skill** — Review `.github/skills/` for a skill that already covers this workflow.
   - If found → update it (add steps, fix errors, add Common Errors)
   - If not found → create a new skill
3. **Create/update the skill** — Follow the `skill-authoring` skill (`.github/skills/skill-authoring/SKILL.md`):
   - Choose a kebab-case name
   - Write frontmatter with trigger words
   - Document steps in imperative voice
   - Include exact commands
   - Add Common Errors section
4. **Validate** — Confirm the file uses correct Horizon conventions (no AmpdUp references, correct tool names)
5. **Report** — Tell the user what was created/updated and where
