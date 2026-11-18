# Converyn — Phase 7.5.1 Historical Preservation and Documentation Reconciliation Report

## Document Control

| Field                          | Value                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Project                        | Converyn (formerly Nexus)                                                                          |
| Phase                          | 7.5.1 — Historical Preservation and Documentation Reconciliation                                   |
| Report classification          | RECONCILIATION PARTIALLY COMPLETE — UNRESOLVED HISTORICAL DISCREPANCIES                            |
| Report date                    | 2026-11-16                                                                                         |
| Source branch                  | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` |
| Source HEAD                    | `c42eb25ccac3a1aadcc97d5a0a8c136b991dbc68`                                                         |
| Current HEAD parent            | `461b4466e6a00662f5bc4daa3745380e989204a9`                                                         |
| Development merge commit       | `461b4466e6a00662f5bc4daa3745380e989204a9`                                                         |
| Development merge parents      | `803e53f759fa2afee86af295a8c9265517a7e70d`; `6b7aa31f713876d213a06b4bfcad6f9314f979a0`             |
| Investigation type             | Read-only historical preservation, defect, execution, and documentation audit                      |
| Verification status            | Partial; current identity verifier stops at PW-149 before assertion and ownership checks           |
| Administrative approval status | Awaiting administrative reconciliation; no new historical equivalences approved                    |
| Production-readiness status    | Not certified                                                                                      |

This report records the investigation performed in the preceding Phase 7.5.1 review. It is an audit record, not an approval ledger. It does not modify the immutable Phase 4 baseline or grant approval to any proposed equivalence.

## 1. Executive Summary

Phase 7.5.1 reconciled the available historical-preservation evidence, defect register, post-merge execution checkpoints, lifecycle changes, attendance terminology, and regression documentation.

The historical baseline remains 292 original Playwright identities, 1,630 assertion sites, 4,211 ownership mappings, and 36 original test files. The current Playwright inventory at c42 is 643 tests in 84 files. The preservation verifier found 291 exact historical title matches and one PW-149 identity mismatch, then stopped. Assertion-level and current ownership checks therefore remain unverified.

The earlier Phase 7.5 checkpoint recorded 1,559 exact assertion matches, 10 approved replacements, 9 source-verified equivalents, and 52 unresolved sites. Those are historical checkpoint figures, not a reconciliation of c42. The 52-site inventory is retained in this report. The four R1 maintenance candidates PW-070, PW-273, PW-276, and PW-277 passed a focused run, but all remain **VERIFIED EQUIVALENCE — APPROVAL PENDING**.

The development lifecycle update is not just a label change. It adds database/API enum values, changes persisted transitions and client summaries, and migrates historical values. It collapses or normalizes distinctions among Awaiting Client Information, Ready for Quotation, Closed, and the new statuses without administrative semantic approval. PW-022, PW-023, PW-025, PW-050, and PW-051 remain unchanged and fail focused checks against current display labels.

The canonical defect register retains 21 open application findings and API-TEST-001, an open test defect. No application finding is marked fixed. A separate attendance test still expects Approved while the current workflow displays Verified as an earlier stage awaiting HR approval.

The complete post-R1 suite was not rerun. Current evidence consists of earlier full-suite checkpoints and focused c42 checks only. R2/R3/R4 remain deferred; Phase 8 has not started.

**Final classification: RECONCILIATION PARTIALLY COMPLETE — UNRESOLVED HISTORICAL DISCREPANCIES.**

## 2. Repository and Git State

| Check                    | Result                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Repository root          | `C:\Users\ADMIN\Documents\Thesis\Nexus`                                                            |
| Branch                   | `219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages` |
| HEAD                     | `c42eb25ccac3a1aadcc97d5a0a8c136b991dbc68`                                                         |
| HEAD parent              | `461b4466e6a00662f5bc4daa3745380e989204a9`                                                         |
| Development merge commit | `461b4466e6a00662f5bc4daa3745380e989204a9`                                                         |
| Merge parents            | `803e53f759fa2afee86af295a8c9265517a7e70d` and `6b7aa31f713876d213a06b4bfcad6f9314f979a0`          |
| Working tree             | Clean; no staged, unstaged, or untracked changes reported by Git                                   |
| Active merge             | None; no unmerged paths and no `MERGE_HEAD`                                                        |

The R1 commit at HEAD is `c42eb25ccac3a1aadcc97d5a0a8c136b991dbc68`, subject `test: Post-Merge Regression Failure Fixed update`. It changes 11 test and test-support files (204 insertions, 41 deletions); it does not change application source, documentation, or baseline files. The 11 files previously reported as unstaged are now committed in this R1 commit.

Phase 4 baseline artifacts have no diff since the merge. No commit or push was made during the Phase 7.5.1 investigation. The local branch and its origin tracking ref both pointed to c42; this investigation does not establish when the remote tracking ref was updated.

The repository AGENTS instructions require `pnpm format`, `pnpm lint`, and `pnpm typecheck) before a code task is handed off. They were not run for this read-only audit: `pnpm format`is`prettier --write .`, and the root typecheck invokes Prisma generation, which writes generated code. No source, test, baseline, or documentation changes were made during the investigation.

