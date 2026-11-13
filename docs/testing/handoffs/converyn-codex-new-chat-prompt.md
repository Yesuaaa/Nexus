# New Codex Chat Initialization Prompt — Converyn Playwright Regression Project

You are continuing the Converyn (formerly Nexus) Playwright regression-testing project in the Nexus repository. Your first action is to read the complete project handoff at docs/testing/handoffs/converyn-playwright-regression-handoff.md and then read the relevant accepted reports named there. This prompt is self-contained, but the handoff contains the full evidence map, page matrix, defect register, decisions, and count caveats.

## Project and roadmap

Converyn is a role-based business operations/service platform. The repository uses Next.js/React/TypeScript for the web app, Express/Node/TypeScript for the API, Prisma/PostgreSQL, Playwright with Chromium, Node’s built-in API test runner, PGlite for isolated API/database tests, and pnpm. The repository/package names still say Nexus. Roles are SUPERADMIN, ADMIN, STAFF, and USER; USER is labeled “Client”. Authorization also depends on explicit permissions, current Department Head status, resource ownership, and project/workspace assignments.

The original eight phases are: (1) Repository Inspection, (2) Regression Coverage Audit, (3) Modular Regression Architecture Design, (4) Regression Refactoring, (5) Coverage Planning, (6) Page-Specific Regression Implementation, (7) Verification and Reliability, and (8) Final Documentation and Maintenance Guidelines. Phases 1–6 are complete with preserved limits. Phase 7.1–7.4 are documented; Phase 7.4.1 has accepted Pages 1–8. Phase 7.5 combined/live verification is not started. Phase 8 is not complete. No approved standalone Phase 3 architecture ledger was found, so do not claim an unrecovered design decision.

## Preservation and accepted work

The immutable historical baseline is 292 original Playwright identities, 1,630 historical assertion sites, and 4,211 identity-to-site mappings. The Phase 4 baseline and Phase 6 reconciliation snapshots must not be regenerated or overwritten. Historical deltas are recorded in the append-only docs/testing/migrations/phase6/approved-regression-deltas.md ledger.

Pages 1–8 are the current accepted page-by-page checkpoint, with defects and limitations documented:

1. Login — /login
2. Registration — /register
3. Dashboard — /dashboard
4. Account Management — /accounts
5. Client Management — /clients
6. Employee Management — /employees
7. Department Management — /departments
8. Services — /services

These pages added 54 browser cases: 3, 20, 9, 5, 7, 3, 2, and 5 respectively. Pages 7 and 8 also added seven isolated API cases. These additions are separate from the 292 original identities. The ordered authoritative matrix is docs/testing/verification/phase7/phase7.1-baseline.md.

## Failure investigation and latest verification

The broad browser run discovered 440 tests in 58 files and executed 423 passed, 12 failed, and 5 skipped. Its 12 failures were recorded before the approved F1/F2 correction. Subsequent focused runs passed the full form-input spec 7/7, F1 at 1440px and F2 at 390px (2/2), and client workflows M1/M2/N1–N4 (6/6). The full suite was not rerun. Therefore 425 passed, 10 failed, 5 skipped is only a projection.

The current targeted API group has seven unique leaves: six passed and one failed on the Services pricing/database boundary. Do not double-count TAP parent failures. An older Phase 7.3 request-workflow API test-contract defect also remains documented: a test expects a client-hidden milestone from a USER response that intentionally omits milestones.

Ten browser leaves remain genuine application failures: C1 formatted Registration contact truncation; C2 malformed Registration token stored as “null”; G1 and H1–H3 conversation archive/search overlap; I1 and M3 stale pagination; I2 missing failed-response notification viewport; O1 mobile service row menu unavailable. I1 and M3 share one pagination defect; G1/H1–H3 share one conversation header overlap. The API pricing defect is separate. Other historical limits include LOGIN-001 malformed Login token, LOGIN-002 missing Forgot Password route, NEX-017 missing project error notifications, NEX-006 inaccessible workspace wizard, NEX-015 team-lead removal contract ambiguity, Request Inbox decline/delete contract absence, SVC-003 client requirements UI/API mismatch, read-only Client Management, and unsupported Dashboard widgets. No product source was fixed by the investigation.

The user approved authentication input height at 48px for Login and Registration. Application h-12 styling is intentional. F1/F2 retain focus, border-only, focus-visibility, consistency, and responsive assertions. Other form consumers retain their 40px default. Historical confirmation-heading focus remains required; tests focus the current “Request submitted” heading. Toast visibility is a separate check inside Sileo’s aria-live polite region.

Nine historical assertion sites are source-verified as equivalent, representing 22 identity-to-site references. Focus assertions were preserved, not replaced with toast visibility. Details and accepted evidence are in the investigation report and append-only ledger.

## Current Git snapshot

The verified branch is 219-feat-Phase-1-playwright-refactor-and-modularize-playwright-regression-tests-across-all-pages. Current HEAD is 30ce6951b30dc22e5c40134c319dd5be778a28ed and the upstream tracking ref was at the same commit. The accepted development merge b6d9b8ae4ccdac5341fcff7df2223f3bef47bb23 is an ancestor. At the handoff snapshot, prior reconciliation work had been committed in 30ce695 and the worktree was clean before the two handoff documents were created. These two docs are the only expected new untracked files. Re-check live status; do not assume it is unchanged.

## Next page and authorization

The authoritative inventory identifies Page 9 as **Client Service Requests**, route **/service-requests**. It is a USER-only, owner-scoped request history/details/state page. Existing ownership is apps/web/e2e/service-requests/client-service-requests.spec.ts and the client-requests API module.

**Page 9 is not authorized to begin until the user explicitly asks for its implementation. A handoff, roadmap entry, or this prompt is not authorization.** Until then, preserve the repository and wait for the user’s Page 9 request.

After explicit authorization, inspect current Git state, then inspect the page source, API routes/services, validation, authorization, Prisma relationships, and existing regression specs before defining gaps. Use mocked browser tests for UI behavior and PGlite for isolated persistence. Correct only proven test implementation mistakes; preserve real application defects. Keep API and browser counts separate, maintain historical identity/assertion mappings, document results, and stop for administrative review after the page report.

## Restrictions

Do not modify application/backend source, Prisma schema, dependencies, lockfiles, or unrelated tests under a testing-only task. Do not remove historical tests, weaken valid assertions, add skips to hide defects, or invent contracts/features. Do not run a full regression suite merely to reconstruct prior results. Do not use a shared/production database or live credentials. Do not overwrite accepted reports or immutable baseline evidence. Do not commit, push, merge, rebase, reset, switch branches, start Page 9, start Phase 7.5, or begin Phase 8 without separate user authorization.

First read the comprehensive handoff. Then verify the live repository state and await explicit authorization for Page 9.
