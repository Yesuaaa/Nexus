# PG-020 Regression Preservation

Entry: branch 293-test-full-system-audit-for-verifying-recent-changes, HEAD 6d8485e25287e9e958298eaa9f3594c03ab94149. Existing ledger modification and eight untracked design reports were preserved. No intervening commit, staged change, production change, schema change, skip, retry change, or assertion removal was authorized or made.

Original Dashboard nine registered tests remain; five new declarations make fourteen. The API workflow file receives only response-key assertions after the original list request. Original notification limit, ordering, preference, cross-client denial, single-read, bulk-read and persistence assertions remain. New API declarations are separate. One new integration declaration makes eight new declarations total.

The eleven Phase 2.1 fingerprints are retained in PG-020_EXISTING_TEST_BASELINE.md. The Dashboard and workflow notification files intentionally differ for the approved additive groups; the remaining protected files are unchanged. The source-backed Account menu locator replaces Open account menu only in the affected Dashboard assertion. Existing failing workspace-selector assertions remain untouched.

PG-019 46/46 and its 22 controls, Stage 3 Attendance reconciliation, PG-004-D-001 and PG-016-D-001, PG-006/PG-011 intermittent results, PG-008/PG-012 environment blockers, PG-015/016 failures, PG-017 focus contract, and PG-018 KPI contract retain their historical classifications. This work does not certify penetration-test completeness.

The complete assertion and fixture mappings are preserved in the approved existing baseline and the execution case matrix. No earlier discovery file was rewritten.

## Expression preservation check

A TypeScript AST comparison against HEAD checked original expect/assert call expressions and multiplicity, normalizing whitespace and the authorized account-menu label correction. Dashboard: 24 original expressions, 51 current, zero missing. Workflow notifications: 37 original expressions, 38 current, zero missing. This checks preservation, not runtime correctness; new expect.poll assertions are additional. The initial sandbox attempt could not spawn read-only git; authorized rerun succeeded.