## 3. Historical Preservation Baseline

| Baseline measure                         |                           Historical value |
| ---------------------------------------- | -----------------------------------------: |
| Original Playwright test identities      |                                        292 |
| Historical assertion sites               |                                      1,630 |
| Identity-to-assertion ownership mappings |                                      4,211 |
| Original baseline test files             |                                         36 |
| Immutable Phase 4 baseline revision      | `2075d354d62dd15b6d34b53600416de336eca4d6` |

The immutable [Phase 4 preservation map](../../../testing/migrations/phase4/baseline/artifacts/preservation-map.csv) and [baseline manifest](../../../testing/migrations/phase4/baseline/sha256-manifest.json) remain unchanged. The [frozen Phase 6 preservation snapshot](../../../testing/migrations/phase6/preservation-reconciliation.json), recorded at revision `0ec683a8a7c44e5b0160f85042bfb9fbe8177472`, reports 292 identities, 1,630 assertion sites, 4,211 mapping edges, and no mismatches at that revision. It is not current c42 verification.

The November 14 Phase 7.5 checkpoint reported:

- 1,559 exact assertion matches;
- 10 approved replacements;
- 9 source-verified equivalent sites; and
- 52 unresolved assertion sites.

These figures total 1,630 but describe the November 14 checkpoint only. The raw preservation exports were not regenerated after c42. The [Phase 7.5 preservation report](phase7.5-preservation-reconciliation.md) documents that checkpoint and its limitations.

## 4. Historical Identity Reconciliation

Current Playwright discovery found **643 tests in 84 spec files**. The documented preservation verifier was run against c42. It stopped at the identity gate with:

- **291 exact** historical title identities;
- **0 duplicates**;
- **0 unexpected** identities; and
- **1 missing exact identity:** PW-149.

PW-149’s candidate remains in the same auth regression file, but its title differs from the Phase 4 identity. The [historical identity export](../../../../test-results/phase7/phase7.5/preservation/historical-identities.csv) predates c42.

The verifier did not proceed to assertion or ownership comparison. Thus, 291 exact title matches are established; full current ownership-module and assertion preservation are not. New tests in the 643-test inventory are not evidence that historical behavior remains covered.

## 5. Historical Assertion Reconciliation

The following figures are from the earlier November 14 Phase 7.5 checkpoint, not a completed c42 audit:

| Earlier checkpoint result             |     Count | Meaning                                                                          |
| ------------------------------------- | --------: | -------------------------------------------------------------------------------- |
| Exact mapped-source assertion matches |     1,559 | AST expression matches in the mapped target file                                 |
| Approved replacements                 |        10 | Identity/site-specific deltas recorded before this audit                         |
| Source-verified equivalents           |         9 | One-for-one source-backed equivalents recorded in the append-only ledger         |
| Unresolved sites                      |        52 | No exact match in the mapped file and no accepted replacement in that checkpoint |
| **Historical total**                  | **1,630** | Sum of the four categories above                                                 |

The current verifier did not reach assertion comparison because it stopped at PW-149. No c42 total for exact, replaced, equivalent, missing, or newly introduced assertions is claimed.

The older global source-expression search found 20 expressions elsewhere without proving historical ownership and 32 that were not found globally. Textual presence elsewhere does not establish equivalent behavior or coverage ownership. The raw [unresolved-site CSV](../../../../test-results/phase7/phase7.5/preservation/unresolved-assertion-sites.csv) and [global-search CSV](../../../../test-results/phase7/phase7.5/preservation/unresolved-assertion-global-search.csv) remain unchanged.

## 6. Historical Ownership Mapping Audit

The immutable map has 4,211 logical rows and 4,211 unique historical identity-to-assertion edges. The frozen Phase 6 snapshot reports the edges internally valid at its recorded revision.

Current c42 ownership was not verified because the identity gate stopped at PW-149. The earlier 4,211 count does not establish current ownership, relocation, absence of duplicates, or one-to-one behavioral equivalence. To establish equivalence, a current assertion must be mapped to the historical identity and site, preserve the original behavior, and be supported by the applicable approval or recorded verification evidence.

## 7. PW-149 Investigation

| Element                   | Historical / current evidence                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Historical identity       | `duplicate email registration displays inline server error alert`                                                         |
| Current identity          | `duplicate email registration displays server conflict feedback`                                                          |
| Original file             | `apps/web/e2e/auth/regression.spec.ts`                                                                                    |
| Current file              | `apps/web/e2e/auth/regression.spec.ts`                                                                                    |
| Original assertion        | Exact duplicate-email text inside an element with role `alert`                                                            |
| Current behavior asserted | An “Account unavailable” button and the duplicate-email text are checked separately                                       |
| Relevant change           | Commit `b6d9b8ae` by Jairus Ocampo, 2026-11-13 12:24 +08, before the development merge; c42 did not modify this auth test |

The current test still checks the conflict text, but no longer asserts that it is exposed with role `alert`. The title change is therefore accompanied by an assertion change. Evidence does not establish whether the application behavior changed or whether only the test locator changed.

**Classification:** unresolved identity mapping and assertion equivalence, with potential accessibility coverage loss.

