---
description: 'Fix findings from a completed review. Reads the review output, prioritizes issues by severity, and applies fixes systematically. Use when: a review just finished and produced findings to address.'
---

# Fix Review Findings

Apply fixes for issues identified in a recently completed code review. The agent calling this prompt just finished a review and needs to address the findings.

## Instructions

1. **Read the review output** — the calling agent should pass the review findings inline after this command, or they will be available in the most recent conversation context. If no findings are available, ask the user to run `/review` first.

2. **Categorize and prioritize findings:**
   - **Critical** — broken builds, test failures, convention violations (Tailwind, battle maps, paid APIs, Redux, external DBs), missing acceptance criteria coverage
   - **High** — incomplete tests, missing error handling, TypeScript `any` usage without comment
   - **Medium** — missing JSDoc, style inconsistencies, accessibility gaps
   - **Low** — formatting nits, naming suggestions, optional refinements

3. **Fix in priority order.** Address all critical items first, then high, then medium. Low items may be deferred with a note.

4. **For each finding, apply the fix directly:**
   - Code issues → edit the file
   - Test gaps → add tests
   - Convention violations → bring code into compliance
   - Missing documentation → update docs

5. **After each fix, verify:**
   - `npm run build` — must pass
   - `npm test -w <affected-workspace>` — zero failures

6. **Report what was fixed**, what was deferred, and any items that need human judgment.

## Horizon-Specific Fixes

Common review findings in Horizon and their fixes:

| Finding                                      | Fix                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Tailwind/CSS-in-JS used                      | Replace with plain CSS + `theme.css` custom properties              |
| Battle map code (grid, tokens, measurements) | Remove; theater-of-the-mind only                                    |
| Client-side dice RNG                         | Move to `server/src/services/dice.ts`; client animation is cosmetic |
| Redux imports                                | Replace with Zustand stores                                         |
| Paid API references                          | Remove; use free alternatives (OpenStreetMap not Google Maps, etc.) |
| External database references                 | Remove; SQLite only                                                 |
| Missing test coverage                        | Add Vitest tests for shared rules and server services               |
| Migration file edited (not additive)         | Revert; create a new migration file instead                         |
| Scattered `process.env` reads                | Centralize in `server/src/config.ts`                                |
| Missing JSDoc on exported types              | Add JSDoc descriptions                                              |
| `any` type without justification             | Add explicit type or comment explaining why                         |

## Input

{{input}}

## Expected Input Format

The agent should pass the review findings as a structured list:

```
## Review Findings

### Critical
- [finding description]
- [finding description]

### High
- [finding description]

### Medium
- [finding description]

### Low
- [finding description]
```

If no structured input is provided, extract findings from the review conversation context.
