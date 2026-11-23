# Superadmin service request visibility (Phase 3B.1)

Developed: 2026-11-14

2026-11-14: [Phase 3B.3A](superadmin-workflow-oversight.md) extends detail inspection with workflow status metadata and sanitized structured history. The original Phase 3B.1 exclusions below describe that phase's scope; private notes, conversations, financial content and files remain excluded.

## Architecture and authorization audit

The ordinary `/api/request-inbox` router calls `requireDepartmentHead` before all reads and acceptance. Its scope combines unclaimed requests routed to the current Staff head's department with requests already accepted by that department. Client request endpoints derive ownership from the session. Workflow snapshots, messages and downloads independently authorize participants or assigned approvers. None of these gates is relaxed for administrative inspection.

## Administrative inspection

Service Operations exposes administrative request inspection at `/module/service-operations`. In the Superadmin sidebar, **Service → Request** appears alongside Overview and Management in both the expanded sidebar and the collapsed flyout. Department heads use their own **Request** group for their department overview and inbox. A request uses `?request=<id>` for detail navigation, back navigation and reload.

Separate GET endpoints `/api/administrative-requests` and `/api/administrative-requests/:id` require authenticated Phase 2A module access and organization-wide read capabilities. They use the current database account, without requiring Staff, Department Head, Employee or project assignments. No mutation endpoints are added.

The list reuses inbox filter parsing, selected metadata, table sorting, shared pagination and search. The web list uses `usePaginatedList` for search previews, visible refresh, page clamping and pagination synchronized with row transitions. Filters cover all request statuses and departments. Department filtering uses the responsible department once accepted; unaccepted requests use current service routing. Search and department predicates combine with AND, preventing cross-department filter leakage.

The UI reuses RequestInboxTable in opt-in read-only mode and RequestDetailsBody without actions or message links. Administrative details and BookingDetailsDrawer share RequestDetailsDrawer for loading, retry, animated closing and focus restoration. The administrative drawer retains `?request=<id>` deep links and reload support; closing it leaves the list's search, filters and page intact. Each caller supplies its own authorized loader and body, so administrative inspection does not fetch booking-only fields or operational endpoints. Existing Department Head fields and actions are preserved. The response includes current status, service/package/timestamps, client business contact metadata, accepted/responsible department, routed departments, current head, accepting account, workflow stage, related project metadata and actual assigned personnel. Specialist preferences are explicitly separate from assignments.

All action capabilities except `read` are false. Free-form submissions, raw requirement JSON, private messages, conversation identifiers, workflow events, financial approval/payment records, credentials and files are excluded through explicit Prisma selection. No workflow snapshot or conversation service is called to populate the view.

Acceptance, rejection, staffing, quotation approval, payment verification, workflow mutations, private conversations and downloads remain deferred/protected. Diagnostics and System Logs are outside this phase.

## Validation

Offline PGlite tests cover cross-department reads, actual assignments, pending routing, pagination, combined filters, ordinary-role denials, unchanged head/client ownership, denied mutations, private-field exclusion and role revocation. Seeded private request conversations and actual workflow files remain inaccessible. Explicit workflow action attempts for quotation preparation/approval, payment verification and staffing are denied.

- `pnpm format`, `pnpm lint`, `pnpm typecheck` and the full production `pnpm build` passed.
- 47 selected backend tests passed: administrative requests, existing Request Inbox, cross-department inbox visibility, and backend regression.
- All 103 web unit tests passed.
- 39 selected browser tests passed: administrative requests, ordinary Request Inbox, Superadmin module entry and module-scoped navigation. This includes mobile status/department filters, sorting, pagination, detail reload, backend denial and absence of operational controls.

The standard `tsx` runner could not start because `uv_os_get_passwd` returns `ENOMEM` in this environment. The selected API tests were instead compiled with the existing test TypeScript configuration and executed with `node --test` against the offline PGlite harness. No live database was used.

Three old Request Inbox browser assertions expected internal roles to redirect to `/dashboard`; Phase 2B intentionally changed their fallback to `/module`. Those expectations were corrected without relaxing the denial or checking fewer inbox reads. The previously documented Client-milestone workflow assertion was not rerun and remains a separate [pre-existing failure](superadmin-project-management.md#validation). No selected test failures remain; the full API and browser suites were not run.

## Files changed in this phase

- API: `apps/api/src/features/request-inbox/administrative-requests.ts` (new read router); `apps/api/src/features/request-inbox/request-inbox.service.ts` (export existing safe selection); `apps/api/src/app.ts` (mount router).
- Web: `apps/web/src/features/request-inbox/api/administrative-requests-api.ts`; `apps/web/src/features/request-inbox/pages/administrative-requests-page.tsx`; `apps/web/src/features/request-inbox/components/request-inbox-table.tsx`; `apps/web/src/features/workspaces/pages/module-entry-page.tsx`; `apps/web/src/features/workspaces/model/route-policy.ts`.
- Tests: `apps/api/tests/features/auth/administrative-requests.test.ts`; `apps/web/e2e/administrative-requests.spec.ts`; `apps/web/e2e/request-inbox.spec.ts`; `apps/web/test/route-policy.test.mjs`.
- Documentation: this report, `docs/features/README.md`, `docs/features/module-role-access.md` and `docs/rbac.md`.

Existing uncommitted work from earlier phases is preserved. Administrative request mutations and all operational participation remain outside Phase 3B.1.