**Impact:** the exact historical identity gate fails; alert-role coverage is no longer explicit.

**Administrative decision:** decide whether to record an identity alias and whether the alert role is part of the preserved contract.

**Approval:** pending; no equivalence is approved.

## 8. Unresolved Historical Assertion Sites

The table enumerates all 52 source sites in the earlier export. “Sites” counts historical assertion source sites, not expanded identity-to-site edges. The current c42 verifier did not establish a disposition for any of them.

| Historical IDs                         | Source location                                                                       |  Sites | Original assertion purpose                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------- | -----: | ----------------------------------------------------------------------------- |
| PW-001, PW-003, PW-005, PW-007, PW-009 | `apps/web/e2e/admin.spec.ts:32`                                                       |      1 | Route reaches the dashboard                                                   |
| PW-021                                 | `apps/web/e2e/auth-styles.spec.ts:65,67,68,71,72,74,75`                               |      7 | Dashboard/login URLs, radius, background color, main layout, and hidden aside |
| PW-030                                 | `apps/web/e2e/booked-services.spec.ts:492`                                            |      1 | Dashboard heading is visible; separate from the route site at line 491        |
| PW-053–PW-056                          | `apps/web/e2e/clients.spec.ts:25`                                                     |      1 | Dashboard route for the historical client-directory access case               |
| PW-065                                 | `apps/web/e2e/departments.spec.ts:182,186`                                            |      2 | “Members & teams” heading and zero-member count                               |
| PW-071, PW-072                         | `apps/web/e2e/employee-login.spec.ts:237`                                             |      1 | Edit Alex Employee button is absent                                           |
| PW-077–PW-082                          | `apps/web/e2e/internal-conversations.spec.ts:226,234,235,245`                         |      4 | Client chats visible, messages route, internal chats absent                   |
| PW-091–PW-094                          | `apps/web/e2e/messages-topbar.spec.ts:75`                                             |      1 | Messages route                                                                |
| PW-147                                 | `apps/web/e2e/auth/regression.spec.ts:461`                                            |      1 | Login route                                                                   |
| PW-149                                 | `apps/web/e2e/auth/regression.spec.ts:514`                                            |      1 | Duplicate-email conflict has alert role and expected text                     |
| PW-150                                 | `apps/web/e2e/auth/regression.spec.ts:546`                                            |      1 | Dashboard route                                                               |
| PW-152–PW-155                          | `apps/web/e2e/auth/regression.spec.ts:584`                                            |      1 | Dashboard route                                                               |
| PW-157                                 | `apps/web/e2e/auth/regression.spec.ts:636`                                            |      1 | Dashboard route                                                               |
| PW-158                                 | `apps/web/e2e/auth/regression.spec.ts:655`                                            |      1 | Login route                                                                   |
| PW-165–PW-167                          | `apps/web/e2e/request-conversations.spec.ts:794,797,803`                              |      3 | Empty conversation state, list-read evidence, and “Back to client chats” link |
| PW-190                                 | `apps/web/e2e/request-conversations.spec.ts:2021`                                     |      1 | Conversation URL includes `request=other-client`                              |
| PW-251                                 | `apps/web/e2e/services.spec.ts:32`                                                    |      1 | Button count is zero                                                          |
| PW-267                                 | `apps/web/e2e/staff-workload.spec.ts:135,136,141,147,351,357,412,413,420,465,471,477` |     12 | Chart geometry, accessibility, and chart text                                 |
| PW-269–PW-272                          | `apps/web/e2e/staff.spec.ts:19,23,26,29,32,51,62,88,103,118`                          |     10 | Role-specific routes, menu links, and request counts                          |
| PW-281, PW-282                         | `apps/web/e2e/table-interactions.spec.ts:139`                                         |      1 | Dashboard route                                                               |
| **Total**                              |                                                                                       | **52** |                                                                               |

Disposition cautions:

- PW-053–PW-056 have a later identity-specific ledger entry for role-specific client-directory access. The November 14 raw export still lists the site and was not regenerated.
- PW-281–PW-282 have recorded table-transition and fixture approvals. Those entries do not independently prove that this adjacent route assertion has a one-to-one current equivalent.
- PW-030’s heading site is distinct from its separately recorded route equivalence.
- PW-050–PW-051 toast-feedback equivalence is distinct from their historical status-label assertions, which remain preserved and fail against the current “Pending” label.

The raw inventory must remain unchanged until a current crosswalk is completed.

## 9. Phase 7.5-R1 Equivalence Review

All four candidates passed the focused c42 Playwright selection. That execution evidence does not itself approve a historical delta.

