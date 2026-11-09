# Phase 4.2 migration verification

Phase 4.1.1 was read-only: no unfinished changes or generated files required cleanup. Initial HEAD was `326b32d30c6eaf036bd4acca71e43251abf5dac1`, with a clean working tree and committed U00 preservation. No original source, tests, Playwright configuration, package scripts, or U00 evidence are changed by Phase 4.2.

## Mapping and review

The preserved Phase 2 `baseline.json` and `preservation-map.csv` remain authoritative for the 292 original PW identities, 1,630 assertion sites, and 4,211 test/assertion mappings. The utility checks the U00 manifest checksum and every preserved artifact before verification. It does not edit U00.

A search of repository documentation, hidden files, and ignored task artifacts found no approved Phase 3/3.9 ledger or modular directory specification. [proposed-mapping.json](proposed-mapping.json) is explicitly **PROPOSED**, reconstructed from Phase 2. Its 292 test entries and 36 source entries identify current locations only. Future destinations remain unassigned; these entries do not claim to reproduce unavailable Phase 3 decisions.

Missing architectural decisions: modular directory/file destinations, ownership of cross-page tests, and ownership of shared helpers/hooks. These require review before migration. No physical movement is authorized by this file. After review, set `status` to `APPROVED` and update target paths when performing the separately authorized migration. An unapproved relocation fails verification.

`tests` maps original PW IDs to current spec paths; titles, describe ancestry, projects, and parameter expansions must remain unchanged. `files` maps original source files to current paths. For a split, `assertions` can override an individual original assertion ID with its new source path. `contexts` can override `${originalFile}:helpers:${index}`, `:hooks:${index}`, or `:variables:${index}` using the original snapshot order. Initial overrides are empty. `proposedDestinations` is reserved for reviewed proposals and does not change verification targets.

## Commands

Run from repository root; these use installed dependencies and add no package scripts:

```sh
# Discover all cases, then verify membership, declarations, assertions and contexts.
node scripts/verify-playwright-migration.mjs discover

# Select exact original identities through the installed native --test-list option.
node scripts/verify-playwright-migration.mjs discover PW-001 PW-003 PW-124

# Recheck an existing discovery report against current source/mapping.
node scripts/verify-playwright-migration.mjs check <discovery-directory>/discovery.json
# For a selected report, append the exact selected PW IDs.
node scripts/verify-playwright-migration.mjs check <selected-directory>/discovery.json PW-001 PW-003 PW-124

# Run the verifier's focused self-checks; these do not run regression scenarios.
node --test scripts/verify-playwright-migration.test.mjs
```

Each discovery/execute invocation allocates a fresh directory under ignored `test-results/phase4-verification/`, with exclusive writes. Discovery uses `discovery-*/discovery.json`; execution uses `execution-*/execution.json`. Both retain command records, selected PW identities, native test lists, stderr, exit codes and report hashes. Failed attempts are retained. Inherited JSON reporter destinations are removed. `--list` never executes browser tests; its aggregate skipped count is not an execution result.

Assertions are matched by canonical TypeScript AST expression and occurrence, with explicit source relocation support. Each site is consumed once; missing, changed, duplicated, or additional assertions fail. Test declaration ASTs, original helper/hook sources, and variable/fixture declarations must also remain represented. Formatting/comments may differ; assertion operands, matchers, and callback behavior may not. This intentionally rejects helper renaming or semantic rewrites; review such changes separately instead of weakening the checker. Static matching does not prove import binding equivalence, reachability, runtime invocation counts, or behavior against a running build.

## Execution comparison is gated

No before/after execution was performed in Phase 4.2. The historical Phase 2 production build remains unverified and is not accepted as a reference. Build preparation was discontinued; no build infrastructure is added here.

Before using `run`, obtain an externally reviewed, source-pinned build and a dedicated loopback, mocked-API environment with no production services or database access. Do not manufacture a provenance record for the pre-existing build. The utility does not establish build provenance itself: `verification` and `reviewedBy` are explicit operator attestations, required in addition to local consistency checks.

