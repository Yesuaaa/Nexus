# PG-005 Gaps and Dependencies

**Discovery status:** COMPLETE for source-based discovery and design. Two browser expectations remain blocked by product contract questions; exclude both from implementable totals.

## Confirmed source-to-test gaps

| Gap                                                                    | Evidence                                                                                                                                                              | Planned coverage                                  |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Route denial matrix is incomplete for this route                       | Existing U1 covers common role cases; inactive accounts and administrative roles without employees:read are not directly asserted for /attendance/audit.              | T002 adds only missing negative route assertions. |
| Department filter UI is not asserted                                   | API scope coverage exists, but no test selects a department on the audit page and verifies query/page reset.                                                          | T003.                                             |
| Date filter UI and query reset are not asserted                        | API date contracts exist; no audit-page browser test verifies the selected range is sent and page resets.                                                             | T005.                                             |
| Initial list loading is not asserted                                   | Existing B2 checks busy refresh while old rows remain, but not the first skeleton.                                                                                    | T008 adds an initial-loading assertion to B2.     |
| Department-load failure/retry is not asserted                          | The page has a separate departments resource and Retry state.                                                                                                         | T009.                                             |
| Row formatting/fallback behavior is not asserted                       | Source includes explicit UTC formatting, actor/employee fallbacks, and entity/action labels.                                                                          | T011.                                             |
| Snapshot details are checked only structurally                         | B1 opens the detail panel and checks headings, but does not assert values, allowlisting, previous values, or read-only controls.                                      | T012.                                             |
| Keyboard interaction is not asserted                                   | B1 uses pointer open and Done close.                                                                                                                                  | T013.                                             |
| Anonymous and USER API denial are not directly asserted on audit       | Existing API tests cover non-head STAFF denial and Superadmin success; frontend guards do not prove API access control.                                               | T015.                                             |
| Invalid audit query combinations are under-tested                      | Current direct tests cover valid search/paging and recordsOnly rejection; malformed search/date/page/department parameters lack direct audit assertions.              | T016.                                             |
| UTC boundary, tie order, and sensitive-field omission are under-tested | Query source uses a half-open UTC interval, createdAt/id ordering, and omits internal correlation/operation metadata. Current assertions do not cover these together. | T017.                                             |

## Contract questions — do not invent expected results

### C001 — Clearing a date

The page issues no audit request when either date is empty. useAsyncResource retains the last successful resource data, so prior rows may remain visible. No product rule defines whether clearing From or Through should clear/hide results, show a validation message, or keep the prior result. T019 remains CONTRACT CLARIFICATION REQUIRED.

### C002 — Selected details during filter changes

The selected event is held independently from date, department, and search query state. The detail panel can remain open on a record while the list query changes. No product rule defines whether filter changes close the panel or preserve the selected event. T020 remains CONTRACT CLARIFICATION REQUIRED.

These are unresolved UI contracts, not confirmed defects. No PG-005 runtime defect was established in a design-only phase. PG-004-D-001 remains a separate confirmed mobile keyboard defect on /attendance/adjustments and is not modified or reclassified here.

## Carried-forward ledger items

Keep all earlier entries as recorded; this PG-005 discovery does not resolve them:

- PG-001 whitespace-only token semantics remain deferred.
- PG-002 unauthorized list-response destination and create/edit/API validation differences remain deferred.
- PG-003 query/navigation-state contract C001/T010 remains blocked.
- PG-004-D-001 remains open: on /attendance/adjustments at 390 px, ArrowDown reports an expanded row-action trigger but the accessible View details menu item is absent.

The cumulative ledger also retains prior completed implementation evidence and recorded failed PG-004 assertions. Do not summarize PG-004 as fully passing.

## External dependencies and environment

- Browser/API integration depends on the isolated attendance browser server, local Express app, and PGlite; API suites use tests/support/pglite-app.ts.
- Browser-only cases need deterministic mocks for department and audit reads, and should leave authentication/session routing real or use the established isolated fixture.
- Format, lint, and typecheck are repository gates. Test execution is prohibited during Phase 2.1 and was not performed.
- No schema or migration change is needed for the proposed cases. Do not target a configured/live database.

## Readiness

Phase 2.2 can implement the 11 unblocked additions/assertions using the proposed existing files and fixtures. T019/T020 stay out until product owners define the two expected UI behaviors. The discovery task is complete without resolving those questions.