| ID     | Original behavior                                                                                      | Current implementation and focused evidence                                                                                                 | Proposed equivalence                                           | Approval status                             |
| ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| PW-070 | Custom menu and `menuitemradio`; preserve anchoring, scrolling, keyboard selection, and selected value | Radix combobox/listbox/options; anchoring, End-key scroll, keyboard selection, and selected value remain checked; focused test passed       | Selector/API adaptation preserves dropdown behavior            | **VERIFIED EQUIVALENCE — APPROVAL PENDING** |
| PW-273 | Locate the “Your account” row and exercise filtering/loading/recovery                                  | Identifies own account by Superadmin email; preserves local filtering and search recovery and adds sync/loading checks; focused test passed | Stable identity locator preserves own-row and search behavior  | **VERIFIED EQUIVALENCE — APPROVAL PENDING** |
| PW-276 | Prove a Superadmin cannot change their own role or status                                              | Checks disabled role combobox, absence of delete/deactivation actions, and the self-role explanation; focused test passed                   | Negative authorization path remains and is more explicit       | **VERIFIED EQUIVALENCE — APPROVAL PENDING** |
| PW-277 | Change a target account role, report failure, retry, and verify the persisted role                     | Edit Account panel and role combobox; full-account PATCH payload; failure feedback, retry, and target role persistence; focused test passed | UI/API interaction adaptation preserves the role-edit scenario | **VERIFIED EQUIVALENCE — APPROVAL PENDING** |

The exact test bodies changed in c42. The current focused result is 4/4 passed. No historical delta was automatically approved or added to the append-only ledger by this report.

## 10. Complete Defect Preservation Inventory

The canonical [Phase 7.5 defect register](phase7.5-defect-register.md) lists 21 open application findings. The most recent complete post-merge suite in the evidence set predates c42; except for the focused runs documented later in this report, the defect-specific reproduction status has not been refreshed after R1. No app-source fix is included in c42.

| Defect ID               | Expected behavior → observed behavior                                                                               | Classification                      | Regression coverage and latest known evidence                                                                                                          | Remaining action                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| APP-REG-001             | Keep all 11 phone digits → input truncates to `081234567`                                                           | OPEN APPLICATION DEFECT             | `auth/registration-validation.spec.ts`; browser failure in register                                                                                    | Fix only under separate authorization; rerun               |
| APP-AUTH-001            | Invalid successful registration response must not establish a session → `sessionStorage` receives `"null"`          | OPEN APPLICATION DEFECT             | `auth/registration-validation.spec.ts`; browser failure in register                                                                                    | Preserve and revalidate                                    |
| BOOK-001                | Booked-service list/detail include booking reference → `referenceNumber` absent from both API responses             | OPEN APPLICATION DEFECT             | Two leaves in `apps/api/tests/booked-services.test.ts) failed                                                                                          | Correct projection and rerun API cases                     |
| SVC-001 / API-PRICE-001 | Reject value above `Decimal(12,2)` with 400 → persistence boundary returns 500                                      | OPEN APPLICATION DEFECT             | Services pricing boundary API leaf failed                                                                                                              | Correct validation and rerun boundary tests                |
| SVC-002                 | Clearing a later-page filter returns to page one → stale local page is restored                                     | OPEN APPLICATION DEFECT             | `services/services-directory.spec.ts); browser failure. c42 changed selectors elsewhere in this spec; the defect assertion was not shown to change     | Revalidate stale-page behavior                             |
| APP-TABLE-001           | Changed/restored project list starts on a valid page → stale page two hides expected row/link                       | OPEN APPLICATION DEFECT             | NEX-017 and P22-WEB-003 browser failure/timeout                                                                                                        | Preserve distinct project-list reproduction                |
| APP-CONV-001            | Archive action and conversation context remain operable → search overlay blocks the action                          | OPEN APPLICATION DEFECT             | Request conversation line 2420 and project conversation lines 311/427; four full-run and four serial timeouts                                          | Reproduce and address overlay interaction                  |
| P13-001                 | Client can navigate Project Details sections → section navigation absent                                            | OPEN APPLICATION DEFECT             | `projects/project-details-regression.spec.ts`, P13-001 browser failure                                                                                 | Keep finding open                                          |
| P13-003                 | Failed brief update provides accessible error → notification absent                                                 | OPEN APPLICATION DEFECT             | Project Details NEX-017 browser failure                                                                                                                | Keep finding open                                          |
| APP-DELIVERABLE-001     | Failed deliverable review gives error feedback → notification does not mount in shared toast viewport               | OPEN APPLICATION DEFECT             | `projects/client-project-workflows.spec.ts`, NEX-017 browser failure                                                                                   | Keep finding open                                          |
| S15-001                 | Settled 404 clears loading and shows error → “Loading project…” remains                                             | OPEN APPLICATION DEFECT             | `projects/workspace-details.spec.ts`, P15-001 browser failure                                                                                          | Keep finding open                                          |
| S15-002                 | Enforce 50-task phase limit → 51st standalone task persists with HTTP 200                                           | OPEN APPLICATION DEFECT             | P15-API-003 PGlite leaf failed; explicitly preserved                                                                                                   | Retain as unresolved API finding                           |
| S16-001                 | Clear workload search and return to page one → previous page two restored                                           | OPEN APPLICATION DEFECT             | P16-WEB-003 browser failure; distinct `useLocalTable` path from APP-TABLE-001                                                                          | Keep distinct and revalidate                               |
| P17-001                 | Reject oversized Unicode URL before persistence with 400 → percent-encoded URL exceeds column limit and returns 500 | OPEN APPLICATION DEFECT             | PGlite API leaf failed                                                                                                                                 | Keep finding open                                          |
| P19-001                 | Show source booking/payment records → hardcoded demo payment details render                                         | OPEN APPLICATION DEFECT             | P19-WEB-001 browser failure                                                                                                                            | Keep finding open                                          |
| P20-001                 | Reject impossible Gregorian dates → `2032-02-30` normalizes to March 1 and is accepted                              | OPEN APPLICATION DEFECT             | P20-API-002 meeting and P20-API-003 consultation leaves failed                                                                                         | Keep both parser cases                                     |
| P21-WEB-005             | Use real/documented support contact → placeholder `.test` address remains                                           | OPEN APPLICATION DEFECT             | Page 21 browser finding                                                                                                                                | Confirm support destination and update under authorization |
| P21-WEB-006             | Help explains every status shown in Booked Requests → FAQ omits historical statuses                                 | OPEN APPLICATION / CONTRACT FINDING | Page 21 browser finding; retained with lifecycle question                                                                                              | Update only after status contract decision                 |
| P22-001                 | Mobile Projects uses expected responsive renderer/controls → wrong layout at breakpoint                             | OPEN APPLICATION DEFECT             | P22-WEB-007 browser failure                                                                                                                            | Keep finding open                                          |
| P23-001                 | Rejected download gives accessible recovery feedback → rejected promise has no handled error/retry guidance         | OPEN APPLICATION DEFECT             | P23-WEB-004 browser failure                                                                                                                            | Keep finding open                                          |
| APP-MENU-001            | Mobile service Edit menu remains available and touch-positioned → Edit item absent                                  | OPEN APPLICATION DEFECT             | Shared dropdown positioning browser failure/timeout. c42 changed another dropdown test in the same file; this mobile assertion was not shown to change | Preserve and revalidate                                    |

