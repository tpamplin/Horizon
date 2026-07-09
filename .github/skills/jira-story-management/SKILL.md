---
name: jira-story-management
description: 'Jira story management, epic decomposition, subtask workflows, and quality rubrics. Use when: creating stories, decomposing epics, breaking stories into subtasks, writing acceptance criteria, story sequencing, value slicing, self-reflection.'
---

# Jira Story Management (Horizon)

## When to Use

- Creating or editing Jira stories, epics, or subtasks in the HZN project
- Decomposing epics into stories or stories into subtasks
- Writing acceptance criteria or Jira descriptions
- Reviewing story quality (value slicing, vertical delivery, layer ordering)

## Procedure

### Creating a Story

1. Read [templates reference](./references/templates.md) for mandatory Horizon story format
2. Read the design doc (`plan/vtt-design-doc.md`) for architecture decisions
3. Inspect existing code to ground requirements in reality (but do NOT reference specific files/classes by name in the story)
4. Draft story using the Horizon Story Format
5. Run self-reflection rubric from [story decomposition](./references/story-decomposition.md)
6. Write to Jira via Atlassian MCP (`wollonof.atlassian.net`, HZN project)
7. **Always set the parent epic** via `editJiraIssue` immediately after creation

### Decomposing an Epic

1. Read [story decomposition](./references/story-decomposition.md) for rules and rubric
2. Create smallest vertical-value stories with dependency ordering: shared → server → client
3. Run VTT sequencing check:
   - Can the GM or player initiate the feature action?
   - Does the system process/respond to the action?
   - Can the user view/manage the resulting state?
   - Is each story independently verifiable?
4. Run self-reflection rubric before presenting
5. Create stories in Jira in execution order (one at a time, wait for each key)

### Subtask Execution

1. Read [subtask workflow](./references/subtask-workflow.md) for execution rules
2. Create subtasks one at a time in execution order — wait for each issue key
3. Transition to In Progress before making any changes
4. Run targeted tests within each subtask; full suite at Verification & Wrap-Up
5. Post summary Jira comment on parent story when complete

## Horizon-Specific Rules

- **Layer ordering:** shared types/rules first, server endpoints/handlers second, client UI/hooks/stores last
- **Story format:** Overview → Why it matters → Work involved (Shared/Server/Client/Testing/Accessibility) → Acceptance Criteria → Dependencies
- **Epic format:** Goal → Dependencies → Stories to Decompose (checklist by section) → Milestone → Reference
- **Anti-patterns:** no backend-only stories, no tactical battle maps, no Tailwind/CSS-in-JS, no paid APIs, no external databases
- **Accessibility:** at least one acceptance criterion for every UI story
- **Naming:** action + domain (e.g., "Add stat-to-dice roll integration")
