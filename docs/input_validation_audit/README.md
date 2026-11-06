# Input Validation Audit

**Audit date:** 2026-11-06  
**Pages:** `/login` and `/register`

## Executive Summary

- **Overall validation status:** Pass for client validation, API boundaries, PGlite integration paths, typechecks, lint, and formatting checks that ran. Playwright browser interactions could not be executed because the sandbox denied spawning its worker process.
- **Input surfaces identified:** 9 UI surfaces: 3 on Login and 6 on Register, including each page's language selector. The API separately accepts 2 Login JSON properties and 4 Register properties. Password confirmation and language selection are client-only; neither page has hidden form fields.
- **Validation issues discovered:** 10 total, counted by independent rule or handling gap: 2 Login and 8 Register.
- **Issues fixed:** 10.
- **Unresolved validation issues:** 0 known in the audited flows. Browser interaction results remain unverified in this environment.
- **Test results:** Web auth validation 8 passed; API auth schema 4 passed; PGlite JWT/session suite 11 passed; API login boundary suite 6 passed; client integration suite 10 passed; password management test 1 passed. Direct Prettier, ESLint, API TypeScript compile, Next route type generation, and web TypeScript checks passed.
- **Remaining risks:** Playwright flows could not run because of `spawn EPERM`. The Login failure limiter is process-local and does not coordinate across multiple API replicas. PGlite does not establish behavior against a production database or deployment.

### Counting method

An input surface is a distinct user-editable value or selection. Buttons are controls, not input surfaces. API body properties are reported separately. Repeated failure cases for one rule count as one issue; distinct rule mismatches count separately.

| Page      |                                                              UI input surfaces |                                 API JSON properties |
| --------- | -----------------------------------------------------------------------------: | --------------------------------------------------: |
| Login     |                                          3: email, password, language selector |                              2: `email`, `password` |
| Register  | 6: full name, contact number, email, password, confirmation, language selector | 4: `fullName`, `contactNumber`, `email`, `password` |
| **Total** |                                                                          **9** |                                               **6** |

## Per-page audits

- [Login audit](login.md)
- [Register audit](register.md)

The root `pnpm test:e2e` runner forwards arguments to the web Playwright command. Its config discovers every `**/*.spec.ts` file, including the registration regression cases in `apps/web/e2e/regression.spec.ts`; therefore `pnpm test:e2e -- --ui` includes them in Playwright UI mode.

## Verification limits

Playwright could not start because Node was denied permission to spawn its worker (`EPERM`). Added browser cases are typechecked but are not reported as executed. The `pnpm format`, `pnpm lint`, and `pnpm typecheck` wrappers could not start because pnpm was denied access to `C:\Users\ADMIN\AppData\Local\pnpm-store-operation-locks\all-stores.lock`; equivalent local Prettier, ESLint, and TypeScript commands passed.