The reviewed proof JSON must contain:

```json
{
  "verification": "VERIFIED",
  "reviewedBy": "actual reviewer or independent build evidence reference",
  "sourceRevision": "2075d354d62dd15b6d34b53600416de336eca4d6",
  "sourceSha256": "digest of independently verified build inputs",
  "buildId": "ID of that verified build",
  "baseURL": "http://127.0.0.1:5274",
  "productionServices": false,
  "liveBackend": false
}
```

`source-digest` prints the digest algorithm's result for the original tracked frontend inputs and checks current source consistency. It is **not** proof that an existing build used those inputs. `run` also checks clean build inputs, matching regular/standalone build IDs, a loopback URL, and the local API rewrite. Environment isolation, backend absence, and build provenance require the external review. No server or build is started by this utility.

Optional proof fields `buildDirectory` and `testDirectory` identify repository-relative build output and suite directories independently; defaults remain `apps/web/.next` and `apps/web`. `apiOrigin` identifies the reviewed loopback HTTP rewrite target, defaulting to `http://localhost:3001`. Remote origins and directory traversal are rejected. An isolated reference can use its credential-free original suite while a later migration uses the main suite against the same verified build.

Only after those prerequisites are independently satisfied:

```sh
node scripts/verify-playwright-migration.mjs source-digest
node scripts/verify-playwright-migration.mjs run <reviewed-proof.json> PW-001 PW-003
# After a separately approved migration, use the same PW selection again.
node scripts/verify-playwright-migration.mjs run <reviewed-proof.json> PW-001 PW-003
node scripts/verify-playwright-migration.mjs compare <before-directory> <after-directory>
```

Execution performs a fresh selected discovery/static check first, then forces mocked mode, two workers, and zero retries. The existing five live tests (`PW-124`–`PW-128`) remain opt-in in the original suite and skipped in utility runs, even if inherited live mode is enabled. No tags are added.

Comparison requires distinct execution directories, successful capture/verification, matching original PW selections, report checksums, and matching reviewed source digests. It follows the recorded PW identity across file relocation. It reports passed/failed/skipped/unexpected totals and rejects failures, new skips, missing cases, duplicate cases, and a failing before reference. Execution reports with no actual results, including discovery reports, are rejected. Failed execution totals are saved when the runner produces parseable execution JSON.

Appending PW IDs to `compare <before-directory> <after-directory> PW-### ...` selects those cases from a full-suite reference. The after execution must contain exactly that selection. This supports a small migration unit without rerunning or rewriting the accepted before reference.

## Phase 4.2 validation

- Full native discovery reconciled all **292 cases**, with no missing, unexpected, or duplicate identities; all **1,630 assertion sites** matched unchanged source.
- Native `--test-list` selected exactly `PW-001`, `PW-003`, and `PW-124`: two distinct expansions of one declaration and one default-skipped live case. All five live cases remain expected skips in full discovery.
- Focused self-checks exercise identity failures, assertion changes, extra assertions, hook removal, approved/proposed relocation, exact selection, discovery rejection as execution evidence, result comparison, output isolation, inherited environment handling, rejection of unverified provenance, and failed-attempt retention.
- Runtime reports, command records, initial diagnostics, and failed attempts remain under `test-results/phase4-verification/`. An early diagnostic selection attempt failed because a shell pipeline replaced Unicode delimiters; its evidence remains intact. The utility writes UTF-8 test lists directly using an escaped native delimiter, and the native selection check passes.
- Execution comparison is implemented and tested using synthetic report data. A real source-pinned reference execution remains a prerequisite for runtime before/after comparison. No application regression tests, builds, live services, or production databases were accessed during this task.

Stop at Phase 4.2. Mapping approval and actual test migration remain outstanding work for a separately authorized phase.

