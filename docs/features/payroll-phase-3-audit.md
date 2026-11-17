# Payroll Phase 3 Repository Audit

## Compensation

- `EmployeeCompensation` references the existing `Employee`; `effectiveFrom` and `effectiveTo` are PostgreSQL `DATE` fields with inclusive endpoints. Phase 2 creates versions in strictly increasing start-date order, closes the previous version on the day before the next version, and serializes writes with a transaction advisory lock. A rate change can therefore split a payroll period into multiple effective-date segments; the period calculator must inspect every intersecting version rather than select the latest one.
- Base rates and `CompensationComponent.amount` use `Decimal(12,2)`. The only component calculation type is `FIXED`; components are `ALLOWANCE` or `RECURRING_DEDUCTION`. The component model does not identify a semi-monthly allocation rule.
- Employee records are not duplicated. Compensation history must retain each version ID and amount in a run snapshot.

## Payroll configuration

- `PayrollConfiguration` is also date-effective and append-only through Phase 2. Configuration dates are inclusive; a new version closes the previous one on the preceding date.
- `MONTHLY` means day 1 through the calendar month's last day. `SEMI_MONTHLY` means day 1 through the configured cutoff, then cutoff + 1 through month end. The cutoff is constrained to days 1–27, so both periods exist in February.
- Date-only payroll values are serialized as `YYYY-MM-DD`; the current API uses the Asia/Manila date for “today.” Calendar generation must use UTC date arithmetic over date-only values, not the host or browser timezone.
- A schedule version can begin or end inside a regular cutoff. Generated period candidates will be clipped to that version's effective dates; partial candidates remain valid periods, while the calculation engine blocks unsupported salary proration.

## Attendance

- Attendance policies define an IANA timezone, seven weekdays, `isWorkingDay`, `requiredMinutes`, unpaid-break behavior, and overnight-review behavior. Assignments have an inclusive `effectiveFrom` and exclusive `effectiveUntil`.
- A workday is lazily created when an attendance session is recorded. It snapshots the assignment, timezone, workday flag, required minutes, and policy behavior. Therefore, absence of a workday is not by itself proof of an unpaid absence.
- Sessions use server-recorded instants and can change through clock actions or approved corrections. Breaks record paid/unpaid state. `summarizeAttendance` computes elapsed worked time, subtracts unpaid breaks, and exposes incomplete status and excess minutes. Attendance may change after a payroll calculation, so every calculation revision must store the inputs used; later recalculation creates a new revision.
- `AttendanceAdjustment` has `PENDING`, `VERIFIED`, `APPROVED`, and `REJECTED` statuses. Overtime records store proposed timestamps and minutes. Approval revalidates the request against current attendance. Approved overtime has no configured payroll multiplier, so Phase 3 records it as an unpriced warning and does not pay it. Pending or verified adjustments are review warnings. Missing attendance never creates an automatic salary deduction.
- No Leave model or leave-pay policy exists.

## Employee eligibility

- `Employee.status` is `ACTIVE`, `INACTIVE`, or `ON_LEAVE`; `startDate` is nullable. There is no termination/end date, and `Employee.userId` is optional.
- Payroll selection can include Employees without User accounts. An unknown start date, inactive employee with no historical end date, or on-leave employee creates an eligibility review/block rather than an invented eligibility date or leave rule.

## Reuse and existing coverage

- No Payroll Period or Payroll Run model, calculation engine, or run UI exists. The Payroll Runs sidebar entry is disabled.
- The API already provides payroll read/manage authorization, Express router conventions, Prisma transactions, page pagination, HTTP error mapping, and append-only workforce management history.
- The web app already provides Payroll module layout/route policies, `ResponsiveDataTable`, `usePaginatedList`, `useAsyncResource`, `SidePanel`, detail lists, forms, selects, date inputs, confirmations, pills, empty states, pagination, notifications, and the account context used for role-aware controls.
- Phase 2 has PGlite API integration tests, Node web tests, and Playwright role/UI tests. Its previously unverified Next production build stalled after “Creating an optimized production build”; a fresh build must be attempted after Phase 3.

## Component and code reuse report

- Payroll calculations read the existing `Employee`, effective-dated `EmployeeCompensation` and `PayrollConfiguration` records, attendance assignments, workday snapshots, sessions, breaks, and adjustments. The feature does not create a duplicate employee or attendance model.
- Time validation reuses `attendanceWorkedMilliseconds` from Attendance so payroll applies the same interval and unpaid-break rules. Attendance assignment/workday relations are loaded through the existing `attendanceWorkdayInclude` query shape.
- Routes use the existing Payroll read/manage permissions, authentication middleware, HTTP error handling, pagination helpers, Prisma transactions, and append-only workforce management history. Payroll events record safe identifiers and outcome codes rather than compensation amounts or calculation payloads.
- The Payroll Runs page reuses `PageHeader`, `ResponsiveDataTable`, `usePaginatedList`, `useAsyncResource`, existing form and filter controls, `SidePanel`, confirmation dialogs, detail fields, pills, empty states, pagination, notifications, and account context. No new UI primitives or dependencies were added.
- The period generator, conservative calculator, immutable calculation snapshot/run persistence, and Payroll Runs page are new because the repository had no payroll period/run equivalents. They keep the new behavior inside the Payroll feature while relying on the shared attendance and UI infrastructure above.

## Conservative calculation policy selected by the user

- A full-calendar-month payroll period under a monthly schedule can use a `MONTHLY` base rate only when exactly one compensation version covers the whole month. Full fixed components on that version are applied once to that whole month.
- Monthly rates over semi-monthly or partial periods and monthly-rate revisions inside a period are blocked for review; no proration formula is inferred.
- Daily rates use complete scheduled attendance workdays. Hourly rates use recorded worked time with paid/unpaid-break behavior from the existing attendance summary; time beyond configured required minutes is not assigned a pay multiplier. Incomplete, missing, overlapping, or disputed attendance makes the item review-required or blocked. Any known subtotal remains clearly partial and is excluded from finalized-looking totals.
- Recurring fixed components are not split across semi-monthly or partial periods. Overtime is not paid without an existing multiplier. No absence or leave deduction is inferred.
- No custom payroll-policy configuration UI or model is added in this phase.
