# PG-014 Gaps and Dependencies

## Product contracts

- **G1 — Clearing either date.** Current hook disables the request, retains settled data, clears an unrelated prior error and can show figures from the previous range. Product needs to decide between retaining, blanking, or prompting when one date is absent. A004-T002 verifies request suppression and recovery. A004-T003 defers the display requirement. Evidence PAGE 31–39 and LOAD 89–95.
- **G2 — In-flight scope changes.** Current service uses RepeatableRead with headship and report rows read inside the same transaction. Between-request committed scope semantics are implementable. A019-T003 defers any stronger mid-request revocation guarantee. Evidence SCOPE 82–100 and management 656–793.

The Phase 1 mixed-scope wording and the earlier feature document's audit description need historical reconciliation under separate authorization. Filter link propagation currently uses static URLs. Zero approved leave is represented independently from absence of session data. API recent activity carries names even though the page does not display them. Test projection and isolation against the current response, with any tighter data projection requiring its own decision.

## Shared risks and isolation

The page uses Radix FilterSelect, DateInput and plain link actions. It does not mount the row-action menu implicated in PG-004-D-001. The page-specific keyboard cases exercise actual select and date controls. The prior T024 problem remains a PG-006 intermittent at 820px. Shared shell and fixture compatibility warrants the 820px verification in this design, with no attribution to PG-014. PG-011 transfer/reverification tests use common forwarding/teardown mechanics, but PG-014 has no review/Edit actions. Controlled stale-response cases should release all gates and avoid teardown races. PG-012's prior seed-state issue stays open independently.

Use fresh PGlite with applied harness migrations, fixed attendance clock, unique actors, named departments and no preexisting attendance/leave in the fixture dates, except explicit seed rows. Verify exact workday and approved leave counts before the cap test. Keep auth sessions valid by real clock and attendance reporting deterministic by injected clock. Restrict queries and fixture requests to loopback. Per-test app and database teardown own cleanup. Attendance mutations, seed mechanisms and any reconciliation used in compatibility cases belong to the isolated fixture.

No new PostgreSQL lock invariant is needed for the implemented PG-014 GETs. If G2 is resolved with a database snapshot requirement, use a disposable independently identified PostgreSQL instance, migrate an empty schema, seed exactly two departments/current head and target workdays, pause at a deterministically signaled read boundary and use a second connection for the authorized transfer. Assert the approved in-flight contract and the next-request outcome, then close sessions and drop the owned database. Connection ownership, migrations and confirmed seed state would be prerequisites. Do not reuse the seeded PG-012 database.

PG-013-style forwarding remains suitable for page-specific persisted output; it bypasses the Next API rewrite. Preserve that limitation in execution records. See [existing baseline](PG-014_EXISTING_TEST_BASELINE.md) and [implementation plan](PG-014_UNIT_API_E2E_PLAN.md).

Design is ready for separately authorized Phase 2.2 implementation on the 36 implementable records, subject to the stated fixture and toolchain prerequisites. The two contract records stay deferred.
