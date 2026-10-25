# Semantic Commit Messages — Complete Reference

A quick-reference for all conventional commit types, scopes, and modifiers.

---

## Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer: BREAKING CHANGE, closes #issue]
```

---

## Types

### `feat`

A new feature introduced to the codebase.

```
feat: add dark mode toggle
feat(auth): implement OAuth2 login
feat(ui): add skeleton loading state
```

### `fix`

A bug fix.

```
fix: resolve null pointer on startup
fix(api): handle 404 response correctly
fix(auth): token not refreshing on expiry
```

### `hotfix`

An urgent fix applied directly to production. Often used outside strict Conventional Commits spec but widely adopted.

```
hotfix: patch critical XSS vulnerability
hotfix(auth): block unauthorized admin access
hotfix(db): prevent duplicate transaction writes
```

### `refactor`

Code change that neither fixes a bug nor adds a feature — restructuring, renaming, simplifying.

```
refactor: extract utility functions to helpers module
refactor(user): split monolithic service into layers
refactor(db): replace raw queries with repository pattern
```

### `chore`

Maintenance tasks, dependency updates, tooling, config — no production code change.

```
chore: update dependencies
chore(deps): bump express from 4.18 to 4.19
chore(ci): add lint step to GitHub Actions
chore: clean up unused imports
```

### `setup`

Initial project setup, scaffolding, or bootstrapping. Not in the official spec but common in early-stage repos.

```
setup: initialize project with Vite + TailwindCSS
setup(docker): add Docker Compose for local dev
setup(db): configure Prisma with PostgreSQL adapter
```

### `style`

Changes that do not affect logic — formatting, whitespace, semicolons, lint fixes.

```
style: reformat files with Prettier
style(css): fix inconsistent spacing in card component
style: enforce single quotes across codebase
```

### `docs`

Documentation only changes — README, JSDoc, comments, wikis.

```
docs: update README with setup instructions
docs(api): add JSDoc to auth service methods
docs(contributing): add PR guidelines
```

### `test`

Adding or updating tests — unit, integration, e2e.

```
test: add unit tests for user service
test(auth): cover token expiry edge case
test(e2e): add Playwright flow for checkout
```

### `perf`

Performance improvements.

```
perf: memoize expensive calculation in dashboard
perf(db): add index on user email column
perf(api): enable response compression with gzip
```

### `build`

Changes affecting the build system or external dependencies (webpack, vite, babel, npm scripts).

```
build: migrate from CRA to Vite
build(deps): add @prisma/adapter-pg for Prisma 7
build: configure path aliases in tsconfig
```

### `ci`

CI/CD pipeline configuration changes (GitHub Actions, GitLab CI, Jenkins, etc.).

```
ci: add deploy workflow on push to main
ci(github): fix branch name in release action
ci: cache node_modules in pipeline
```

### `revert`

Reverts a previous commit.

```
revert: revert "feat(auth): add biometric login"
revert(api): undo breaking change from last release
```

### `release`

Marks a release commit. Often automated by tools like `semantic-release`.

```
release: v2.1.0
release(patch): v1.0.3
```

### `wip`

Work in progress — a draft commit, usually not merged to main. Use sparingly.

```
wip: rough implementation of notification scheduler
wip(dashboard): charts not yet wired to real data
```

### `merge`

Documents a branch merge. Usually auto-generated.

```
merge: branch 'feat/user-profile' into develop
```

---

## How to Write a Proper Semantic Commit

### 1. Pick the right type

Ask yourself: _what kind of change is this?_

- Shipping something new → `feat`
- Something was broken and you fixed it → `fix`
- Broken in prod, needs immediate patch → `hotfix`
- Moving/renaming/simplifying code with no behavior change → `refactor`
- Formatting, whitespace, lint → `style`
- Docs, comments, README → `docs`
- Tests only → `test`
- Dependencies, tooling, config, scripts → `chore`
- Build system or bundler → `build`
- CI/CD pipeline files → `ci`
- First-time scaffolding → `setup`
- Speed improvement → `perf`
- Undoing a commit → `revert`

### 2. Add a scope (optional but recommended)

The scope narrows _where_ the change happened. Use the name of the module, feature, or layer — whatever is most meaningful in your project. Keep it short, lowercase, no spaces.

```
feat(auth): ...       ← scoped to auth module
fix(api): ...         ← scoped to API layer
chore(deps): ...      ← scoped to dependencies
```

Skip the scope only when the change is truly global or cross-cutting.

### 3. Write the description

- **Imperative mood** — write it as a command: `add`, `fix`, `update`, `remove`, not `added`, `fixing`, `updated`
- **Lowercase** after the colon
- **No period** at the end
- **Under 72 characters** for the subject line
- Be specific — say _what_ changed, not just _that_ something changed

```
✅  feat(auth): add refresh token rotation on expiry
❌  feat(auth): made some changes to auth
❌  feat(auth): Added refresh token.
```

### 4. Add a body when needed

The body explains _why_, not _what_ (the subject already says what). Wrap at 72 characters. Leave a blank line between the subject and body.

```
fix(email): retry failed sends up to 3 times

Transient SMTP errors were silently dropping emails.
Added exponential backoff retry logic to the mailer service.
```

### 5. Use the footer for metadata

Reference issues, PRs, or breaking changes in the footer — one blank line after the body.

```
Closes #42
Fixes #87
BREAKING CHANGE: renamed sendMail() to send()
```

---

## Breaking Changes

Append `!` after the type/scope, or add `BREAKING CHANGE:` in the footer.

```
feat(api)!: rename /users endpoint to /accounts

BREAKING CHANGE: all clients must update base URL
```

---

## Closing Issues

Reference issues in the footer.

```
fix(auth): handle expired session gracefully

Closes #42
Fixes #87, #91
```

---

## Full Example (Multi-line)

```
feat(notif): add email notification on account revocation

Sends a transactional email to the user when their account
is revoked by a superadmin. Uses the existing mailer service
with a new `account-revoked` template.

Closes #114
```

---

## Quick Cheatsheet

```
feat        → new feature
fix         → bug fix
hotfix      → urgent production fix
refactor    → restructure, no behavior change
chore       → maintenance, deps, tooling
setup       → initial scaffolding
style       → formatting only
docs        → documentation
test        → tests
perf        → performance
build       → build system / bundler
ci          → CI/CD config
revert      → undo a commit
release     → version bump
wip         → work in progress (draft)
merge       → branch merge
```
