# Payroll Git review and PR preparation

## Readiness and baseline

**READY FOR PR review locally; conditional readiness for staging.** Confirm the target and two REVIEW entries before approving the exact commit manifest. Deployment remains unverified. This preparation changed only this report; no staging, commit, push, merge, deployment, application-code change or test rerun was performed.

- Branch: `262-featglobal-plan-and-implement-payroll-module`; HEAD `fd3d46e`.
- Provisional target: `origin/development`, `ad4e25dde8d2dd795dc5d6d73064f7c068e27e0f`. The user has not explicitly selected a target. Remote-tracking freshness was not verified by fetching.
- Merge base: `148f53d7a5a8d9af170312854d05755bbffc3163`.
- Divergence: 8 target-only commits and 9 branch-only commits. The 137-file committed branch contribution is obtained with `git diff origin/development...HEAD`, not a two-tip diff. No rename/deletion appears in that contribution. A two-tip comparison misleadingly lists target-only logs/migrations as absent; they are not proposed Payroll deletions. Reconcile target changes and possible schema/lockfile/shared-code conflicts before merge; no integration was attempted here.
- Index: empty. Remaining working changes: 13 modified tracked files and 11 untracked files before this report. The manifest below also includes this report. No unrelated uncommitted file was automatically changed or removed.
- Existing branch commits already contain the broad implementation. Do not try to recommit them or rewrite history. Remaining commit plan applies only to the uncommitted layer.

Existing commits (oldest to newest): `974136c` module/compensation/runs; `76abd2d` approvals; `d68507f` structural refactor; `6a15c1b` development merge; `69c9915` settings/shared UI; `51a37df` formatting/UI; `9f5c3f0` reconciliation; `2a6bd55` reports; `fd3d46e` immutability guards.

## Scope and inventory interpretation

The complete combined inventory below has **149 entries: 146 INCLUDE, 2 REVIEW, 1 EXCLUDE**. It is the union of committed branch paths, unstaged paths and untracked paths, including this report. INCLUDE is the proposed feature/review scope, not a claim that all paths need staging now. Most are already committed. The `Remaining commit` column is the exact future staging manifest for uncommitted INCLUDE files; `existing` means no new staging is required. Each path is explicit; do not use `git add .` or broad directory staging.

Shared changes are intentional reuse dependencies: authenticated file download and its request-workflow caller; shared money parsing/caret utilities and quotation callers; SettingsSection and its settings caller; table/search/filter/side-panel/tabs/button primitives; module routing/navigation and CSP. They broaden regression surface but are not silently excluded, since excluding a shared export or caller may break compilation. No isolated unrelated uncommitted work was found; ownership of shared behavior should still be reviewed.

### REVIEW entries

1. `apps/api/prisma/seed-november-payroll-demo.ts`: optional demo tool, not a runtime dependency. It loads configured environment and can update employee start dates/compensation; November behavior is tied to a specific fixture run ID, and only the December repair path has the explicit local-simulator guard. Decide whether this fixture-specific tool belongs in the PR. Do not run it against hosted/shared data. It is already committed: excluding it would require an explicitly authorized follow-up removal, not merely omitting a new staging command.
2. `apps/web/next-env.d.ts`: Next production build regenerated the imports from `.next/dev/types` to `.next/types`. The current working version matches the provisional merge base, so staging this correction would remove this path from the net PR diff. Generated-file policy and this correction require an explicit decision; it is not silently discarded.

### EXCLUDE entry

`apps/api/scripts/verify-payroll-postgres.ps1` remains untracked and unstaged. The current brief explicitly requires exclusion, superseding the earlier recommendation to share it. Preserve it locally. Do not delete it, stage it, or add an ignore rule. Audit reports refer to its `-RunFullSuite` command, so reviewers must be told that the PR does not ship the one-command PostgreSQL launcher.

## Remaining commit plan

