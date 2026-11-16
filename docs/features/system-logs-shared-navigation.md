# System Logs — Shared navigation and module-aware filtering (Phase 2C.1)

Developed: 2026-11-16. Follow-up to the [Phase 2C UI](system-logs-superadmin-ui.md), [Phase 2B API](system-logs-superadmin-api.md) and [coverage inventory](system-logs-endpoint-coverage.md). UI-only refinement; production API access remains disabled. No Phase 2D work.

## Navigation and workspace context

The existing `/system-logs` route now has `moduleId: null` in the centralized route policy, as Calendar and other shared utilities do. The existing sidebar automatically places it under **Shared**, after Calendar and before Internal Messages, across all applicable internal workspaces. The **System Logs (Unavailable)** label, History icon and active/non-retired SUPERADMIN gate remain. No sidebar component or module provider refactor is needed.

The existing WorkspaceProvider resolves and retains the originating authorized workspace using its established account-scoped sessionStorage shell context. System Logs reads `useWorkspaceModuleId()` once to initialize the module filter; it does not overwrite that context or assume Administration. Direct entry without retained context defaults to All Modules. Invalid/forbidden remembered workspaces continue to be rejected by existing workspace resolution. Non-Superadmin routes remain denied before page mount/API requests.

Manual module selection overrides the initial default. Neither selection, Apply nor event investigation changes the workspace shell. Reset filters explicitly returns to All Modules. No module-specific pages, routes, components, frontend activation switches or API endpoints were added.

## Coverage and filter behavior

Options derive their IDs/titles from the existing module registry. Coverage classifications describe only sources integrated into System Logs, not the presence of domain tables elsewhere or completeness of application auditing.

| Module               | Displayed integration status   | Available coverage                                                                             |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| All Modules          | Limited/partial                | Only integrated Account/Workforce histories, never complete application-wide coverage          |
| Administration       | Supported — scoped management  | Account-management changes; auth/security/diagnostics excluded                                 |
| People & HR          | Supported — scoped management  | Employee, Department and Team management changes, not every workforce/self-service action      |
| Service Operations   | Partial — client accounts only | Client Management account history; catalog, request/workflow and other service events excluded |
| Project Management   | Not yet integrated             | No integrated source, even where workflow events exist                                         |
| Workforce Compliance | Not yet integrated             | Existing Attendance audit is not integrated into this UI                                       |
| Billing & Finance    | Not yet integrated             | Registry placeholder; no finance audit source introduced                                       |

Unsupported options remain visible and selectable. Opening from an unsupported workspace initializes that exact option and shows an unavailable-coverage explanation. No history request is sent for it, and no broad All Modules query is substituted. Results/counts from previous selections are hidden. A valid integrated selection or All Modules resumes normal bounded API reads. Coverage descriptions update with the draft selection and explicitly ask for Apply when results still use the previous module.

Opening/closing event details leaves applied/draft filters and cursor state intact. **Investigate operation** adds the operation UUID to the existing applied filters instead of clearing module, actor, subject, source or action. The first investigation saves the previous draft/applied filters and cursor stack. **Back to filtered history** restores that state and re-fetches the preceding page; it does not append stale/partial records. This back action is internal to the centralized page. Investigation state remains in memory; leaving the route/reloading reinitializes it from the retained workspace context rather than persisting audit filter IDs in browser storage/URLs.

Existing source-aware event IDs, page-scoped event/operation counts, signed cursors, date bounds, source-gap/scan-cap warnings, safe detail projection, responsive controls and focus restoration are retained. No global operation completeness is asserted.

## Changed files and reuse

