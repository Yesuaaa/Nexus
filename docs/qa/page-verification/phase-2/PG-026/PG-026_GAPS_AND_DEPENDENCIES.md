# PG-026 Gaps and Dependencies

See the [coverage matrix](PG-026_TEST_CASE_SPECIFICATION.md#comprehensive-testing-coverage-matrix).

- C001, PG-026-F018-A001-T018. Product must decide client compensation versus explicit server portal enforcement, including server cleanup expectations when logout is unavailable. Login is shared and returns a session before the form applies portal policy. Local clearing cannot establish remote revocation. Treat this as a security design question, not a confirmed privilege escalation.
- C002, PG-026-F019-A001-T019. Valid existing USER session follows client landing on the workforce URL. Decide whether to keep role-based landing or present a separate workforce interaction. Preserve known role rules meanwhile.
- Local limiter scope is process-specific. Distributed behavior and proxy topology are environment concerns and no availability limit is inferred for deployment.
- Real rewrite and independent PostgreSQL overlap are unverified. Require future owned loopback instances, browser binaries, migrations in a disposable database and provider-specific teardown. No observed PG-026 environment blocker.
- PG-025 stays at 16 PASS and two retained failures, C001/C002 deferred. Its Phase 7 and fresh status-answer observations remain distinct from unreached assertions. Earlier pages stay governed by the cumulative ledger.