1. `refactor(db): share verified PostgreSQL connection configuration`
   - `apps/api/src/lib/db.ts`, `apps/api/src/lib/postgres-connection.ts`.
   - Keep together: db imports the newly extracted module. Existing public CA certificate remains a tracked runtime input. No new credential/dependency.
2. `feat(payroll): add explicit database permission audit tooling`
   - `apps/api/src/lib/payroll-db-permissions-audit.ts`, `apps/api/scripts/audit-payroll-db-permissions.ts`.
   - Depends on commit 1. Explicit audit URL, read-only metadata and safe reporting; no deployed verification claim.
3. `fix(payroll): restore history reads and align regression coverage`
   - All remaining uncommitted INCLUDE source/test files listed under commit `3` in the manifest. Includes Superadmin read loading/rendering, shared Buttons, missing concern type, deterministic browser mocks and independent-session reliability assertions.
   - Depends on commits 1–2: audit tests import the new audit/connection modules. Include test and UI corrections together; do not leave imports unresolved between published commits.
4. `docs(payroll): record local verification and deployment follow-ups`
   - All untracked INCLUDE documents under commit `4`, including this report. Depends on final source/test commits. Historical audit failures are preserved; latest evidence supersedes older verdicts.

Commit 3 remains larger than a typical small patch because it closes accumulated audit work; do not invent a new feature commit that restates the already committed implementation. Developers may group the four commits into fewer coherent commits; do not split required runtime imports from their consumers. The two REVIEW entries are not in these approved staging groups.

## Security and repository hygiene

The scoped text scan examined the combined candidate paths without reading ignored real environment files or printing secret values. Two URL-pattern hits were inspected: `.env.example` contains placeholder hosts/credentials, and PGlite support constructs its disposable local test URL. Neither establishes a secret leak. No candidate live secret key, private key, unexpected large binary, or machine-specific home/workspace path was detected under the checked patterns. This is heuristic evidence, not a guarantee against every encoded credential. The new report uses repository-relative paths only.

No generated browser artifacts are proposed for inclusion. Ignored logs, traces, screenshots, `.next`, generated Prisma/build output, real `.env` files and local databases must stay excluded. No automatic cleanup or ignore changes were performed in this task. Existing CI includes a secret scan and quality gates; do not disable them. No package manifest or lockfile change belongs to the branch contribution against its merge base. The target-only dependency/patch changes are a future integration issue, not a reason to hand-edit the lockfile.

## Migration and runtime completeness

The manifest includes Prisma schema plus all 13 Payroll-related migration SQL files in dependency order: history enums, compensation/configuration, runs, approvals, payslips/requests, withdrawal, disbursement foundation, sandbox, draft PDF regeneration, preferences, reconciliation, decisions, approved-snapshot guard. The guard is the final one tested in the current 72-migration branch history. Fresh PostgreSQL 16.16 and the representative 71-plus-final-guard upgrade were verified locally; this does not verify the target's additional migrations or hosted migration ledger.

Required runtime modules include the untracked `postgres-connection.ts` imported by modified `db.ts`, and the audit service imported by the audit CLI/test. They are explicitly INCLUDE. Existing `pg`, Prisma adapter, CA certificate, native Node runner, PGlite and web dependencies are reused. Excluding the PowerShell launcher does not break production imports, but removes automated disposable-database provisioning from the proposed PR.

## Reproducibility and verification provenance

Latest local evidence comes from the final production-browser and corrected-source regression runs recorded in [the final audit](payroll-final-pre-push-audit.md), not a rerun during preparation:

