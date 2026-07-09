---
description: 'Create a Jira defect/bug report for Horizon. Use when: reporting a bug, documenting broken behavior, creating a fix ticket.'
---

# Create Defect

Create a Jira defect in the Horizon project (HZN, `wollonof.atlassian.net`). Use the Atlassian MCP to write directly to Jira.

## Mandatory Format

```markdown
[Brief description of what's broken and user impact — GM or player experience]

**Steps to Reproduce**

1. Action 1 (e.g., "Navigate to /campaigns")
2. Action 2
3. Action 3

**Expected Behavior**

- What should happen

**Actual Behavior**

- What actually happens

**Environment**

- Browser: [Chrome/Firefox/Safari version]
- Server: [local/dev/production]
- Database: SQLite (single file)
- User type: [GM/Player]

**Impact/Severity**

- Severity: [Critical/High/Medium/Low]
- User impact description
- Workaround: [If available]

**Root Cause (if known)**

- Technical explanation
- Relevant code area (shared/server/client)

**Work involved (brief)**

- Fix description
- Test updates (Vitest for shared/server, component tests for client)
- Verification steps

**Automated Test Cases Required**

- Unit tests: [specific test scenarios for shared/server logic]
- Integration tests: [API endpoint or service interaction tests]
- Component tests: [React component behavior tests]
- E2E tests: [Playwright user workflow tests — from Phase 2]
```

## Acceptance Criteria Guidance

Every defect must verify:

1. **Fix verification** — repro steps now produce expected behavior
2. **Regression coverage** — new/updated tests prevent recurrence
3. **Affected scope checked** — related features/flows tested
4. **Root cause documented** — issue comment explains cause and fix

## Horizon-Specific Severity

- **Critical:** Dice RNG broken, data loss, auth bypass
- **High:** Core feature broken (sheets, campaigns, chat)
- **Medium:** UI issue, edge case, workaround exists
- **Low:** Cosmetic, minor inconsistency

## Inputs Needed

- Description of what's broken
- Steps to reproduce
- Affected area (shared/server/client)
