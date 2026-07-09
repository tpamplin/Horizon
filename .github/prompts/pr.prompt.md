# Pull Request

Commit, push, and create a pull request for the Horizon repository. Follows the push workflow first, then opens a PR.

## Process

### 1. Commit & Push

Execute the full push workflow from `push.prompt.md`:

1. Check `git status`
2. Stage selectively (`git add <files>` — never `git add -A`)
3. Commit by concern with conventional commit format (`feat(scope):`, `fix(scope):`, `chore(scope):`)
4. Scopes: `shared`, `server`, `client`, `plan`, `vscode`, `deps`, `github`
5. Verify `npm run build` passes (or at minimum the affected workspace)
6. Push to remote (`git push origin <branch>`)
7. Never force push to `main`

### 2. Create Pull Request

1. Ensure the branch is up to date with `main`:
   ```bash
   git fetch origin main && git merge origin/main
   ```
2. Run the build check:
   ```bash
   npm run build
   ```
3. Run tests if they exist for the changed code:
   ```bash
   npm test -w <affected-workspace>
   ```
4. Create the PR using the GitHub CLI or VS Code interface. PR body must include:
   - **Summary:** What this PR does in 1–2 sentences
   - **Changes:** Bullet list of key changes, organized by layer (shared → server → client)
   - **Testing:** What was tested and how to verify
   - **Related:** Link to the Jira story/epic (e.g., HZN-4)

### 3. Report

Present:

- PR URL
- Summary of commits included
- What was tested
- Any risks or follow-up items

## Horizon-Specific Checks

Before creating the PR, verify:

- No `node_modules/`, `dist/`, `data/`, or `.env` files are staged
- No tactical battle map code (grid, tokens, measurements)
- No CSS frameworks (Tailwind, Bootstrap, CSS-in-JS)
- No paid API references or external database dependencies
- All new UI components have associated plain CSS
- Migration files (if any) are additive only (never edited)