| Check                                                                          | Recorded local result                  |
| ------------------------------------------------------------------------------ | -------------------------------------- |
| Payroll Playwright, mocked APIs on production standalone server                | 40 passed, 0 failed, 0 skipped; exit 0 |
| Unified PostgreSQL/PGlite/API/unit suite                                       | 47 passed, 0 failed, 0 skipped; exit 0 |
| Frontend money/route/workspace units                                           | 25 passed, 0 failed, 0 skipped         |
| Production Next compilation and standalone preparation                         | exit 0                                 |
| API compilation, API/web TypeScript, ESLint, Prettier, PowerShell parser, diff | passed                                 |
| Verification-container cleanup                                                 | no remaining containers at completion  |

The browser runner used a temporary local config removed after testing; the default repo Playwright config and its standard pnpm build path were not claimed to pass. The package-manager signature fetch issue was not bypassed; installed executables were used directly.

Existing supported alternatives checked in source (run at repository root unless stated):

```powershell
# Existing native runner; API fixture uses disposable PGlite, not hosted DB.
node apps/api/scripts/run-tests.mjs tests/features/payroll/phase2.test.ts tests/features/payroll/phase3.test.ts tests/features/payroll/phase5.test.ts tests/features/payroll/calculator.test.ts tests/features/payroll/periods.test.ts tests/features/payroll/reconciliation.test.ts tests/features/payroll/reports.test.ts tests/features/payroll/database-permissions-audit.test.ts
node --experimental-strip-types --test apps/web/test/payroll.test.mjs apps/web/test/route-policy.test.mjs apps/web/test/workspace-modules.test.mjs
```

These are existing entry points, not an assertion that the combined alternative selection was rerun in this preparation. Generate Prisma using the existing API `db:generate` script if necessary before compiling the native tests. The invalid-certificate test uses OpenSSL; local TLS support/CA assets and installed workspace dependencies are prerequisites. The existing `apps/web/playwright.config.ts` can run selected Payroll specs with the project Playwright executable and a separately started local server through `NEXUS_E2E_BASE_URL`; it loads `.env.regression.local` if present, so reviewers must keep live mode disabled and avoid hosted credentials. No new provisioning command is invented here.

There is **no checked-in equivalent one-command fresh/upgrade PostgreSQL provisioner** once the local launcher is excluded. The independent-session test checks its exact disposable database identity and environment before mutations. Supply separately reviewed CI/local provisioning or provide the local launcher outside the PR. Do not run that test against an arbitrary configured database or call the PGlite command equivalent PostgreSQL concurrency evidence.

## PR description draft

**Suggested title:** `feat(payroll): add compensation, approvals, payslips and sandbox disbursements`

### Summary

Adds the Payroll workspace for Admin and read-only Superadmin, with Staff My Payroll under Workforce Compliance. Implements effective-dated compensation, attendance-backed conservative calculations, revisioned runs, independent approvals, payslips, sandbox disbursements, reconciliation, overview/report exports and persisted settings.

### Features and architecture

- Reuses existing tables, search/debounce, pagination, drawers, dialogs, form controls, tabs and notifications.
- Provides authenticated APIs for compensation/configuration history, periods, calculations, approval, documents, Staff concerns, reconciliation, reports and readiness.
- Keeps financial values exact and approved calculations immutable; unsupported proration, overtime pricing and leave treatment are flagged rather than inferred.
- Generates private PDFs from approved snapshots; Staff can access only their own published payslips and concerns.
- Persists local simulator destinations and transfer attempts with idempotency/concurrency checks. PayMongo execution and real transfers remain disabled.
- Adds dedicated read-only database audit tooling with an explicit audit URL; local role fixtures do not establish deployed grants.

### Database migrations and security

Includes Prisma models and 13 ordered Payroll migrations, including approved run/calculation/item/component guards and payslip/approval preservation. Local tests cover fresh installation and a representative existing-approved-data upgrade. Apply through the existing deployment migration process after reviewing target divergence and the actual migration ledger; do not assume the hosted schema is verified.

Backend permissions preserve Admin management, Superadmin read-only access, Staff employee ownership and Client restrictions. Approval rejects the preparer/calculation author, locks the reviewed revision and records attributable audit events. Snapshot guards reject direct approved financial writes before and after payslip generation.

