# Payroll Phase 3 Runs and Calculation Implementation Plan

> **For agentic workers:** Implement task by task in this branch, test-first. Do not commit.

**Goal:** Add effective-dated payroll periods, draft runs, immutable calculation revisions, and reviewable employee results using only existing employee, compensation, configuration, and attendance records.

**Architecture:** Add period generation and deterministic money calculation as separate payroll-domain modules. Persist every calculation as an immutable revision with per-employee input snapshots and component lines; serialize run recalculations and write workforce audit events in the same transaction. Expose read/manage APIs and a role-aware Payroll Runs page using existing shared UI.

**Tech Stack:** Existing Prisma 7/PostgreSQL schema and migrations, Express/TypeScript API, PGlite integration tests, Next.js 16/React 19 web app, Node tests, and Playwright.

**Spec:** `C:\Users\Altessa\.codex\attachments\c848c3c7-4c9f-4dda-a5b6-e97e1f6c5cf7\Pasted text.txt`; repository audit and selected policy: `docs/features/payroll-phase-3-audit.md`.

## Global Constraints

- Implement Phase 3 only. Do not implement approvals, payslip publication, PayMongo, disbursements, or staff self-service.
- Use existing Payroll read/manage permissions: Admin manages, Superadmin reads, and all other roles are denied.
- Keep calculation server-side. Never accept client-calculated monetary totals.
- Use Decimal arithmetic and exact decimal strings; never use JS floating-point arithmetic for money.
- Do not infer monthly proration, semi-monthly component allocation, overtime rates, absence deductions, or leave treatment.
- Reuse existing Employee, Attendance, Payroll Compensation, Payroll Configuration, authorization, audit, test, and UI infrastructure.
- Preserve all Phase 1 and Phase 2 uncommitted work. Do not commit.

## Review Focus

- Compensation revisions inside a period must retain all segment IDs and block unsupported monthly proration.
- Schedule changes inside a regular cutoff must produce non-overlapping clipped periods tied to the correct configuration version.
- Missing or incomplete attendance must create review/block status, never an automatic deduction.
- Pending/verified/approved overtime must never be paid without a multiplier; approved overtime minutes must not be double-counted as regular hourly time.
- Concurrent period creation and recalculation must preserve unique periods/items and immutable revision snapshots.

---

### Task 1: Date-only period generation

**Files:** Create `apps/api/src/features/payroll/payroll-periods.ts`; test `apps/api/tests/features/payroll/periods.test.ts`.

**Interface:** `generatePayrollPeriodCandidates(configuration, year): PayrollPeriodCandidate[]`, where candidates carry configuration ID, inclusive start/end date strings, frequency, and cutoff label.

- [x] Write tests for monthly February/leap-year ends; semi-monthly boundaries for cutoff 15 and cutoff 27; clipped periods across effective configuration boundaries; and no candidates outside the configuration's effective range.
- [x] Run `node scripts/run-tests.mjs tests/features/payroll/periods.test.ts`; verify expected assertion failures before adding the generator.
- [x] Implement date-only UTC calendar arithmetic and clip each regular schedule interval to the configuration's inclusive effective range.
- [x] Rerun the period tests and keep all cases green.

### Task 2: Period and run persistence

**Files:** Modify `apps/api/prisma/schema.prisma`; create migration `apps/api/prisma/migrations/<timestamp>_payroll_runs/migration.sql`; regenerate Prisma client.

**Models:** `PayrollPeriod`, `PayrollRun`, `PayrollRunCalculation`, `PayrollRunItem`, and `PayrollRunItemComponent`. A calculation revision owns unique employee items and exact input snapshots; a recalculation adds a revision rather than overwriting old results. Components preserve source IDs, exact amounts or null when unresolved, status, and non-sensitive calculation metadata.

- [x] Add PGlite migration/integrity tests first: unique config/boundary period, one run per period, unique employee per calculation revision, exact Decimal columns, valid range checks, and required foreign keys.
- [x] Run the focused migration test and verify failures occur for missing schema/constraints.
- [x] Add enums for period/run/item/revision/line status. Add indexes and unique constraints. Store nullable financial outputs for blocked calculations and JSON snapshots for source input reproducibility.
- [x] Generate Prisma client, run migration tests, then run API TypeScript checks.

### Task 3: Deterministic calculation engine

**Files:** Create `apps/api/src/features/payroll/payroll-calculator.ts`; test `apps/api/tests/features/payroll/calculator.test.ts`.

**Interface:** `calculatePayrollEmployee(input: PayrollEmployeeCalculationInput): PayrollEmployeeCalculationResult`. Inputs contain one inclusive period, employment state/start date, all intersecting compensation versions, assigned expected workdays, actual workdays/sessions/breaks, and all in-period attendance adjustments. The output carries item status, exact component amounts, totals where defined, warnings/blocks, and a serializable source snapshot.

- [x] Write tests for full-month monthly base/fixed components; a compensation revision inside a month; semi-monthly monthly salary; daily complete/incomplete/missing workdays; hourly logged work/breaks; fixed components on semi-monthly periods; pending/approved overtime; leave/inactive/unknown eligibility; overlap or open-session data; and Decimal rounding/totals.
- [x] Run the calculator tests and confirm each relevant test fails for the missing implementation, not a test/setup error.
- [x] Implement formulas only from the audit decision: full monthly amount only for one covering monthly version on a full monthly period; daily rate for complete policy workdays; hourly rate for recorded worked time, excluding unpriced excess; fixed components only for a complete monthly period; two-decimal Decimal rounding. Emit explicit review/block codes for unknown inputs and policy gaps. Do not calculate absence, leave, overtime premium, or unsupported proration.
- [x] Rerun calculator tests; add invariants that exact line totals equal item totals and blocked values never contribute to run totals.

