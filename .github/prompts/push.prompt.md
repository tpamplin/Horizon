# Push Prompt

You are committing and pushing changes to the Horizon repository. Follow these instructions precisely.

## Commit Strategy

**Split your work into small, logical, atomic commits.** Each commit should represent one coherent change. A reader scanning `git log --oneline` should understand exactly what happened.

### Rules for splitting

1. **One concern per commit.** Don't mix a bug fix with a formatting change. Don't mix a new feature with a refactor.
2. **Commit by layer.** When working across the monorepo, prefer separate commits per package:
   - `feat(shared): add MapPin type` — shared types first
   - `feat(server): add map pins service and routes` — backend next
   - `feat(client): add MapView and MapPanel components` — frontend last
3. **Config changes separate from code.** If you update `.vscode/`, `tsconfig`, or `package.json`, that's its own commit.
4. **Migrations are standalone.** Each migration file gets its own commit with the migration description.
5. **Keep commits under ~200 lines changed** when possible. If a commit is larger, consider whether it can be split further.
6. **Every commit must leave the project in a working state.** No "WIP" or "checkpoint" commits. Bisect must work.

### Conventional commit format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`

**Scopes:** `shared`, `server`, `client`, `plan`, `vscode`, `deps`

**Examples:**

```
feat(shared): add MapPin and MapView types
feat(server): add POST /api/campaigns/:id/map/pins endpoint
feat(client): add Leaflet MapView with pin markers
fix(server): validate refresh token before rotation
chore(vscode): add launch config for server + client debugging
docs(plan): update design doc with city maps feature
test(shared): add dice pool parser unit tests
refactor(server): extract auth logic into auth service
style(client): apply dark theme to dice tray component
```

## Process

1. **Check git status.** Run `git status` to see all changed files.
2. **Stage selectively.** Use `git add <specific files>` — never `git add -A` or `git add .` unless you've verified every file belongs in that commit.
3. **Commit with a meaningful message.** Follow the format above. The description should complete the sentence: "This commit will…"
4. **Repeat** until all changes are committed.
5. **Push.** Run `git push origin <current-branch>`. Never force push unless explicitly asked.

## Before pushing

- Verify `npm run build` passes (or `npm test` if tests exist for the changed code)
- Verify the commit list with `git log --oneline -n <number of new commits>`
- If anything looks wrong, fix it before pushing

## What NOT to do

- Do not use `git add -A` or `git add .`
- Do not create a single massive commit for unrelated changes
- Do not commit `node_modules/`, `dist/`, `.env`, or `data/`
- Do not amend commits that have already been pushed
- Do not force push to `main`
- Do not skip hooks (`--no-verify`) unless there's a very good reason