### Local verification

- Playwright: 40 passed, 0 failed, 0 skipped against local production assets with mocked APIs.
- Payroll PostgreSQL/PGlite/API/unit regression: 47 passed, 0 failed, 0 skipped.
- Frontend unit tests: 25 passed, 0 failed, 0 skipped.
- Next production build and standalone preparation: exit 0.
- API compilation, TypeScript, ESLint, formatting and diff checks passed; disposable verification containers cleaned up.

These are local results from the final audit. They do not establish live integration or production readiness. Standard package-manager execution encountered signature-metadata fetch failure; equivalent installed executables were used without disabling verification.

### Known limitations and follow-up verification

- Historical invalid-payslip-reference HTTP 500 was not reproduced; original root cause remains unknown.
- Response loss after a proven database commit and attendance-correction/calculation races remain unverified. Recalculation intentionally creates new revisions; duplicate rejection is not universal idempotency.
- Deployed runtime writer privileges, hosted TLS and hosted migration state await deployment-stage inspection.
- Leave-request pay treatment and unsupported payroll policies remain unavailable.
- Existing Prisma PostgreSQL adapter queued-query deprecation warning remains.
- No real payout or enabled PayMongo integration is included.

### Reproducibility

The local `verify-payroll-postgres.ps1 -RunFullSuite` launcher is excluded from this PR by request. Native Node/PGlite tests and existing Playwright configuration remain; independent-session PostgreSQL tests require separately reviewed disposable provisioning. See this preparation report for inspected entry points and prerequisites. The reported unified command cannot be reproduced from this PR alone without the excluded launcher or equivalent approved setup.

### Deployment checklist

- Reconcile the selected target branch and review shared dependency/schema changes.
- Confirm migration order/ledger and an appropriate backup/rollback plan before applying required migrations.
- Configure runtime environment and separate least-privilege application/migration roles.
- Verify actual runtime database grants, guard enablement and hosted TLS certificate/hostname validation.
- Keep simulator and external payment execution appropriately disabled in production.
- Smoke-test Admin/Superadmin/Staff/Client authorization and separation of duties.
- Verify a controlled calculation/approval flow and Staff ownership/published PDF access.

## Developer decisions before staging

Confirm the PR target, disposition of the two REVIEW entries, the exact four remaining commit groups, and the explicit local-launcher exclusion. Then authorize selective staging separately. This report does not authorize staging or any remote action. Revalidate after target integration because existing local evidence covers this branch state, not a future merged result.

## Component and Code Reuse Report

Reused the final audit format/evidence, existing Conventional Commit style, native runners, scripts and repository CI conventions. No PR template was found under `.github`; the draft follows the brief's required headings. No components, utilities, hooks, services or frameworks were created. Only this Markdown report was added.

## Exact combined inventory and future staging manifest

The following generated table is a snapshot, not a staging command. Commit groups apply only when `Uncommitted` is yes. Historical committed entries are already on the branch.

