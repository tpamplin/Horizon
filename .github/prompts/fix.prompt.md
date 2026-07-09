---
description: 'Apply code quality fixes identified during review. Fixes all findings by default, or only specified ones.'
---

# Fix

Apply code quality observations from the most recent review or post-task verification.

## Instructions

1. Read the list of findings — either from the user's input after this command, or from the most recent post-task verification output.
2. For each finding, apply the fix directly:
   - Code issues → edit the file
   - Test gaps → add tests
   - Convention violations → bring code into compliance
3. After fixing all items:
   - Run `npm run build` — must pass
   - Run `npm test -w <affected-workspace>` — zero failures
4. Report what was fixed and any items deferred.

## Horizon-Specific Fixes

Common fixes in Horizon:

- Replace Tailwind/CSS-in-JS with plain CSS + theme.css variables
- Remove battle map code (grid, tokens, measurements)
- Move client-side RNG to server/src/services/dice.ts
- Replace Redux imports with Zustand
- Remove paid API references
- Make migration files additive (new file, never edit existing)

## Specific Fixes (optional)

{{input}}