Evidence from this validation: full discovery and verification at `test-results/phase4-verification/discovery-L8Drhf/`; exact three-case selection at `test-results/phase4-verification/discovery-l6vgXC/`; initial baseline diagnostics and failed selection attempt at `test-results/phase4-verification/preflight-20261109T100823Z-978655f4/`. All 719 initially tracked files were compared with the initial SHA-256 snapshot and remain unchanged. All 16 focused verifier self-checks passed. Mandatory `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed with exit code 0; Prisma/Next type generation by the existing typecheck scripts changes only ignored generated output and does not run builds or database queries. No previously tracked file was modified. Four new files contain the utility, its self-checks, the proposed mapping, and these usage/validation notes.

## Phase 4.3 source-pinned reference

The original revision `2075d354d62dd15b6d34b53600416de336eca4d6` was checked out into a detached worktree under `test-results/phase4-reference/reference-20261109T115706Z-561f76e8/source/`. Dependencies were restored with existing pnpm 12.7.0 using `install --offline --frozen-lockfile --ignore-scripts`; no dependencies or application/test configuration were changed. The worktree contained no local credential files. The frontend used its existing `pnpm --filter @nexus/web build` command, Node 24.16.0, production compilation mode, disabled telemetry, an empty public API origin, and an allowlisted process environment.

The first successful build was retained but rejected for execution after safety probing detected unrelated listeners on port 3001. No tests used it and those services were left untouched. One documented safety rebuild changed only `API_PROXY_TARGET` to `http://127.0.0.1:60908`, with that port exclusively bound without listening throughout execution. Thus an unmocked API call could not reach an application backend. The accepted clean build ID is `da72zWMs2YCPh18VReU9c`; source bytes remained unchanged before/after building, regular and standalone IDs matched, 1,584 build files were hashed, and the served static manifest matched the verified build bytes.

Exactly one unchanged full-suite execution ran against the dedicated loopback server: **287 passed, 0 failed, 5 skipped, 0 unexpected, 0 flaky**, with two workers, zero retries, and `NEXUS_E2E_LIVE=0`. Duration: 206.361 seconds. This is a new source-pinned reference; its agreement with historical counts was observed, not used as an acceptance condition. Both the actual executed suite and the build are traceable to the original revision. The temporary frontend and non-listening port reservation were stopped afterward; the source/build worktree remains available as ignored local evidence.

- Source/build commands, environment, hashes, safety rejection, proof, server records, and validation: `test-results/phase4-reference/reference-20261109T115706Z-561f76e8/`.
- Accepted execution: `test-results/phase4-verification/execution-xt00qz/` (`execution.json`, `record.json`, `verification.json`, and result summary).
- Separate full discovery: `test-results/phase4-verification/discovery-zqdWkt/`; exact first-unit selection: `test-results/phase4-verification/discovery-pCK3H5/`.
- All 292 executed identities and 1,630 assertion sites reconciled; all 4,211 preserved ledger rows remain intact. Actual-report missing/duplicate/unexpected probes and discovery-as-execution were rejected. Exclusive overwrite of accepted execution evidence was rejected without changing its bytes. Comparator validation replayed accepted data in memory only; no second execution or migrated result is claimed.

The only verifier fixes support explicit isolated build/test directories, a reviewed dedicated loopback API port, and selected-ID comparison against a full reference. No new scripts, dependencies, configuration, build pipeline, or runtime test scenarios were introduced.

### First unit: PROPOSED FOR REVIEW

No historical approved Phase 3 unit/path assignment could be verified. The new proposal in `proposed-mapping.json` is the whole `apps/web/e2e/jwt-session.spec.ts` file (`PW-087`, `PW-088`; two declarations and 12 assertion sites), destined for **`apps/web/e2e/auth/jwt-session.spec.ts`**. The domain directory fits existing recursive discovery and feature-oriented organization; conformity with an unavailable historical Phase 3 layout remains unverified and requires review. Preserve its local account fixture and file-scoped `test.use` together. It imports no shared regression helper and needs no fixture/hook/lifecycle split. Active mapping targets remain unchanged and unapproved.

