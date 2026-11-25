# PG-007 Regression Preservation

## Existing PG-007 coverage retained

The following declarations and assertions were preserved while adding PG-007 coverage:

| Existing coverage                                                                                                                           | Preserved assertions / behavior                                                                                                 | PG-007 relationship                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/web/test/attendance.test.mjs` — `all attendance navigation pages preserve module ownership and role boundaries`                       | Existing route registry and module ownership checks                                                                             | T001; run with the focused unit command.                                                              |
| `apps/web/test/attendance.test.mjs` — `[PG-003-F001-A001-T001] personal attendance selection requires active STAFF or ADMIN`                | Existing active STAFF/ADMIN policy predicate                                                                                    | Reused by PG-007 identity; assertions retained.                                                       |
| `apps/web/e2e/attendance.spec.ts` — `attendance overview summary layout at {width}px`                                                       | Page heading, attendance link, refresh response, settled loading state, and no horizontal overflow at 390, 820, and 1440 px     | T021; existing assertions retained. T007 adds an assertion that refresh sends the visible date range. |
| `apps/web/e2e/async-resource.spec.ts` — `attendance request failures show an error and recover on retry`                                    | 503, 503, successful retry sequence; page-specific error text; retry controls; three total requests; intentional live-mode skip | T015 adds unavailable figure/section assertions; the original scenario remains.                       |
| `apps/api/tests/features/attendance/management.test.ts` — `personal overview derives identity from the session and rejects scope overrides` | Session-derived personal scope, STAFF/ADMIN identity, and rejection of caller-supplied department/employee overrides            | T016 adds anonymous 401 and USER 403 checks and verifies denied responses omit personal data.         |
| `apps/api/tests/features/attendance/superadmin.test.ts`                                                                                     | Existing Superadmin denial of personal overview remains unchanged                                                               | Included in the focused API selection.                                                                |

No skip was removed, and no retry or assertion was weakened. Existing-sufficient cases T001 and T021 remain represented in the test inventory.

## Shared regression findings

- PG-007 does not render the shared `RowActionsMenu`; PG-004-D-001 is not attributed to this page.
- PG-006 T018 continues to reproduce the confirmed shared keyboard-menu defect. PG-006 T024 remains intermittent at 820 px, T025/C001 remains contract-blocked, and its default history timezone basis remains unspecified.
- PG-006 ADMIN-without-Employee behavior remains HTTP 409 with limited UI recovery.
- Earlier findings remain as recorded in the cumulative ledger: PG-001 whitespace-only token contract; PG-002 create/edit/API validation differences and 401/403 navigation behavior; PG-003 query/navigation-state contract; PG-004-D-001; PG-005 cleared-date and detail-panel persistence contracts.

## Change boundary

Only test sources, the isolated browser-server fixture, QA reports, and the Phase 2 ledger were changed for this task. No production source, route behavior, authentication policy, API implementation, schema, or migration was modified. The incidental `apps/web/next-env.d.ts` type-generation change is restored to its task-entry bytes after final typecheck.
