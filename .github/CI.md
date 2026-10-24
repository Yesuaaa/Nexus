# Continuous integration

CI runs on pull requests, pushes to `main`, and manual runs from GitHub Actions.
Secret and dependency scans also run Mondays at 09:00 Asia/Manila (01:00 UTC).

| Required check      | Purpose                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Formatting          | Prettier checks formatting without rewriting files.                                      |
| Lint                | ESLint checks JavaScript, TypeScript, and React Hooks usage.                             |
| Typecheck and build | Checks TypeScript and builds the web app and API.                                        |
| Secret scan         | Gitleaks scans fetched Git history with redacted findings.                               |
| Dependency scan     | pnpm audit blocks high and critical vulnerabilities, including development dependencies. |

CI uses Node.js 24 and the pnpm version in `package.json`. Installs must match
`pnpm-lock.yaml`. Actions are pinned to release commits. Jobs have read-only
permissions and timeouts. New runs cancel older runs for the same branch or PR.
Gitleaks uses its CLI Docker image without the Gitleaks Action license.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm audit:dependencies
```

Use `pnpm format` to fix formatting before committing. Generated Prisma code,
build output, dependencies, and local environment files are excluded.

With Gitleaks installed, scan committed history locally:

```sh
gitleaks git . --redact --log-opts="--all"
```

History scanning does not check uncommitted files. CI detects committed secrets
after they reach GitHub; it does not prevent the original push. If a real secret
is found, revoke or rotate it before removing it from code. Do not suppress it
just to make CI pass.

The dependency scan does not update packages or open pull requests. Review fixes
and commit dependency updates with the lockfile. Registry errors fail the check
rather than being treated as a clean scan.

## Require checks before merging

After pushing the workflow and letting it run, open the repository's GitHub
Settings > Rules > Rulesets and create an active branch ruleset for `main`:

1. Require a pull request before merging.
2. Require one approval when another reviewer is available.
3. Require resolution of review conversations.
4. Require the five checks above and an up-to-date branch.
5. Block force pushes and branch deletion; restrict bypass access.

Availability depends on repository visibility and the owner's GitHub plan.
These settings live on GitHub; committing this file does not enable them.

## Mobile and deployment

There is no mobile project yet. Secret scanning covers future mobile source.
JavaScript/TypeScript mobile code can use the shared formatter and baseline
linter. Add framework rules, mobile builds, and native dependency scans when the
mobile framework is chosen. Flutter, Kotlin, and Swift need their own tooling.

This setup excludes tests, CodeQL, Dependabot, deployment, and database migrations.
Vercel will be configured separately. CI needs no production credentials or live
Supabase connection.
