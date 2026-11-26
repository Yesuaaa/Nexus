# PG-020 Regression Preservation

Entry: branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 6d8485e25287e9e958298eaa9f3594c03ab94149. Existing ledger modification and eight untracked design reports were preserved. No intervening commit, staged change, production change, schema change, skip, retry change, or assertion removal was authorized or made.

Original Dashboard nine registered tests remain; five new declarations make fourteen. The API workflow file receives only response-key assertions after the original list request. Original notification limit, ordering, preference, cross-client denial, single-read, bulk-read and persistence assertions remain. New API declarations are separate. One new integration declaration makes eight new declarations total.

The eleven Phase 2.1 fingerprints are retained in PG-020_EXISTING_TEST_BASELINE.md. The Dashboard and workflow notification files intentionally differ for the approved additive groups; the remaining protected files are unchanged. The source-backed Account menu locator replaced “Open account menu” in the affected Dashboard assertion. At that prior implementation checkpoint, the two failing workspace-selector declarations and their assertions remained untouched; the recovery addendum below records the route-backed correction.

PG-019 46/46 and its 22 controls, Stage 3 Attendance reconciliation, PG-004-D-001 and PG-016-D-001, PG-006/PG-011 intermittent results, PG-008/PG-012 environment blockers, PG-015/016 failures, PG-017 focus contract, and PG-018 KPI contract retain their historical classifications. This work does not certify penetration-test completeness.

The complete assertion and fixture mappings are preserved in the approved existing baseline and the execution case matrix. No earlier discovery file was rewritten.

## Verification-recovery preservation evidence

- **Current task-entry baseline:** branch `293-test-full-system-audit-for-verifying-recent-changes`, HEAD `a367b8af813328c7dd75002faa8bd81eeb0d8863`; task-entry index and worktree were clean. This HEAD is one commit after the previously reported `6d8485e25287e9e958298eaa9f3594c03ab94149`; the intervening commit contains the PG-020 implementation and documentation. No user changes were overwritten.
- **Client-navigation identity:** the `for (const width of [1440, 390])` loop and title `clients have direct navigation without a workspace selector at ${width}px` remain unchanged, so both 1440px and 390px registrations retain their identity.
- **Assertion call sites:** the original parameterized test had 9 source-level `expect(...)` call sites; the recovered test has 15. Eight original call sites are unchanged. The one obsolete root `toHaveURL(/\/dashboard$/)` was replaced because `/` now serves `LandingPage`; seven focused checks now verify the root pathname/public CTA, exact anonymous public-services query, HTTP 200/no Authorization, empty listing, and direct `/dashboard` destination. The `/module` redirect, Dashboard landmark, no-workspace assertions, six client-link checks, no Switch Workspace check, and document-width assertion remain.
- **Shared fixture protection:** only `GET /api/public/services` is fulfilled before the Bearer assertion. Protected request authentication assertions, response handlers, role fixtures, and authorization-negative behavior are unchanged. The exact anonymous request contract is now asserted by the Client-navigation test.
- **Accessible-name correction:** the internal-role shell test still opens the account menu and verifies logout/token cleanup. Its locator now uses the source `aria-label="Account menu"`; no action, expected logout, or assertion was removed.
- **Verification:** workspace-selector 22/22, anonymous/protected-route and expired-session 2/2, Dashboard 14/14. The original real-rewrite integration remains 1/1 from the prior run; its spec/config has no `regression-support` import, so the changed mock is not part of that integration.
- **Remaining contract proof:** A011-T002 is now recorded PARTIAL. Its assertions prove the periodic in-flight guard and that scheduled reads stop after unmount; they do not observe an aborted network request or prove late-response suppression. The source `AbortController` call is not counted as runtime proof. No extra unapproved case was added.
- No test declaration was removed, skipped, disabled, or renamed. No retry/timeout was increased. No production, schema, migration, or rewrite file changed.

## Expression preservation check

A TypeScript AST comparison against HEAD checked original expect/assert call expressions and multiplicity, normalizing whitespace and the authorized account-menu label correction. Dashboard: 24 original expressions, 51 current, zero missing. Workflow notifications: 37 original expressions, 38 current, zero missing. This checks preservation, not runtime correctness; new expect.poll assertions are additional. The initial sandbox attempt could not spawn read-only git; authorized rerun succeeded.