| Disposition | File                                                                                             | Layer                | Remaining commit      | Reason                                                    |
| ----------- | ------------------------------------------------------------------------------------------------ | -------------------- | --------------------- | --------------------------------------------------------- |
| INCLUDE     | `apps/api/.env.example`                                                                          | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/prisma/migrations/20261116130000_payroll_management_history_enums/migration.sql`       | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261116131000_payroll_compensation_and_configuration/migration.sql` | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261116132000_payroll_runs/migration.sql`                           | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261117100000_payroll_approvals/migration.sql`                      | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261117110000_payroll_payslips_requests/migration.sql`              | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261117150000_payroll_employee_request_withdrawal/migration.sql`    | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118100000_payroll_disbursement_foundation/migration.sql`        | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118110000_payroll_disbursement_sandbox/migration.sql`           | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118120000_allow_draft_payslip_regeneration/migration.sql`       | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118130000_payroll_preferences/migration.sql`                    | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118140000_payroll_reconciliation/migration.sql`                 | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118150000_payroll_reconciliation_decisions/migration.sql`       | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/migrations/20261118160000_payroll_approved_snapshot_guard/migration.sql`        | committed            | existing              | Ordered schema/security SQL dependency                    |
| INCLUDE     | `apps/api/prisma/schema.prisma`                                                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| REVIEW      | `apps/api/prisma/seed-november-payroll-demo.ts`                                                  | committed            | existing              | Optional fixture-specific mutation tool already committed |
| INCLUDE     | `apps/api/scripts/audit-payroll-db-permissions.ts`                                               | untracked            | 2                     | Payroll implementation or shared integration dependency   |
| EXCLUDE     | `apps/api/scripts/verify-payroll-postgres.ps1`                                                   | untracked            | none pending decision | Explicit local-only launcher                              |
| INCLUDE     | `apps/api/src/app.ts`                                                                            | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/auth/auth.capabilities.ts`                                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/auth/auth.permissions.ts`                                                 | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/employees/workforce-management-history.ts`                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/modules/module-registry.json`                                             | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/modules/modules.service.ts`                                               | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/paymongo-disbursements.ts`                                        | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-administration.service.ts`                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-calculator.ts`                                            | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-disbursements.controller.ts`                              | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-documents.controller.ts`                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-overview.service.ts`                                      | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-periods.ts`                                               | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-preferences.ts`                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-reconciliation.service.ts`                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-report-export.ts`                                         | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-report-workbook.ts`                                       | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-reports.service.ts`                                       | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-runs.schema.ts`                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-runs.service.ts`                                          | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll-simulator.ts`                                             | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll.controller.ts`                                            | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll.schema.ts`                                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payroll.service.ts`                                               | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payslip-logo.ts`                                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/features/payroll/payslip-pdf.ts`                                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/lib/db.ts`                                                                         | committed + unstaged | 1                     | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/lib/payroll-db-permissions-audit.ts`                                               | untracked            | 2                     | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/lib/postgres-connection.ts`                                                        | untracked            | 1                     | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/src/shared/management-history.ts`                                                      | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/api/tests/features/auth/capabilities.test.ts`                                              | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/auth/module-access.test.ts`                                             | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/calculator.test.ts`                                             | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/database-permissions-audit.test.ts`                             | untracked            | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/periods.test.ts`                                                | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/phase2.test.ts`                                                 | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/phase3.test.ts`                                                 | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/phase5.test.ts`                                                 | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/postgres-concurrency.integration.ts`                            | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/reconciliation.test.ts`                                         | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/payroll/reports.test.ts`                                                | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/users/management-history-foundation.test.ts`                            | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/features/users/role-policy.test.ts`                                              | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/api/tests/support/pglite-app.ts`                                                           | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-administration.spec.ts`                                                    | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-overview.spec.ts`                                                          | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-phase2.spec.ts`                                                            | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-phase5.spec.ts`                                                            | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-reconciliation.spec.ts`                                                    | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-reports.spec.ts`                                                           | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-request-details.spec.ts`                                                   | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/payroll-runs.spec.ts`                                                              | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/regression-support.ts`                                                             | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/e2e/superadmin-module-access.spec.ts`                                                  | committed            | existing              | Existing fixture or regression coverage                   |
| REVIEW      | `apps/web/next-env.d.ts`                                                                         | committed + unstaged | none pending decision | Generated production type-import correction               |
| INCLUDE     | `apps/web/src/app/(portal)/attendance/my-payroll/page.tsx`                                       | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/approvals/page.tsx`                                    | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/compensation/page.tsx`                                 | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/disbursements/page.tsx`                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/payslips/page.tsx`                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/reconciliation/page.tsx`                               | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/reports/page.tsx`                                      | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/runs/page.tsx`                                         | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/module/payroll/settings/page.tsx`                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/my-payroll/page.tsx`                                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/app/(portal)/staff/my-payroll/page.tsx`                                            | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/layout/breadcrumbs.tsx`                                                 | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/layout/sidebar.tsx`                                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/alert.tsx`                                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/button-variants.ts`                                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/confirmation-dialog.tsx`                                             | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/dropdown-menu.tsx`                                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/filter-select.tsx`                                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/hover-tooltip.tsx`                                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/money-input.tsx`                                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/overview-panel.tsx`                                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/responsive-data-table.tsx`                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/select.tsx`                                                          | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/settings-section.tsx`                                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/side-panel.tsx`                                                      | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/switch.tsx`                                                          | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/table-pagination-footer.tsx`                                         | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/table.tsx`                                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/tabs.tsx`                                                            | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/use-paginated-list.ts`                                               | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/components/ui/use-table-search-query.ts`                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/auth/api/auth-api.ts`                                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/auth/model/permissions.ts`                                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/dashboard/model/workspace-modules.ts`                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/api/payroll-api.ts`                                               | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/api/payroll-runs-api.ts`                                          | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/model/money.ts`                                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/model/period-format.ts`                                           | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/pages/payroll-compensation-page.tsx`                              | committed + unstaged | 3                     | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/pages/payroll-documents-page.tsx`                                 | committed + unstaged | 3                     | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/pages/payroll-overview-page.tsx`                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/pages/payroll-runs-page.tsx`                                      | committed + unstaged | 3                     | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/payroll/pages/payroll-settings-page.tsx`                                  | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/request-workflow/api/workflow-api.ts`                                     | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/request-workflow/components/quotation-money-input.tsx`                    | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/request-workflow/model/quotation-money.ts`                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/settings/pages/settings-page.tsx`                                         | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/workspaces/components/module-card.tsx`                                    | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/workspaces/model/module-registry.ts`                                      | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/workspaces/model/route-policy.ts`                                         | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/features/workspaces/pages/module-entry-page.tsx`                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/lib/content-security-policy.ts`                                                    | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/src/lib/money-input.ts`                                                                | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `apps/web/test/module-registry.test.mjs`                                                         | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/test/payroll.test.mjs`                                                                 | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/test/quotation-money.test.mjs`                                                         | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/test/route-policy.test.mjs`                                                            | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/test/security-headers.test.mjs`                                                        | committed            | existing              | Existing fixture or regression coverage                   |
| INCLUDE     | `apps/web/test/workspace-modules.test.mjs`                                                       | committed + unstaged | 3                     | Existing fixture or regression coverage                   |
| INCLUDE     | `compose.yaml`                                                                                   | committed            | existing              | Payroll implementation or shared integration dependency   |
| INCLUDE     | `docs/features/module-role-access.md`                                                            | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/features/payroll-disbursement-foundation.md`                                               | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/features/payroll-phase-3-audit.md`                                                         | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-administration-8.3.md`                                                             | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-deployed-db-permissions-audit-9.4.md`                                              | untracked            | 4                     | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-edge-cases-audit-9.3.md`                                                           | untracked            | 4                     | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-final-pre-push-audit.md`                                                           | untracked            | 4                     | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-outstanding-risk-closure-9.5.md`                                                   | untracked            | 4                     | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-overview-8.1.md`                                                                   | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-pr-preparation.md`                                                                 | untracked            | 4                     | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-reconciliation-7.1.md`                                                             | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-reconciliation-7.2.md`                                                             | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-reconciliation-7.3.md`                                                             | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-regression-9.2.md`                                                                 | untracked            | 4                     | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-reports-8.2.md`                                                                    | committed            | existing              | Feature or verification documentation                     |
| INCLUDE     | `docs/payroll-security-financial-audit-9.1.md`                                                   | untracked            | 4                     | Feature or verification documentation                     |
