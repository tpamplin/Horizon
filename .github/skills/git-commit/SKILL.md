---
name: git-commit
description: 'Commit code changes following Horizon conventions. Use when: committing work, staging files, writing commit messages, splitting commits by concern. Covers commit composition, message format, and pre-commit verification.'
---

# Git Commit

## When to Use

- Committing any code changes
- Splitting work into multiple commits
- Preparing to push

## Pre-conditions

- [ ] TypeScript compiles clean (`npm run build` passes)
- [ ] Tests pass for changed code (`npm test -w <workspace>`)
- [ ] On the correct branch (`phase/N-short-description`)

## Steps

### 1. Verify branch

```bash
git branch --show-current
```

Horizon branches follow `phase/N-short-description` naming (e.g., `phase/0-scaffold`, `phase/1-auth`). Confirm you're on the right branch before committing.

### 2. Stage files by concern

Split commits by concern. Never `git add -A` or `git add .` unless you've verified every file belongs.

**Commit categories (stage separately):**

| Category        | Scope            | Examples                                                      |
| --------------- | ---------------- | ------------------------------------------------------------- |
| Shared code     | `shared`         | types, rules, interfaces                                      |
| Server code     | `server`         | routes, services, WS handlers, models, middleware, migrations |
| Client code     | `client`         | components, hooks, stores, styles                             |
| Config changes  | `vscode`, `deps` | .vscode/, tsconfig, package.json, eslint                      |
| Documentation   | `plan`, `docs`   | plan/*.md, README.md                                          |
| GitHub tooling  | `github`         | .github/ instructions, prompts, skills                        |
| Formatting only | `style`          | Whitespace, import ordering — dedicated commit                |

### 3. Write commit message

Format: `<type>(<scope>): <description>`

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`

**Scopes:** `shared`, `server`, `client`, `plan`, `vscode`, `deps`, `github`

**Examples:**

```
feat(shared): add MapPin and MapView types
feat(server): add POST /api/campaigns/:id/map/pins endpoint
fix(server): validate refresh token before rotation
chore(vscode): add launch config for server + client debugging
docs(plan): update design doc with city maps feature
test(shared): add dice pool parser unit tests
```

### 4. Verify before finalizing

```bash
git log --oneline -1  # Review the commit
npm run build          # Final build check
```

---

### 5. Jira Integration (Optional)

When committing work for a specific Jira issue, include the HZN key in the commit body:

```
feat(server): add POST /api/auth/register endpoint

Implements user registration with bcrypt password hashing and JWT token pair return.

Ref: HZN-31
```

This is optional for Horizon. Include the HZN reference when the commit directly completes a Jira story or subtask. For general infrastructure work, the conventional commit format alone is sufficient.

## Reference

For the full push workflow, see `.github/prompts/push.prompt.md`. This skill covers the commit step only.