After separate approval and authorization to migrate, update only that file's reviewed source/test targets, run selected discovery plus full static discovery, then re-verify the retained build and re-establish its reserved API port/server. Create a new run proof with `testDirectory: "apps/web"`; do not edit accepted reference evidence. Run only the selected unit and compare it with the corresponding cases in the full reference:

```sh
node scripts/verify-playwright-migration.mjs discover PW-087 PW-088
node scripts/verify-playwright-migration.mjs discover
node scripts/verify-playwright-migration.mjs run <new-reviewed-main-suite-proof.json> PW-087 PW-088
node scripts/verify-playwright-migration.mjs compare test-results/phase4-verification/execution-xt00qz <new-unit-execution-directory> PW-087 PW-088
```

No structural migration occurred. Remaining limits: architecture/unit approval, runtime assertion invocation counts, other browser engines, and long-term flakiness. The evidence and build outputs are ignored local artifacts; retain them explicitly before cleanup or moving this environment. Phase 4.4 was not started.

Phase 4.3 decision: **COMPLETED**. All 19 verifier self-checks and mandatory `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed (exit code 0). Only this guide, `proposed-mapping.json`, the existing verifier, and its self-checks were modified. Source/test/configuration/U00 safety checks and exact evidence checksums are recorded in the local `phase4.3-result.json` alongside the build records. No migration approval, commit, or push was performed.

## Phase 4.4 JWT Session relocation

The user approved this destination in Phase 4.4; this is not a recovered historical Phase 3 assignment. `apps/web/e2e/jwt-session.spec.ts` moved to **`apps/web/e2e/auth/jwt-session.spec.ts`** with identical bytes (SHA-256 `0b62fb3805b3dd14f2fba93377df30aa2a659a4dc8ce2f7f69f6b75b512afccd`). Its only import is `@playwright/test`; no import, scenario, title, fixture, hook, mock, or assertion change was needed. `PW-087` and `PW-088` retain two declarations, two expanded cases, and 12 assertion sites. Only their source/test mapping entries were relocated. The mapping's approval scope is this unit alone; all other active targets remain unchanged.

Selected discovery (`test-results/phase4-verification/discovery-LYn5iZ/`) and full discovery (`test-results/phase4-verification/discovery-wBMPgh/`) passed. All 292 original identities and 1,630 assertion sites reconcile; the 4,211 original ledger mappings remain intact and the five live cases remain opt-in. No full regression execution was repeated.

The accepted build `da72zWMs2YCPh18VReU9c` was reused after checking its recorded artifact hashes and re-establishing its exclusively reserved, non-listening API port. A new proof selected the main suite (`testDirectory: "apps/web"`), keeping Phase 4.3 evidence unchanged. The migrated unit ran once with zero retries: **2 passed, 0 failed, 0 skipped, 0 unexpected**. Existing verifier comparison selected `PW-087`/`PW-088` from the full Phase 4.3 reference and confirmed the same two passing outcomes. No verifier fix or new test infrastructure was needed.

Execution evidence: `test-results/phase4-verification/execution-nAvaM9/`; its separate discovery: `test-results/phase4-verification/discovery-2Pwbdv/`. Preflight hashes, proof, readiness checks, logs, comparison, and final safety results: `test-results/phase4-migration/jwt-session-20261109T123306Z-bd9c0cf8/phase4.4-result.json` and its containing directory. Temporary processes were stopped. Changes already present from Phase 4.3 were preserved. No other migration unit, automatic commit/push, database operation, or production service use occurred. The retained build and execution evidence remain local ignored artifacts.

Phase 4.4 decision: **COMPLETED**. `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed with exit code 0. The relocated source remains byte-identical after formatting. The verifier and self-checks have no Phase 4.4 changes, all other specs/configuration are unchanged, and U00/accepted Phase 4.3 evidence remains intact. Phase 4.5 was not started.

