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

## Phase 4.2 validation

- Full native discovery reconciled all **292 cases**, with no missing, unexpected, or duplicate identities; all **1,630 assertion sites** matched unchanged source.
- Native `--test-list` selected exactly `PW-001`, `PW-003`, and `PW-124`: two distinct expansions of one declaration and one default-skipped live case. All five live cases remain expected skips in full discovery.
- Focused self-checks exercise identity failures, assertion changes, extra assertions, hook removal, approved/proposed relocation, exact selection, discovery rejection as execution evidence, result comparison, output isolation, inherited environment handling, rejection of unverified provenance, and failed-attempt retention.
- Runtime reports, command records, initial diagnostics, and failed attempts remain under `test-results/phase4-verification/`. An early diagnostic selection attempt failed because a shell pipeline replaced Unicode delimiters; its evidence remains intact. The utility writes UTF-8 test lists directly using an escaped native delimiter, and the native selection check passes.
- Execution comparison is implemented and tested using synthetic report data. A real source-pinned reference execution remains a prerequisite for runtime before/after comparison. No application regression tests, builds, live services, or production databases were accessed during this task.

Stop at Phase 4.2. Mapping approval and actual test migration remain outstanding work for a separately authorized phase.

Evidence from this validation: full discovery and verification at `test-results/phase4-verification/discovery-L8Drhf/`; exact three-case selection at `test-results/phase4-verification/discovery-l6vgXC/`; initial baseline diagnostics and failed selection attempt at `test-results/phase4-verification/preflight-20261109T100823Z-978655f4/`. All 719 initially tracked files were compared with the initial SHA-256 snapshot and remain unchanged. All 16 focused verifier self-checks passed. Mandatory `pnpm format`, `pnpm lint`, and `pnpm typecheck` passed with exit code 0; Prisma/Next type generation by the existing typecheck scripts changes only ignored generated output and does not run builds or database queries. No previously tracked file was modified. Four new files contain the utility, its self-checks, the proposed mapping, and these usage/validation notes.