- `apps/web/src/features/workspaces/model/route-policy.ts`: make System Logs a shared route; set shared navigation order. Exact role gate unchanged.
- `apps/web/src/features/system-logs/model/management-history.ts`: registry-derived coverage options, origin initialization and filter-preserving investigation helper.
- `apps/web/src/features/system-logs/pages/system-logs-page.tsx`: consume existing workspace context, show coverage, suppress unsupported queries, preserve/restore investigation state.
- `apps/web/test/system-logs.test.mjs`: update shared route expectation; add workspace/default/manual-filter and coverage tests.
- `apps/web/test/route-policy.test.mjs`: exact navigation order follows the new shared position; ordinary-role expectations unchanged.
- `apps/web/e2e/system-logs.spec.ts`: verify shared position and retained context across five implemented workspaces; all/manual module selection, unsupported options/no requests, responsive investigation/back preservation and existing behavior.
- Documentation: this report, feature index, RBAC, module reference and a follow-up link in the historical Phase 2C report.

Reused without changes: sidebar grouping, workspace resolver/provider and account-scoped shell storage, centralized route, FilterSelect/Radix Select, Button, responsive table, SidePanel, useAsyncResource, authenticated same-origin client and the existing API/adapters. All earlier uncommitted work is preserved. No backend APIs/gate, audit writers, schemas/migrations, business workflows or logging sources were changed.

## Validation

Frontend unit suite passes 129 tests, including role/direct-route rules, all authorized originating contexts, default/manual module behavior, supported/partial/unintegrated catalog entries and existing filters/details/pagination. Responsive browser tests use the production-built frontend with isolated HTTP fixtures only; there is no live browser-to-Express integration claim or gate activation.

The browser suite retains mobile/tablet/laptop/desktop coverage (390/768/1280/1600 px), navigation drawer accessibility, detail focus restoration, cursor replacement, operation investigation, source failures, safe unavailable responses and privacy. Five additional cases enter through Shared from an existing context-retaining page, check sidebar ordering/context, confirm the correct initial filter, select All Modules and verify unsupported-origin suppression. Initial tests used Profile without a profile mock; the final cases use the already-mocked Settings page rather than suppressing fixture errors. Initial typecheck also caught an ES2023 test-array helper, replaced with an ES2022-compatible expression without changing compiler settings.

| Executed validation                                                                                | Result                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `pnpm --filter @nexus/web test`                                                                    | PASS, 129/129 tests, exit 0                    |
| Isolated `playwright test system-logs.spec.ts --workers=2 --reporter=line --global-timeout=120000` | PASS, 14/14 tests, no skips, exit 0            |
| Full `pnpm test:api`                                                                               | PASS, 436/436 tests, no failures/skips, exit 0 |
| `pnpm format`                                                                                      | PASS, exit 0; scope inspected                  |
| `pnpm lint`                                                                                        | PASS, zero warnings, exit 0                    |
| `pnpm typecheck`                                                                                   | PASS, API/web, exit 0                          |
| `pnpm build`                                                                                       | PASS, API/web production builds, exit 0        |
| Report links / `git diff --check`                                                                  | PASS                                           |

Browser validation used `NEXUS_E2E_LIVE=0` and `NEXUS_E2E_BASE_URL=http://127.0.0.1:5274`, with a task-owned built frontend server and mocked API responses. The server was stopped afterward. The updated desktop screenshot was visually inspected. Existing pg and Playwright environment warnings remain non-fatal. No new failures remain in executed checks; the full pre-existing browser suite was not run. No live browser-to-backend integration is claimed.

No database migration, seed, production privilege inspection, logging collection or deployment was performed.

## Remaining limitations

- Production access remains locked, with the existing Unavailable indication. Durable access evidence and deployed database protections are still prerequisites; no frontend state can satisfy them.
- Supported labels mean the scoped management contracts only. All Modules includes no new source or backfill; unsupported modules remain unintegrated.
- Manual investigation state is retained within the mounted page and its explicit Back action. URL bookmarking, reload restoration and cross-route persistence of audit filters are absent; only the established workspace shell context persists.
- Existing query-cost, scan-cap, late-commit and provisional retention limitations remain as documented in earlier phases.

Stop after Phase 2C.1. Phase 2D and production activation have not started.