## Phase 4.5.1 login-page validation relocation

Selected before changing files and recorded in `test-results/phase4-migration/login-validation-20261109T124931Z-e911d751/selection.json`: **`apps/web/e2e/login-validation.spec.ts` → `apps/web/e2e/auth/login-validation.spec.ts`**, covering `PW-089` and `PW-090`, two declarations, two expanded cases, and 22 assertion sites. This is a new selection under the user's Phase 4.5.1 authorization, not a recovered historical Phase 3 assignment. Both scenarios stay on `/login`; the complete spec keeps its local request mock and held-response state together. It has no live, cross-page, messaging or SSE dependency.

The only source edit changes `getAuthCopy`'s import from `../src/features/auth/content/auth-copy` to `../../src/features/auth/content/auth-copy`, resolving to the same module. All other source bytes, titles, assertions, expected values, validation loops, fixtures and behavior are preserved. Only this unit's mapping targets/record and the scope/provenance of the existing mapping authorization were updated; the JWT unit's mapping and source remain intact.

Selected discovery: `test-results/phase4-verification/discovery-kq8g8q/`. Global discovery: `test-results/phase4-verification/discovery-TGbBDv/`, reconciling all 292 identities and 1,630 assertion sites with no missing, duplicate or unexpected cases. All 4,211 original mappings remain accounted for; five live cases remain expected skips. No full regression execution was repeated.

The checksum-verified accepted build `da72zWMs2YCPh18VReU9c` was reused without rebuilding, with its exclusive non-listening API target re-established. Exactly `PW-089`/`PW-090` ran once with zero retries: **2 passed, 0 failed, 0 skipped, 0 unexpected**. Existing verifier comparison against the corresponding cases in the full Phase 4.3 reference passed with identical outcomes. No verifier fix, new testing script, test tag, or infrastructure was needed.

Execution: `test-results/phase4-verification/execution-8ruPoY/`; separate execution discovery: `test-results/phase4-verification/discovery-ji98qV/`. Selection/preflight records, new proof, readiness checks, logs, comparison and final report: `test-results/phase4-migration/login-validation-20261109T124931Z-e911d751/`. Temporary processes were stopped. Prior JWT migration, pre-existing working-tree changes, application/configuration files, U00, and accepted evidence remain unchanged. No production database/service use, commit, push or additional unit migration occurred. Evidence remains local and ignored.

Phase 4.5.1 decision: **COMPLETED**. Formatting, lint and typecheck passed with exit code 0. After formatting, the relocated file still differs only by the required import-path adjustment. Final checksums and safety results are recorded in `phase4.5.1-result.json` in the evidence directory above. No further migration unit was started.

## Consolidated migration check (Phase 4.5.2)

With the reviewed reference environment already running, use `node scripts/check-playwright-migration.mjs <reviewed-proof.json> PW-### ...`. The wrapper invokes the existing verifier for one global discovery, original assertion-binding reconciliation, selected execution (including its required selected discovery), and reference comparison, then runs format, lint and typecheck. It stops on the first failure and retains exclusive per-step logs and `result.json` under a fresh `test-results/phase4-migration/check-*` directory. It neither builds nor starts services and does not change the verifier.

Phase 4.5.2 selects only `client-mutations.spec.ts` → `clients/client-mutations.spec.ts` (`PW-031`, `PW-032`; one declaration, two viewport cases, 21 assertion sites). The whole `/clients` spec has local mocks and no shared lifecycle, live, cross-page or SSE dependency. Only the `Client` type import changes from `../src/...` to `../../src/...`; all remaining bytes are preserved. This is a new Phase 4.5.2 selection, not a historical Phase 3 assignment. Selection/preflight and new environment proof are under `test-results/phase4-migration/client-mutations-20261109T131512Z-e4763e44/`. The original screenshot paths are preserved in the test; prior screenshot bytes are saved before execution and restored afterward, while new captures are retained in this unit's evidence directory.