### Additional findings and coverage classifications

| Item                                                | Classification                             | Evidence and disposition                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API-TEST-001                                        | OPEN TEST DEFECT                           | `apps/api/tests/request-workflow.test.ts` reads `milestones[0].id` although the client projection intentionally has an empty `milestones` array. It remains open; c42 did not modify that file. |
| BOOK-002                                            | UNRESOLVED CONTRACT                        | Pre-acceptance request conversation returns 404; decide whether a waiting state or unavailable route is intended.                                                                               |
| P10-001 / P10-002                                   | UNRESOLVED CONTRACT                        | Request Inbox decline and delete endpoints return 404; decide whether those operations are required.                                                                                            |
| P22-002                                             | UNRESOLVED CONTRACT                        | STAFF frontend Projects route is admitted while the list API is USER-only/403; decide role-route-API contract.                                                                                  |
| P20-Q01                                             | UNRESOLVED CONTRACT                        | Zone-less consultation timestamps and explicit-offset meeting timestamps have different timezone behavior.                                                                                      |
| D14-001 / D14-002                                   | UNRESOLVED REQUIREMENT                     | Workspace wizard is inaccessible and backlog/accepted documentation differs.                                                                                                                    |
| Workspace terminal edits                            | UNRESOLVED CONTRACT                        | Post-completion task/plan mutation behavior is unspecified.                                                                                                                                     |
| P18-002 password/session throttling                 | UNRESOLVED REQUIREMENT                     | No route-specific password/session rate limiter was established; decide whether one is required.                                                                                                |
| P18-003 preference-write concurrency                | UNRESOLVED CONTRACT                        | Preference-write concurrency/conflict behavior is unspecified.                                                                                                                                  |
| Workload quarter-hour boundary                      | UNRESOLVED CONTRACT                        | UI boundary is accepted; server-side increment rule is not established.                                                                                                                         |
| Request archive lifecycle                           | UNRESOLVED CONTRACT                        | Active/Archived membership for closed/cancelled requests is not fully specified.                                                                                                                |
| Service-request lifecycle                           | UNRESOLVED CONTRACT                        | See Section 12; legacy state semantics and normalization are pending.                                                                                                                           |
| Attendance Verified/Approved                        | UNRESOLVED CONTRACT                        | See Section 13; verification and HR approval are distinct workflow stages.                                                                                                                      |
| NEX-006 workspace wizard; NEX-015 team-lead removal | INTENTIONALLY UNSUPPORTED                  | Preserve as unsupported scope; do not describe as implemented or fixed.                                                                                                                         |
| P18-001 parallel-load timeout                       | INCONCLUSIVE                               | Timeout did not reproduce in serial/controlled repeat.                                                                                                                                          |
| Five live-backend browser cases                     | DEFERRED COVERAGE / ENVIRONMENT LIMITATION | Skipped in offline checkpoints; no disposable integrated environment was certified.                                                                                                             |

No item above is classified VERIFIED FIXED. The R1 commit changes tests/support only and does not close any application finding.

## 11. Post-Merge Regression Execution Evidence

These checkpoints have different revisions, inventories, commands, and conditions. Their counts must not be combined.

