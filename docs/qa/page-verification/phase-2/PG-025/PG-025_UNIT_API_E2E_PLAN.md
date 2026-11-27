# PG-025 Unit, API and E2E Plan

**PLANNED — NOT EXECUTED**

```text
pnpm --filter @nexus/web exec playwright test e2e/help/page-21-regression.spec.ts e2e/help/pg025.spec.ts --workers=1 --retries=0
```

Read current Playwright config at execution entry. Its default non-live path starts owned loopback test upstream and standalone Next on 5274/5273, with reuseExistingServer false and web build in Phase 2.2 only. Verify pnpm, browser binaries, ports, non-live fixtures and effective loopback origins before startup. Isolated context per declaration with regression-support; no external delivery or live credentials. Release route gates in finally and use runner-owned teardown.

T015 collects request and rendering observations before imposing strict oracles, separating shared auth/preferences/Next traffic from Help actions. T016 independently records token and DOM results after navigation. For T018 collect each width and aggregate mismatches, or use soft assertions which still fail the test. Do not infer snapshots or checks after a failed prerequisite. Preserve original assertions and report completion by viewport.

No new deterministic exported Help transform warrants a Unit case. Browser proves local interactions, auth-mock state and actual Next route crossing to Messages. API/PGlite and real rewrite cannot test a nonexistent Help business API; real shared auth or Messages record tests are separate. PG-022/023/024 rewrites do not exercise Help. No Help writes, transactions or competing database connections; no provider-specific contention case. Rapid local state and shared auth settlement remain scoped Browser concurrency. No environment provisioning in this phase.