Phase 4.5.2: **COMPLETED**. Consolidated result: `test-results/phase4-migration/check-wLxXI6/result.json`. All 292 identities, 1,630 assertion sites and 4,211 original assertion bindings reconcile; five live cases remain opt-in. Exactly two cases passed once without retries and match the accepted reference; format, lint and typecheck passed. Build `da72zWMs2YCPh18VReU9c` was reused without rebuilding. The verifier, previous migrations, application/configuration files, U00 and accepted evidence remain unchanged. Temporary resources were released. No further unit, production access, commit or push occurred.

## Phase 4.5.3 employee-page controls relocation

Selected `apps/web/e2e/employee-login.spec.ts` → `apps/web/e2e/employees/employee-login.spec.ts`: `PW-071`, `PW-072`, one declaration, two viewport cases, and 29 assertion sites. The whole `/employees` spec keeps its test-local mocks/menu helper and has no shared lifecycle, cross-page, SSE or live dependency. Only the `Employee` type import gains one parent-directory segment; all other bytes remain unchanged. This is a new Phase 4.5.3 selection under the established page/feature directory convention, not a historical Phase 3 assignment. Evidence and reviewed environment proof: `test-results/phase4-migration/employee-login-20261109T133057Z-f8eabcc7/`. Verification uses the documented existing consolidated command with that proof and `PW-071 PW-072`.

Phase 4.5.3: **COMPLETED**. `test-results/phase4-migration/check-myD81P/result.json` records all six check stages passing: global preservation, selected execution, reference comparison, format, lint and typecheck. Exactly two cases passed once, with no retries, failures, skips or unexpected outcomes; both match Phase 4.3. Global reconciliation retains 292 identities, 1,630 assertion sites, 4,211 bindings and five opt-in live cases. The accepted build was reused without rebuilding; temporary resources were released. Previous migrations, application/configuration, tools, U00 and accepted evidence remain unchanged. No new tool, production access, commit, push or further migration occurred. Runtime evidence remains local and ignored. Phase 4.5.4 was not started.

## Phase 4.5.4 batch

Five whole-file assignments recorded before movement: `employees.spec.ts` → `employees/employees.spec.ts` (PW-073–076; 18 assertions), `responsive-data-table.spec.ts` → `clients/responsive-data-table.spec.ts` (PW-249–250; 19), `pricing-templates.spec.ts` → `services/pricing-templates.spec.ts` (PW-106–109; 21), `services.spec.ts` → `services/services.spec.ts` (PW-251–260; 67), and `settings.spec.ts` → `settings/settings.spec.ts` (PW-263–266; 37). Paths are under `apps/web/e2e/`. Total: 17 declarations, 24 expanded cases and 162 assertion sites. These are new Phase 4.5.4 page/feature assignments, not historical Phase 3 approvals. None has messaging/SSE, live, cross-page or shared before/after lifecycle dependencies; existing hook helpers resolve to the same unchanged module.

Only relative import specifiers changed. Independent per-file checks match every original declaration and assertion expression/hash, with all other bytes intact. Preflight counts, exact IDs, import adjustments and integrity snapshots are recorded in `test-results/phase4-migration/batch-4.5.4-20261109T134516Z-d2cf337a/preflight.json`; per-file checks are in `per-file-static.json` beside it. The documented consolidated wrapper is invoked once with all 24 new identities and a new proof for the unchanged reference build.

Phase 4.5.4: **COMPLETED**. Consolidated result: `test-results/phase4-migration/check-jVRIER/result.json`. All 24 cases passed once with zero retries, failures, skips or unexpected results; each matches its original Phase 4.3 outcome. Per-file membership/counts and comparison are recorded in `per-file-results.json` beside the preflight record. Global preservation retains 292 identities, 1,630 assertion sites, 4,211 mappings and five opt-in live cases. Format, lint and typecheck passed once for the batch. No full-suite execution, rebuild, new tooling or configuration change occurred. Prior migrations, application source, U00 and accepted evidence are unchanged; temporary resources were released. No production access, commit, push or subsequent batch occurred. Runtime/build evidence remains local and ignored. Phase 4.5.5 was not started.