### Task 4: Period, run, calculation, and history APIs

**Files:** Create `apps/api/src/features/payroll/payroll-runs.schema.ts`, `payroll-runs.service.ts`, and `payroll-runs.controller.ts`; modify `apps/api/src/app.ts` and `apps/api/src/features/employees/workforce-management-history.ts`; test `apps/api/tests/features/payroll/phase3.test.ts`.

**Endpoints:** `GET /periods`, `GET /periods/current`, `POST /periods`, `GET /runs`, `POST /runs`, `GET /runs/:id`, `POST /runs/:id/calculate`, `GET /runs/:id/items`, and `GET /runs/:id/items/:itemId` under `/api/payroll`.

- [x] Write API tests for Admin read/write, Superadmin read-only, Staff/USER/anonymous/inactive/deleted denial; period validation/duplicates; one run per period; correct employee item scoping; run calculation; recalculation history; and audit metadata excluding salary payloads.
- [x] Run the focused PGlite API test and verify routes are initially missing/unauthorized as expected.
- [x] Implement strict request validation and server-side period regeneration checks. Use existing `requireAuth`, Payroll permissions, Prisma, `paginate`, and HTTP error mapping.
- [x] Calculate inside a transaction from a consistent database snapshot, serialize by run ID, persist immutable revisions/items/components/snapshots atomically, and write a safe workforce audit record. A run can be recalculated only before any future approval lifecycle exists; this phase exposes no approval actions.
- [x] Test concurrent duplicate period/run creation, concurrent recalculation, rollback, snapshots, and audit consistency. Rerun focused API tests.

### Task 5: Payroll Runs interface

**Files:** Create `apps/web/src/features/payroll/api/payroll-runs-api.ts`, `apps/web/src/features/payroll/pages/payroll-runs-page.tsx`, and `apps/web/src/app/(portal)/module/payroll/runs/page.tsx`; modify `apps/web/src/components/layout/sidebar.tsx` and `apps/web/src/features/workspaces/model/route-policy.ts`; test in `apps/web/e2e/payroll-runs.spec.ts` and module-route tests.

- [x] Add browser tests for period creation, draft run creation, calculation, revision history, employee breakdowns/warnings, Superadmin read-only behavior, Staff/client denial, and narrow layouts. Run them to verify expected missing-route behavior.
- [x] Reuse `PageHeader`, `ResponsiveDataTable`, `usePaginatedList`, `useAsyncResource`, filters, search, pagination, `SidePanel`, details, pills, `ConfirmationDialog`, existing forms, `Button`, `EmptyState`, toast, and account context. Add no UI primitives or libraries.
- [x] Activate Payroll Runs navigation for authorized payroll readers. Admin sees create/calculate actions; Superadmin sees read-only runs and details.
- [x] Display periods/frequency, status, employee counts, calculated totals and blocked/review counts. Keep totals clearly labeled as calculated known amounts and show when blocked employees are excluded. Display source compensation IDs, attendance summaries, warnings, blocks, and prior calculation revisions.
- [x] Rerun browser tests at desktop and narrow widths; verify unavailable approval/payout/payslip actions are absent.

### Task 6: Final validation and review

**Files:** Update focused API/web/browser tests and the Payroll module docs only as needed.

- [x] Run `node scripts/run-tests.mjs` for the full API suite, the web `test` script, and the focused Playwright spec; report failures outside Payroll precisely.
- [x] Run Prettier on changed supported files and `--check`, full ESLint, and both web/API TypeScript checks using installed local CLIs if Corepack still prevents `pnpm` scripts.
- [x] Run the web production build and record its actual exit status; investigate and report any stall or failure.
- [x] Review the diff for RBAC enforcement, sensitive data in logs, exact Decimal handling, migration integrity, component reuse, and no Phase 4 behavior. Confirm the branch and leave all work uncommitted.

## Execution record

- The latest focused payroll API/calculator run passed 28/28 tests, covering period generation, Phase 2 compatibility, database constraints, reviewable totals, rollback, concurrency, compensation revisions, attendance gaps, overtime, and exact money arithmetic.
- The web unit suite passed. The four Payroll Runs Playwright flows passed against the local production build: Admin run creation/calculation/recalculation, Superadmin read-only access, Staff denial, and client denial at desktop and narrow widths.
- API and web TypeScript checks, full ESLint, and Prettier checks on changed files passed.
- `next build --webpack` and `prepare-standalone.mjs` completed successfully. The default Turbopack build stopped producing output during compilation and was interrupted; the successful Webpack build needed permission to write generated Next.js artifacts.
- A full API suite run before the final payroll-only test additions reported 468/484 passing. Its 16 failures were in other areas, including project management, booked services, calendar, workspace limits, and specialist listing. Focused Payroll tests were rerun afterward and passed 28/28.
- Work remains uncommitted on `262-featglobal-plan-and-implement-payroll-module`.
