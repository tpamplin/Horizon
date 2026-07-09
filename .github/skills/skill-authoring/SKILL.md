---
name: skill-authoring
description: 'Meta-skill for creating or updating SKILL.md files. Use when: discovering a new workflow to document, an existing skill needs correction, migrating learned rules into a skill, or user asks to document a workflow. Covers template, naming, description writing, and registration.'
---

# Skill Authoring

How to create or update a `.github/skills/*/SKILL.md` file so it is discoverable, imperative, and deterministic.

## When to Use

- You completed a workflow that has no matching skill
- You hit an error in an existing skill and need to update it
- The user asks to "document this workflow" or invokes `/document-skill`
- You identified patterns that belong in a skill rather than learned-rules

## Pre-conditions

- [ ] You know the workflow steps (either just completed them or can describe them)
- [ ] You've confirmed no existing skill already covers this workflow (check `<skills>` list)

## Steps

### 1. Choose a name

- Use `kebab-case` (e.g., `git-commit`, `jira-story-management`, `pre-task`)
- Name should be action-oriented: `[domain]-[action]` or `[domain]-[noun]-[verb]`
- Check existing skills to avoid overlap

### 2. Create directory

```
.github/skills/<skill-name>/SKILL.md
```

### 3. Write the frontmatter

```yaml
---
name: <skill-name>
description: "<50-word description. MUST include trigger words. Include 'Use when:' followed by 3-5 specific trigger conditions."
---
```

**Description quality determines whether the skill gets loaded.** VS Code matches tasks to skills by semantic similarity against this description. Be specific and include synonyms.

### 4. Write the body

```markdown
# <Skill Title>

## When to Use

- [specific trigger condition]
- [another trigger condition]
- [when NOT to use, if ambiguous]

## Pre-conditions

- [ ] [thing that must be true before starting]

## Steps

### 1. [Step name]

[What to do. Use imperative voice. Include exact commands.]

### 2. [Step name]

[What to do.]

## Common Errors

- **Error pattern** → Fix: [what to do]
- **Error pattern** → Fix: [what to do]
```

### 5. Quality checklist

Before finalizing:

- [ ] Description includes trigger words an AI would use to find this skill
- [ ] Steps are imperative ("Run `npm test`" not "You should run tests")
- [ ] Commands are exact and copy-pasteable
- [ ] Edge cases are covered in Common Errors
- [ ] No Horizon-specific constraints are violated (no battle maps, plain CSS, etc.)
- [ ] References to other files use correct paths

### 6. Registration

Skills in `.github/skills/` are automatically discovered by VS Code. No manual registration needed. The `<skills>` list in the system prompt updates on next session.