## Phase 4.5.5 batch

Nine safe page/feature whole-file assignments were recorded before movement in `test-results/phase4-migration/batch-4.5.5-20261109T140550Z-ea31fdaf/preflight.json`: 36 declarations, 57 expanded cases and 438 assertion sites. The ten-file target is not forced: mixed-owner/shared UI, messaging/SSE and live-backend candidates remain deferred. New destinations are Phase 4.5.5 decisions, not recovered historical Phase 3 approvals. Only relative import specifiers changed; all other source bytes and complete file lifecycles remain preserved. Run the existing consolidated command once with `test-results/phase4-migration/batch-4.5.5-20261109T140550Z-ea31fdaf/batch-proof.json` and the 57 IDs recorded in preflight. The accepted build is reused; no full-suite execution or rebuild is required.

Phase 4.5.5 decision: **INCOMPLETE** against the ten-file target; the nine safe specifications are successfully migrated and verified. `test-results/phase4-migration/check-AzPSRX/result.json` records all six stages passing. Exactly 57 selected cases passed once with zero retries, failures, skips or unexpected results; every outcome matches Phase 4.3. Global preservation remains 292 identities, 1,630 assertion sites and 4,211 mappings, with five opt-in live cases. Format, lint and typecheck passed once. Per-file exact membership, titles, declaration/assertion expressions, imports and complete lifecycle preservation are recorded in `per-file-results.json` and `per-file-ast.json` beside preflight. No tenth file was forced: remaining suites have mixed/shared ownership or messaging/live dependencies (for example, `clients.spec.ts` mixes the client directory with service submissions). Existing screenshot bytes were restored after archiving new captures. Prior migrations, application/configuration, U00 and accepted evidence remain unchanged; temporary resources were released. No new tool, build, full-suite execution, production access, commit, push or subsequent batch occurred. Evidence/build outputs remain ignored local artifacts.

## Phase 4.5.6 classification and batch

All 17 remaining original specifications were classified from baseline records and actual source before movement. The auth/ and shared/ assignments are new Phase 4.5.6 decisions, not historical Phase 3 approvals. Paths below are relative to apps/web/e2e/. Deferred destinations are proposals only; ambiguous ownership remains unresolved. Whole files and complete lifecycle behavior are preserved apart from recorded relative imports.