| Checkpoint                        | Source / command and environment                                                                                                                  | Reported result                                                                                                                                      | Evidence and limitation                                                                                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical Phase 2                | Revision `2075d354d62dd15b6d34b53600416de336eca4d6`; Playwright CLI with 2 workers, 0 retries; local standalone build; mocked API; no database    | **287 passed, 0 failed, 5 skipped** of 292                                                                                                           | [Phase 2 execution command](../../../../test-results/phase2-audit/execution-command.json) and verification record. Build revision was unverified; live-account cases skipped.                                                                           |
| Phase 7.2                         | Source HEAD `4e98092d0bfedcad679db92f701efad9ace768e9`; fresh production web build; controlled browser batches, one worker/no retries; API mocked | **319 passed, 2 failed** of 321 applicable offline; 5 live cases skipped                                                                             | [Phase 7.2 report](phase7.2-page-verification.md). Two NEX-017 notification findings; browser mocks do not prove API persistence/authorization.                                                                                                         |
| Phase 7.3                         | Source HEAD `4e98092d0bfedcad679db92f701efad9ace768e9`; `pnpm test:api`; 28 modules, PGlite/mock/in-process fixtures                              | 184 TAP entries: 181 passed, 3 failed entries including parent suites. After targeted diagnosis: **169/170 unique leaves passed, 1 failed**          | [Phase 7.3 API report](phase7.3-api-verification.md). One test-contract defect; five live browser cases not run.                                                                                                                                        |
| Phase 7.4                         | Source HEAD `4e98092d0bfedcad679db92f701efad9ace768e9`; focused 21-case cross-page run                                                            | **19 passed, 2 failed**                                                                                                                              | [Phase 7.4 report](phase7.4-cross-page-verification.md). Both failures were known NEX-017 notification cases; no live backend.                                                                                                                          |
| Phase 7.5                         | Source HEAD `2e9d01e8ffd4335d1a3e535e0fdda7557c3ca368); browser regression, `pnpm test:api`, `pnpm test:web`; offline fixtures                    | Playwright **509/534 passed, 20 failed, 5 skipped**; API **267/276 unique leaves passed, 9 failed**; web unit **98/98 passed**                       | [Execution matrix](phase7.5-execution-matrix.md). Five live cases skipped; preservation incomplete.                                                                                                                                                     |
| Development merge checkpoint      | Source SHA not pinned in the cited register; checkpoint preceded restoration of historical status assertions                                      | API **447/461 passed, 14 failed TAP entries**; web unit **123/123 passed**; Playwright **588 passed, 35 failed, 5 skipped, 15 not run**              | [Defect register](phase7.5-defect-register.md). Not a passing regression suite; full suite not rerun after status assertion restoration.                                                                                                                |
| Post-merge investigation, pre-c42 | Post-merge logs; 643 discovered cases; exact source SHA not pinned in the cited evidence                                                          | Playwright **582 passed, 41 failed, 5 skipped, 15 not run**; API **447/461 with 14 failed TAP entries**                                              | [Playwright log](../../../../test-results/phase7/post-merge-investigation/playwright-full-current.log) and [API log](../../../../test-results/phase7/post-merge-investigation/api-full-current.log). Distinct from the 588/35 checkpoint; predates c42. |
| Current c42 discovery             | Playwright `--list`                                                                                                                               | **643 tests in 84 files**                                                                                                                            | Discovery only; not an execution pass.                                                                                                                                                                                                                  |
| Current focused R1/status run     | Source c42; local production build; API fixtures mocked                                                                                           | 9 selected: **4 passed, 5 failed**. Four R1 candidates passed; PW-022/023/025/050/051 failed on retained historical labels versus current “Pending.” | Focused run only; current failure artifacts were generated under ignored test-results paths.                                                                                                                                                            |
| Current attendance run            | Source c42; local mocked production build                                                                                                         | **2 passed, 1 failed**                                                                                                                               | Superadmin navigation cases passed; attendance assertion for Approved failed against current Verified state.                                                                                                                                            |
| Current API focused module        | Source c42; PGlite; no persistent database                                                                                                        | `service-specialists.test.ts`: **5/5 passed**                                                                                                        | Focused API module only; does not validate full API suite or lifecycle semantics.                                                                                                                                                                       |

The complete suite was not rerun after R1. No full-suite pass is claimed. The current Playwright and API focused runs used isolated mocks/PGlite; no shared or production database migration was run.

## 12. Service-Request Lifecycle Reconciliation

The incoming development commit is `e8bc3048c628d974ac7b7c24950337a11b90f0f5` (2026-11-16 06:07 +08), parent `36b6e071e6c14d11d4b1188b7ee083f538c5c0ce`. It adds statuses, migrations, filters, summaries, transitions, UI mappings, and documentation. This is **not a presentation-only change**.

### Status mapping

| Internal/database/API value | Historical UI label                  | Development UI label | Workflow meaning and evidence                                                                                                                                          | Recommended decision                                                                                       |
| --------------------------- | ------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `SUBMITTED`                 | Pending review                       | Pending              | New request creation stores `SUBMITTED`. It waits for Department Head acceptance. Inbox acceptance writes `UNDER_REVIEW`.                                              | The label change may be presentation-only for this value; do not change historical tests without approval. |
| Pending                     | No internal status                   | Pending              | Frontend display label for `SUBMITTED`; **not** a database/API enum. API validation rejects `PENDING`.                                                                 | Document as display text only.                                                                             |
| `UNDER_REVIEW`              | Under review                         | Under Review         | Department Head accepted the request. The API acceptance path updates `SUBMITTED` or an eligible `UNDER_REVIEW` request and records accepting department/account/time. | Confirm capitalization/meaning before deciding historical assertion.                                       |
| `AWAITING_CLIENT_INFO`      | Awaiting your information            | Under Review         | Legacy enum remains. Current model description says more client information is needed. Migration maps accepted requests to `UNDER_REVIEW`, otherwise `SUBMITTED`.      | Do not approve equivalence; decide how a request awaiting client information is represented.               |
| `READY_FOR_QUOTATION`       | Ready for quotation                  | Under Review         | Legacy enum remains. Migration maps based on accepted department to `UNDER_REVIEW` or `SUBMITTED`; the old quotation status is absent from the five UI choices.        | Decide whether quotation readiness remains a distinct visible state or workflow metadata.                  |
| `ACTIVATED`                 | No historical service-request status | Activated            | Workflow activation changes project `PLANNED` to `IN_PROGRESS` and writes request `ACTIVATED`; it represents staff/team assignment and an active workspace.            | Confirm activation trigger and client-visible meaning.                                                     |
| `CONCLUDED`                 | No historical service-request status | Concluded            | Completing a linked workspace writes request `CONCLUDED`; client summary treats it as completed.                                                                       | Confirm whether this is intended to replace any legacy “Closed” semantics.                                 |
| `CLOSED`                    | Closed                               | Cancelled            | Legacy enum remains in schema/API filters, but migration maps it to `CANCELLED`. Client summary also changes `CLOSED` from completed to cancelled.                     | Do not approve Closed-to-Cancelled equivalence; clarify historical records and archive behavior.           |
| `CANCELLED`                 | Cancelled                            | Cancelled            | Cancellation paths update request state to `CANCELLED`; label remains.                                                                                                 | Confirm migration/archive implications; label alone does not settle semantics.                             |

Historical database enum: `SUBMITTED`, `UNDER_REVIEW`, `AWAITING_CLIENT_INFO`, `READY_FOR_QUOTATION`, `CLOSED`, `CANCELLED`. Current database enum retains those and adds `ACTIVATED`, `CONCLUDED`. API status payloads use enum values; “Pending” is not returned as an API status value.

### Transition and migration evidence

- New service requests are created with status `SUBMITTED`.
- Department Head acceptance transitions eligible requests to `UNDER_REVIEW`; the API checks department-head authority and acceptance state.
- Workflow activation updates the project to `IN_PROGRESS` and its request to `ACTIVATED`.
- Completing a linked project workspace updates the request to `CONCLUDED`.
- Workspace cancellation and workflow cancellation update requests to `CANCELLED`.
- The inbox adds Activated and Concluded filters and changes labels to Pending and Under Review. Its UI removes Awaiting Information, Ready for Quotation, and Closed choices.
- The incoming commit also adds a Superadmin read-only service-request visibility surface and role-specific navigation. This is an authorization boundary separate from label equivalence; the status mapping does not establish that all role permissions remained unchanged.

The normalization migration applies these rules in order: request/project cancellation → `CANCELLED`; completed project → `CONCLUDED`; in-progress/on-hold project → `ACTIVATED`; legacy request `CLOSED` → `CANCELLED`; preserve `ACTIVATED`/`CONCLUDED`; accepted department → `UNDER_REVIEW`; otherwise → `SUBMITTED`. The migration was not changed or run against a shared database in this audit.

The UI mapping is in [service-request-status.ts](../../../../apps/web/src/features/services/model/service-request-status.ts); the current enum is in [schema.prisma](../../../../apps/api/prisma/schema.prisma); normalization is in [the lifecycle migration](../../../../apps/api/prisma/migrations/20261115040100_normalize_request_lifecycle/migration.sql). Current transitions are implemented in the service-request, request-inbox, workflow, and project-workspace services.

The lifecycle changes therefore include presentation terminology, backend enum changes, persisted workflow transitions, summary/category changes, and migration normalization. No equivalence is established for `AWAITING_CLIENT_INFO`, `READY_FOR_QUOTATION`, or `CLOSED`. Their semantics and client-visible progress remain an **UNRESOLVED CONTRACT**.

## 13. Attendance Contract Findings

The current attendance workflow distinguishes:

| State        | Meaning                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| **Verified** | Department Head verification is complete; the request is still awaiting HR |
| **Approved** | HR final approval is complete                                              |

The source renders “Verified — awaiting HR,” and the API/type layer distinguishes verification and approval capabilities. These are sequential workflow stages, not equivalent labels. The focused c42 run reproduced an attendance assertion expecting Approved while the current row showed Verified.

**Classification:** UNRESOLVED CONTRACT.

**Impact:** historical test expectation and current workflow stage disagree; treating the labels as synonyms would hide incomplete HR review.

**Decision required:** define the expected stage and update regression expectations only after administrative approval. No attendance assertion was changed in this audit.

## 14. Documentation Consistency Findings

1. **Lifecycle contradictions:** [Department Request Inbox documentation](../../../features/department-request-inbox.md) describes a five-status lifecycle and says old enum values remain for compatibility. [Client Service Requests documentation](../../../features/client-service-requests.md) still describes old filter/status and migration semantics, including `CLOSED` as completed. Its opening describes the new lifecycle, leaving inconsistent statements in the same document.
2. **Mixed API/database contract:** the current Prisma/API contract retains eight enum values; the UI collapses several old values into new labels. API parsers retain legacy values even though the inbox UI no longer offers some old filters.
3. **Stale Phase 7.5 exports:** the preservation export still lists PW-053–PW-056 despite a later identity-specific ledger entry. Do not rewrite the immutable baseline or raw export; record the later reconciliation separately.
4. **Outdated defect register:** the Phase 7.5 register repeats the Development merge checkpoint heading and says Phase 7.5.1 has not started. It omits the later 582/41 investigation, c42 changes, and focused c42 outcomes.
5. **Missing R1 documentation:** c42 changes test behavior and support, but has no associated documentation update. This report records the audit without modifying the register.
6. **Attendance terminology:** current test evidence distinguishes Verified from Approved, but that discrepancy needs a durable contract record.
7. **Naming:** use Converyn for current product prose. Preserve Nexus in historical paths, package names, environment variables, and archived source identifiers.
8. **Readiness claims:** no production-readiness claim was found in the reviewed reports. Retain their defect and limitation qualifications.

All 23 Phase 7 page reports are present in [the page-by-page directory](page-by-page/). The [Phase 7.5 consolidated report](phase7.5-consolidated-verification.md), [defect register](phase7.5-defect-register.md), and [execution matrix](phase7.5-execution-matrix.md) describe earlier checkpoints and should remain dated as such.

## 15. Required Administrative Decisions

| Decision                                                                             | Status                                         | Required disposition                                                                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Existing Phase 6-approved historical replacements and ledger entries                 | APPROVED as previously recorded                | Preserve their identity-specific scope; do not expand them by inference.                                                    |
| PW-149 title/identity and alert-role assertion                                       | APPROVAL PENDING                               | Decide whether a title alias is acceptable and whether role=`alert` is required coverage.                                   |
| PW-070, PW-273, PW-276, PW-277 R1 equivalents                                        | APPROVAL PENDING                               | Review each candidate and record separate decisions; this report does not approve them.                                     |
| PW-053–PW-056 later client-directory delta                                           | APPROVED as recorded in the append-only ledger | Keep the old export as historical evidence; reconcile it in a later dated record.                                           |
| PW-281–PW-282 table adaptations                                                      | APPROVED as recorded in the append-only ledger | Do not assume the separate table route assertion is covered without exact mapping.                                          |
| 52 assertion-site crosswalk and current 4,211 mapping                                | UNRESOLVED                                     | Reconcile after addressing the PW-149 verifier gate.                                                                        |
| Awaiting-information, ready-for-quotation, closed/cancelled, and migration semantics | UNRESOLVED CONTRACT                            | Decide whether historical states remain distinct and define client-visible progress before changing labels/tests/migration. |
| Attendance Verified versus Approved                                                  | UNRESOLVED CONTRACT                            | Preserve verification and HR approval as distinct stages unless requirements explicitly decide otherwise.                   |
| BOOK-001, BOOK-002, S15-002, P21-WEB-006 and other register findings                 | OPEN / UNRESOLVED as classified in Section 10  | Keep findings open; do not classify as fixed without evidence.                                                              |
| R2/R3/R4                                                                             | DEFERRED                                       | Do not implement in this report task.                                                                                       |
| Phase 8                                                                              | DEFERRED / NOT STARTED                         | Do not begin automatically.                                                                                                 |
| Production readiness                                                                 | NOT APPROVED                                   | No readiness certification is made.                                                                                         |

## 16. Recommended Next Steps

1. Obtain administrative disposition for PW-149 without changing the immutable Phase 4 baseline.
2. Run a current identity-aware assertion and ownership crosswalk after resolving the verifier gate.
3. Review all 52 unresolved source sites individually and retain the earlier CSVs as immutable evidence.
4. Obtain individual approval decisions for PW-070, PW-273, PW-276, and PW-277; record any approved deltas in the authorized append-only ledger.
5. Decide the service-request lifecycle and attendance contracts before changing labels, assertions, or migrations.
6. Reconcile the defect register, feature guides, preservation exports, and execution checkpoints with dated notes; preserve open defects, unsupported scope, and deferred coverage.
7. When authorized, run the full post-R1 suite on a pinned source revision and report results without combining checkpoints.
8. Ask administration to assess Phase 7.5 completion only after preservation and verification blockers have explicit dispositions.

Do not begin Phase 7.5-R2/R3/R4 or Phase 8 automatically.

## 17. Final Reconciliation Status

**RECONCILIATION PARTIALLY COMPLETE — UNRESOLVED HISTORICAL DISCREPANCIES**

- Phase 7.5.1 has been investigated and documented.
- Full historical preservation remains unverified.
- PW-149 and the historical assertion/ownership discrepancies remain unresolved.
- The four R1 equivalences remain approval-pending.
- Known application and test defects remain open; none is marked fixed without new evidence.
- The full regression suite has not been rerun after R1.
- No production readiness is certified.
- Phase 7.5-R2/R3/R4 remain deferred.
- Phase 8 has not started.

**Stop for administrative review.**
