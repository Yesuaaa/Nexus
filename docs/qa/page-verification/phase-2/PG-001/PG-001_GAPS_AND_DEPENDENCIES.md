# PG-001 Gaps and Dependencies

**Review status:** Source-based coverage analysis only; test execution was not requested and was not performed.  
**Page:** `PG-001`, `/`; Phase 1 coverage baseline is [partial](../../PHASE_1_EXISTING_TEST_COVERAGE.md).  
**Case details:** See [test specification](PG-001_TEST_CASE_SPECIFICATION.md) and [edge-case matrix](PG-001_EDGE_CASE_MATRIX.md).

## Gap matrix

| Atomic feature                | Existing tests/assertions                                                                                                                         | Missing coverage                                                                                                                                            | Proposed scenarios                      | Unclear contract or implementation limit                                                                                                | Execution dependency                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `A001` anonymous/falsy branch | Direct anonymous `/` URL and heading assertions in `apps/web/e2e/auth/regression.spec.ts:390-408`; no-token case is bundled with protected paths. | Empty-string storage value, storage-read failure, and root-specific localStorage-only session case. Existing assertion does not check API activity at root. | `T001` unit; `T002` and `T003` browser. | No product defect is evidenced. The helper explicitly catches storage read failures.                                                    | Web unit runner and local Playwright web server; browser tests need no API for the branch itself.          |
| `A002` truthy-token branch    | Related session storage, `/dashboard`, refresh, role login, and 401 tests exist, but none begins at `/` with a session token.                     | Core root-to-dashboard path; root-started role landing, invalid-session rejection, API outage, and expired-access refresh.                                  | `T004`–`T007`, `T009` browser.          | Root does not verify token validity. The token’s truthiness is the implemented branch condition; account validation happens downstream. | Playwright with fixture account responses or deterministic mocked auth responses. No live API or database. |
| `A003` replace navigation     | Source calls `router.replace()` for both paths. No history assertion found.                                                                       | Back-button behavior after redirect.                                                                                                                        | `T008` browser.                         | No unhandled ambiguity in implementation; verify browser history outcome.                                                               | Playwright local web server; no backend.                                                                   |

## Contract questions

1. **Whitespace-only token:** Should any non-empty value count as a session marker, or should whitespace be treated like an empty value? Current code treats whitespace as truthy and chooses `/dashboard`. Until product intent is confirmed, `T010` remains `CONTRACT CLARIFICATION REQUIRED` and is not part of the proposed-case totals.
2. **Destination preservation:** The root currently selects the fixed paths `/dashboard` or `/login`; no return-to path, query, or hash contract was found in the inspected page. Do not add preservation assertions absent an approved requirement.

## Defects versus test gaps

- **Confirmed application defect:** None identified from source inspection.
- **Confirmed test coverage gaps:** No direct root-started truthy-token branch; no explicit empty-token or storage-read-failure assertion; no root-started auth handoff/error recovery; no history replacement assertion.
- **Indirect coverage, not proof of root behavior:** Existing localStorage-only checks start at `/accounts`; role and session checks start at login or portal routes.
- **Runtime status:** Source inspection cannot establish that route timing, browser history, or final UI assertions currently pass. All proposed cases remain unexecuted.

## Dependencies and execution limitations

- **Source/test changes needed at a later stage:** Add the unit assertion in `apps/web/test/auth-api.test.mjs` and a focused mocked Playwright file under `apps/web/e2e/auth/`. No app change is implied by the current evidence.
- **Fixtures:** Reuse `mockApi` for successful USER and internal-role account responses; use per-test route overrides for 401, 503, and refresh cases. Ensure each browser example starts with a clean context and seeds session storage before the root page script runs.
- **Database and external services:** None for proposed PG-001 cases. Do not configure production PostgreSQL, payment integrations, or live credentials.
- **PGlite:** Needed only by existing API session tests; not a prerequisite for this page’s local redirect test plan.
- **Live-mode caveat:** The current auth regression describe is skipped when `NEXUS_E2E_LIVE=1`; proposed mocked-only cases should live in a focused file that does not depend on live credentials.

## Recommended next implementation stage

After explicit authorization to implement tests:

1. Add the `getToken()` storage-exception unit case with guaranteed global descriptor cleanup.
2. Add the eight specified mocked browser cases in `apps/web/e2e/auth/home-redirect.spec.ts` without changing or weakening the existing regression assertions.
3. Resolve the whitespace-token contract before adding `T010`.
4. Run the focused web unit case and Playwright file, then the repository quality gates required by `AGENTS.md`; report actual command results separately from source inspection.

No implementation authorization is inferred from this design request.