| Original file                    | Category      | PW identities  | Cases | Assertions | Proposed destination                     | Whole file safe         | Decision / reason                                                                                                              |
| -------------------------------- | ------------- | -------------- | ----- | ---------- | ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| admin.spec.ts                    | SECURITY      | PW-001..PW-010 | 10    | 5          | auth/admin.spec.ts                       | Yes                     | MIGRATED                                                                                                                       |
| auth-styles.spec.ts              | SHARED        | PW-019..PW-021 | 3     | 17         | shared/auth-styles.spec.ts               | Yes                     | MIGRATED                                                                                                                       |
| clients.spec.ts                  | AMBIGUOUS     | PW-053..PW-062 | 10    | 36         | Unresolved                               | Deferred pending review | DEFERRED: Mixes client-directory controls with service-submission business behavior; future ownership review                   |
| departments.spec.ts              | AMBIGUOUS     | PW-063..PW-065 | 3     | 21         | Unresolved                               | Deferred pending review | DEFERRED: Contains employee account-menu behavior as well as department CRUD; future ownership review                          |
| dropdown-positioning.spec.ts     | SHARED        | PW-066..PW-070 | 5     | 8          | shared/dropdown-positioning.spec.ts      | Yes                     | MIGRATED                                                                                                                       |
| internal-conversations.spec.ts   | MESSAGING/SSE | PW-077..PW-086 | 10    | 65         | messaging/internal-conversations.spec.ts | Deferred pending review | DEFERRED: Internal chat lifecycle and participant/message interactions; future messaging review                                |
| messages-topbar.spec.ts          | SHARED        | PW-091..PW-094 | 4     | 8          | shared/messages-topbar.spec.ts           | Yes                     | MIGRATED                                                                                                                       |
| operational-loading.spec.ts      | SHARED        | PW-095..PW-100 | 6     | 13         | shared/operational-loading.spec.ts       | Yes                     | MIGRATED                                                                                                                       |
| portal-regression.spec.ts        | SECURITY      | PW-101..PW-105 | 5     | 14         | auth/portal-regression.spec.ts           | Yes                     | MIGRATED                                                                                                                       |
| project-pages-regression.spec.ts | AMBIGUOUS     | PW-114..PW-119 | 6     | 17         | Unresolved                               | Deferred pending review | DEFERRED: Combines workspace archive/search with load recovery on two distinct project feature routes; future ownership review |
| regression-live.spec.ts          | LIVE-BACKEND  | PW-124..PW-128 | 5     | 31         | live/regression-live.spec.ts             | Deferred pending review | DEFERRED: Explicitly opt-in real-backend accounts; future isolated live-backend phase                                          |
| regression.spec.ts               | SECURITY      | PW-129..PW-158 | 30    | 106        | auth/regression.spec.ts                  | Yes                     | MIGRATED                                                                                                                       |
| request-conversations.spec.ts    | MESSAGING/SSE | PW-159..PW-204 | 46    | 220        | messaging/request-conversations.spec.ts  | Deferred pending review | DEFERRED: Shared HTTP/SSE server with beforeAll/afterAll and streaming scenarios; future messaging/SSE phase                   |
| request-inbox.spec.ts            | MESSAGING/SSE | PW-205..PW-218 | 14    | 85         | request-inbox/request-inbox.spec.ts      | Deferred pending review | DEFERRED: Embedded conversation UI and text/event-stream mocks; future messaging/inbox lifecycle review                        |
| request-workflow.spec.ts         | MESSAGING/SSE | PW-219..PW-248 | 30    | 220        | messaging/request-workflow.spec.ts       | Deferred pending review | DEFERRED: Workflow interactions embedded in request conversations on /messages; future messaging/workflow phase                |
| staff.spec.ts                    | SECURITY      | PW-269..PW-272 | 4     | 35         | auth/staff.spec.ts                       | Yes                     | MIGRATED                                                                                                                       |
| table-interactions.spec.ts       | SHARED        | PW-281..PW-292 | 12    | 41         | shared/table-interactions.spec.ts        | Yes                     | MIGRATED                                                                                                                       |

Selection/preflight, classification, fresh reference proof, per-file preservation and final safety evidence: `test-results/phase4-migration/batch-4.5.6-20261109T141913Z-b59289a6/`. The documented existing consolidated wrapper was invoked once with this proof and all 79 selected identities.

Phase 4.5.6: **COMPLETED**. All 17 originally remaining files are classified; nine whole files migrated, eight explicitly deferred (four messaging/SSE, three ambiguous ownership, one live-backend). Consolidated evidence: `test-results/phase4-migration/check-QvYsZ4/result.json`. Exactly 79 selected cases passed once with zero retries, failures, skips or unexpected results; every outcome matches Phase 4.3. Global checks retain all 292 identities, 1,630 assertion sites and 4,211 mappings; five live cases remain opt-in. Format, lint and typecheck passed once. Per-file source/AST and exact execution membership checks preserve 35 declarations and 247 assertions. Cumulative relocation: 27/35 specs, 168/292 cases, 931/1,630 assertion sites. No test splitting, tooling changes, full-suite execution or rebuild occurred. Prior migrations, application/configuration, U00 and accepted reference evidence remain unchanged. Owned resources were stopped; no production access, commit, push or later phase occurred. Evidence/build outputs remain ignored local artifacts. Final safety evidence is in `batch-result.json` beside preflight.
