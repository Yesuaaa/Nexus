# Client Management actor attribution — Phase 4B.4B.3A

Developed: 2026-11-15.

All three Client Management mutation endpoints now write durable administrative attribution through the existing `AccountManagementChange` infrastructure. None is deferred. This implements the Client portion of the [Phase 4B.4A audit](administrative-mutation-attribution-audit.md), reusing the [persistence foundation](administrative-attribution-persistence-foundation.md) and [Account Management integration](account-management-actor-attribution.md).

No schema, migration, permission catalog, history writer, Account Management workflow, Employee lifecycle, public registration, service-request workflow, or frontend implementation is changed. There is no new Client entity, history API/UI, Diagnostics, or centralized System Logs.

## Coverage and authorization

| Endpoint                  | Existing authorization, preserved                                                                                                | History with `CLIENT_MANAGEMENT` origin                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/clients`       | Authentication, `clients:read`, and `clients:create`; Admin/Superadmin only                                                      | `CREATED`: actual authenticated actor/role, new account ID, fixed database-returned `USER` role and persisted active status. Approved profile field names only |
| `PATCH /api/clients/:id`  | Authentication, `clients:read`, and Superadmin role; existing non-retired `USER` target                                          | `PROFILE_UPDATED`: actual changed field names; only active-state before/after and revocation completion can have values                                        |
| `DELETE /api/clients/:id` | Authentication, `clients:read`, and Superadmin role; existing non-retired `USER`; related requests/projects still block archival | `ARCHIVED`: actual retirement timestamp and any active-state transition, plus session-revocation completion                                                    |

Client deletion remains soft archival: it disables and retires the login rather than deleting the User. Existing profile, relationship and business-history data remains intact. An already-inactive Client records only its retirement transition, without falsely claiming a status change. A missing, wrong-role, or already-retired target keeps its existing not-found response. A linked target still returns the existing 409 before any archival or session revocation.

Creation still ignores submitted role values and stores `USER`. Password policy/hashing, profile validation, trimming/email normalization, case-insensitive duplicate protection across all accounts including retired ones, target filtering, error messages and safe response DTOs are preserved. The database-returned role used for history is stripped from the returned Client object, retaining the original response fields. No Admin update/archive permission is added.

## Trusted context and transaction boundaries

After the existing middleware and input checks, the controller calls `createManagementOperation(request.auth!)`. The required operation argument goes directly into the existing repository save/delete operation. Actor ID, role at authentication and operation UUID come exclusively from that server-created context. Client-supplied actor/role-at-time/operation/timestamp/history fields and custom headers are ignored by the existing input contract and cannot influence attribution.

Each history write occurs inside the same existing Serializable transaction as its mutation. No separate transaction, post-commit insert, background job or generic logging hook is introduced. Creation captures database-returned state. Updates select the scoped Client before mutation and compare its safe profile/status fields to the returned database row. Archival reads the resulting status and retirement time after the existing lifecycle helper succeeds. A failed conditional archive returns no success history.

If insertion of history fails, the transaction fails and rolls back Client creation/profile/status/retirement changes and session/refresh-token revocations. Conversely, failed authorization, validation, duplicate checks, target lookup, related-record checks or serialization create no committed success history. Existing conflict handling and client-specific 409 wording remain. No retries or HTTP idempotency behavior are added.

`sessionsRevoked: true` means the existing revocation step completed; it does not assert a positive number of sessions existed. Ordinary profile edits and activation do not add session revocation. The before/after status reflects database state, rather than a submitted role or attribution claim.

## No-op behavior and privacy

- Identical active profile updates preserve the existing update/response behavior, including any `updatedAt` change, and append no false domain change.
- Identical inactive updates still perform the existing revocation step. They append `PROFILE_UPDATED` with an empty changed-field list and `{ sessionsRevoked: true }`, rather than a false inactive-to-inactive transition.
- Personal profile changes store `fullName`, `email` or `contactNumber` as changed field names, never old/new values. A profile-only event can therefore have an empty `changes` object.
- Creation stores only approved fixed role/active transitions and field names. Archival stores only a lifecycle timestamp, actual status transition where present, and revocation completion.
- No plaintext/password hash/salt, access/refresh token, personal profile value, raw request, free-form summary or unrestricted account snapshot enters history. Existing action-specific writer allowlists are reused unchanged.

Client mutations do not synchronize Employee records, create operational identities, alter organizational assignments, or permanently remove User relationships. No workforce history is fabricated. Account/Employee management paths and their existing history infrastructure remain separate.

## Changed files

- `apps/api/src/features/clients/clients.controller.ts`: derive trusted operation context and pass it to the three mutations.
- `apps/api/src/features/clients/clients.repository.ts`: required operation argument; safe before/after selection and atomic `CREATED`, `PROFILE_UPDATED`, `ARCHIVED` inserts.
- New `apps/api/tests/features/clients/actor-attribution.test.ts`: authenticated Express/PGlite attribution, authorization, privacy, no-op, rollback, linked-history, overlap and retention tests; also exercises existing Account Management deletion/status/archive attribution.
- This implementation record, the feature-index link, and a dated note in `docs/features/client-management.md`.

No existing test or Account Management production file needs modification. Pre-existing uncommitted changes remain intact.

## Validation

| Executed check                                    | Result                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Missing-attribution reproduction                  | Confirmed failing against the pre-integration implementation                                                                                                                                                       |
| Targeted Client/permission/Account regression run | PASS, exit 0; 28 tests                                                                                                                                                                                             |
| `pnpm format` and final `pnpm format:check`       | PASS, exit 0                                                                                                                                                                                                       |
| `pnpm lint`                                       | PASS, exit 0; zero warnings                                                                                                                                                                                        |
| `pnpm typecheck`                                  | PASS, exit 0; API/web and tests                                                                                                                                                                                    |
| `pnpm build`                                      | PASS, exit 0; API and production standalone web                                                                                                                                                                    |
| `pnpm test:api`                                   | PASS, exit 0; 331 tests, none failed/skipped/cancelled                                                                                                                                                             |
| `pnpm test:web`                                   | PASS, exit 0; 108 unit tests, none failed/skipped/cancelled                                                                                                                                                        |
| Selected Chromium regression run                  | 22 passed, 4 pre-existing failures, none skipped; exit 1                                                                                                                                                           |
| `git diff --check`                                | PASS                                                                                                                                                                                                               |
| Start-of-phase preservation                       | Of 781 existing source/schema/migration/test/documentation files, only the Client controller/repository and two documentation files changed; the new Client test and this record are the two new deliverable files |

The new tests first failed against the pre-integration implementation's missing history. The initial targeted run also caught an unintended duplicate email in a rollback fixture; that test email was made unique so it exercises history failure rather than the preserved duplicate-account guard. Production duplicate behavior was not changed. Forced history-insert failures intentionally produce API 500 log entries; the tests assert rollback rather than treating those responses as successes.

The new suite covers both authorized creator roles with distinct actor/target accounts; forged attribution fields; submitted role ignored; profile-only/status changes and active/inactive no-ops; no profile or credential data in history; active and inactive archival; independent request/project link blockers; denied actors/invalid targets/duplicates/weak passwords; forced history failures with User/Session/RefreshToken rollback; overlapping archive requests; and Client history retention after Account Management permanently deletes a subject or former administrator. The existing `clients:create` read-only-permission fixture and full Account attribution suite are regression checks.

All backend data is offline PGlite. The normal harness uses one database-pool connection: overlapping HTTP coverage is not proof of independent PostgreSQL-backend serialization/deadlock behavior under production load. No live database, seed, migration or repair is run. Actor role remains the request-authentication snapshot; no transaction-time reauthorization policy is introduced.

The full backend count includes all eight new Client attribution tests (the parent plus seven subtests), the existing eight Account attribution tests, Client integration and the isolated read-only-creation-permission child assertion; they are not added again to the 331 count. The final full run also includes the final profile-only update assertion. Existing Account attribution, all other backend authorization/workflow regressions and web units pass. No required check was blocked. The existing compiler/native Node backend runner executes successfully; raw `tsx` startup was not retested. Existing non-failing `pg` concurrent-query warnings remain.

The browser command selected `apps/web/e2e/{client-mutations,client-create-permission,clients,superadmin}.spec.ts` with two workers against the local production web build. The four failures are unchanged `clients.spec.ts:61` and `:156`, each at 1280px and 390px: they wait for focus on the old `Service request submitted for review` heading while the success page uses `Request submitted`. They match the failures already documented in [Phase 4B.3](client-creation-permission-separation.md#validation) and [Phase 4A](superadmin-comprehensive-authorization-audit.md#full-browser-failures-and-classification). All selected Client creation/permission tests and Account Management cases pass. Browser mocks verify unchanged UI/API contracts; independent real Express/PGlite requests establish authorization and persistence. The specs and frontend source match the start-of-phase content. No unrelated heading, workflow or expectation was changed to obtain a pass; assertions beyond the early failing expectations are not claimed validated. The broader browser suite and live deployment were not rerun. The temporary server was stopped after the run.

Evidence is retained under ignored `.ci-tools/phase4b4b3a-{red,focused,format,format-final,lint,typecheck,build,api,web-unit,browser}.log`, `.ci-tools/phase4b4b3a-browser-artifacts/`, and the start-of-phase baseline hashes/status. Account Management source, history utilities, Employee code, permission catalogs, schema/migrations, existing tests and frontend source all match their initial hashes. No new regression was observed in the executed checks; the four known browser failures remain unresolved.

## Remaining boundaries

All three Client endpoints are attributed for their current material changes. Employee account lifecycle integration has not begun. History inspection/export/retention interfaces, historical backfills, stronger database-owner tamper resistance and multi-connection production contention remain outside this phase. Deployment requires the existing foundation migration; this phase creates no new migration and does not deploy one.

Stop after Phase 4B.4B.3A.
