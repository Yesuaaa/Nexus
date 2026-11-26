# PG-017 Edge Case Matrix

| Concern                                      | Evidence / design direction                                                                          | Status                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0/1/11 rows, page boundary                   | page:61 and service:67, existing PGlite 11 records                                                   | Existing static coverage; planned empty and page-shrink cases                            |
| Search whitespace, 100/101, duplicated query | page:49,127; schema:23; existing 101 and repeated query                                              | Partial                                                                                  |
| Invalid status and unavailable database enum | schema:12; service:48                                                                                | Partial; distinguish invalid 400 from valid unavailable empty                            |
| Foreign detail and list                      | service:45,93; existing PGlite assertions                                                            | Covered in inspected declarations; integration unverified                                |
| Pending, retry, abort, delayed responses     | request-details-drawer.tsx:56,114                                                                    | Retry covered by mock; races unverified                                                  |
| Escape and focus                             | request-details-drawer.tsx:81; side-panel.tsx:66                                                     | Close-button focus covered, Escape focus proposed                                        |
| Shared keyboard menu                         | booked-services-table.tsx:178 uses direct button; no shared row action menu identified in this table | PG-004-D-001 not attributed; direct row action verified                                  |
| PG-016 focus issue                           | billing page uses Dialog, booking uses SidePanel and explicit fallback                               | Different implementation; no reproduction inferred                                       |
| Session expiration, inactive account         | Authentication middleware and client refresh path                                                    | Auth middleware rejects inactive or expired session; shared refresh is separately traced |
| Long text and mobile overflow                | request-details-body.tsx:73; booked-services.spec.ts:325,374                                         | Partial                                                                                  |
| Snapshot consistency                         | list RepeatableRead transaction service:48                                                           | Optional shared-infrastructure verification; see decision below                          |

No test execution or defect confirmation occurred.

## Recovery decisions

- Search preview may omit ID-only matches temporarily; the server searches ID. Test the final accepted server result, and do not invent identical preview behavior. Literal `%`, `_` and backslash are escaped by `apps/api/src/shared/query/pagination.ts:91`.
- `usePaginatedList` aborts and rejects stale effects when filters/page change; `useAsyncResource` does likewise for detail. Controlled delayed responses are browser-mock tests; a concurrent refresh is skipped while in flight. Background 5xx/network errors preserve previously loaded rows, while a current initial error displays retry.
- A valid page beyond last is clamped by the browser after a response; the API itself accepts through 100000 and returns the requested window, not a clamped page. A 0, non-decimal or 100001 is rejected.
- Role helper requires USER without an additional service permission; active account and session are enforced separately. Foreign IDs receive 404. No protected file is fetched by this page.
- No PG-004-D-001 attribution: table action is a direct button. PG-016 dialog defect remains open, and SidePanel uses explicit shared focus restoration. Test keyboard/Escape on this page without presuming failure.
- Deep-link focus target when no suitable prior focused element exists is a product/accessibility clarification: fallback attempts `.focus()` on row or heading, but a non-focusable heading does not by itself guarantee focus; do not require success without verifying focusability.
- PostgreSQL decision: OPTIONAL / FUTURE. RepeatableRead is deliberately used for consistent rows and count during concurrent writes; current PGlite tests verify static pagination only, not interleaving. PostgreSQL-specific concurrent snapshot verification would add useful independent coverage but is a shared pagination infrastructure concern, not required for this page's read-only, separately authorized focused suite. No existing inspected PostgreSQL suite covers this list invariant. No lock, mutation, payment, or page-specific write invariant justifies a new mandatory test.
