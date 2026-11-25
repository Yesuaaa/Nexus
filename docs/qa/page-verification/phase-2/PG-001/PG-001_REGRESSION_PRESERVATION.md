# PG-001 Regression Preservation

**Result:** Existing regression source was preserved; selected existing authentication tests passed in the focused run.  
**Scope:** No existing E2E declaration was removed, renamed, skipped, or weakened.  
**Design baseline:** [Phase 2.1 existing test review](PG-001_EXISTING_TEST_BASELINE.md).

## Existing source preserved

`apps/web/e2e/auth/regression.spec.ts` was not modified. The original anonymous-root test remains at lines 390-408:

```ts
test("anonymous home and protected deep links redirect to login", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/dashboard",
    "/accounts",
    "/departments",
    "/employees",
    "/services",
    "/clients",
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible()
  }
})
```

The containing authentication suite still has `test.skip(live, "Live mode uses the supplied accounts against the real API")` at lines 16-17. The new mocked-only file does not use this skip or real accounts.

## Other related assertions kept intact

| Existing declaration                                                                                | Assertions retained                                                                                   | Focused execution          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| `regression.spec.ts:338-353` — persistent storage cannot restore an authenticated session           | `localStorage` token/refresh token; `/accounts` ends at `/login`; captured API request list is empty. | Passed                     |
| `regression.spec.ts:410-438` — STAFF/ADMIN/SUPERADMIN sign-in goes directly to workspace selector   | Each role sees the workspace selector and the only recorded destination is `/module`.                 | All three passed           |
| `regression.spec.ts:57-110` — role-based expired access renewal and sign-out                        | One refresh, renewed session tokens, no persistent token/cookie, and sign-out assertions.             | All four role cases passed |
| `regression.spec.ts:653-669` — opening login with an expired token allows sign-in                   | Login form remains usable and stale access token is cleared.                                          | Passed                     |
| `regression.spec.ts:671-697` — login session checks preserve token on server error and retry        | Alert, token retention, retry destination, and preserved session.                                     | Passed                     |
| `regression.spec.ts:699-716` — expired sessions clear token and return to login                     | 401 from `/api/auth/me` leads to `/login` and clears token.                                           | Passed                     |
| `jwt-session.spec.ts:16-83` — expired access refreshes on login navigation and logout clears tokens | One refresh, rotated refresh token, successful dashboard handoff, and logout clearing.                | Passed                     |

The full execution list and exact command appear in [test execution results](PG-001_TEST_EXECUTION_RESULTS.md).

## Change audit

- Existing `apps/web/e2e/auth/regression.spec.ts` and `apps/web/e2e/auth/jwt-session.spec.ts` are unchanged.
- Existing E2E helper `apps/web/e2e/regression-support.ts` is unchanged.
- Existing assertions in `apps/web/test/auth-api.test.mjs` and `apps/web/test/auth-portal.test.mjs` are unchanged; T001 was added additively to the former.
- New browser cases are isolated in `apps/web/e2e/auth/home-redirect.spec.ts` and use existing `mockApi` fixtures where account resolution is required.
- No existing test was marked skipped or made conditional by this change. Existing suite live-mode skip behavior remains as before.
