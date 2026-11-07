---
name: test-and-debug
description: Structured testing, interactive debugging, and local verification protocol to run after developing a feature or fixing a bug before committing or pushing changes to GitHub.
---

# Test & Debug Protocol (Pre-Push Quality Gate)

This skill outlines the mandatory testing, interactive debugging, and local verification process that must take place after creating a feature or fixing a bug, **before** committing, pushing to GitHub, or creating a Pull Request.

---

## 1. Core Philosophy: Do Not Rush to Push

When an issue is tasked or a fix is implemented, **do not immediately commit, push to remote, or open a PR**.

Rushing to push causes:

- Untested regressions and visual glitches in production.
- Noisy commit history and premature PR reviews.
- Lack of hands-on verification time for the developer or user.

**The Golden Rule:**

> Always complete the local testing and interactive debugging steps, review source control diffs, and present the results to the user for confirmation **before** pushing to GitHub.

---

## 2. Phase 1: Automated Verification & Unit Tests

Run the relevant automated test suites based on what was changed:

### For Web and API changes:

```bash
# 1. Format verification
pnpm format

# 2. Linter (zero warnings enforced)
pnpm lint

# 3. TypeScript compiler
pnpm typecheck

# 4. Backend tests (in-memory PostgreSQL via PGLite)
pnpm --filter @nexus/api test
```

### For Mobile changes (`apps/mobile`):

```bash
# 1. KMP shared unit tests
./apps/mobile/gradlew.bat -p apps/mobile :shared:testAndroidHostTest

# 2. (Optional) Compile debug APK
./apps/mobile/gradlew.bat -p apps/mobile :androidApp:assembleDebug
```

---

## 3. Phase 2: Runtime Testing & Interactive Debugging

Automated unit tests only verify business logic. Visual UI, state transitions, and network communication require interactive runtime verification.

### 🌐 Web & API Runtime Checks:

1. **Start the local dev servers**:
   ```bash
   pnpm dev
   ```
2. **Verify API health**:
   ```bash
   curl http://localhost:3001/api/health
   ```
3. **Verify in Browser (`http://localhost:5173`)**:
   - Check the Browser Developer Console (`F12`) for React warnings, hydrations errors, or uncaught exceptions.
   - Open Network tab to inspect payload format, HTTP status codes, and latency.
   - Verify UI responsive layouts (mobile, tablet, desktop viewports).

### 📱 Mobile Runtime & Device Checks:

1. **Verify ADB & Emulator status**:
   ```bash
   adb devices
   ```
   Ensure at least one emulator or physical device displays status `device`.
2. **Start Backend with Port Forwarding**:
   ```bash
   pnpm dev:mobile          # Local Node/pnpm
   # OR
   pnpm dev:mobile:docker   # Containerized backend
   ```
3. **Build, Install, and Launch App**:
   ```bash
   pnpm run:mobile
   ```
4. **Interact with the Actual User Flow**:
   - Manually perform the exact steps described in the issue or bug report.
   - Observe screen transitions, state persistence, backstack behavior, and input validations.
   - Watch Android Logcat for exceptions or recomposition loops:
     ```bash
     adb logcat *:E
     ```

---

## 4. Phase 3: Source Control Inspection (`git status` & `git diff`)

Before staging or committing any code:

1. **Inspect status**:
   ```bash
   git status
   ```
   Verify that:
   - No sensitive files (`.env`, secrets, private keys) are untracked or staged.
   - No build artifacts (`dist/`, `.next/`, `build/`, `.gradle/`, transformed jars) are included.
2. **Inspect exact changes**:
   ```bash
   git diff
   ```
   - Check every line changed for unintended side effects or debug print statements (`console.log`, `println`).
   - Ensure documentation, comments, and types match project conventions.

---

## 5. Phase 4: Developer / User Confirmation Gate

Once all tests pass and local runtime verification is complete:

1. Present a clear summary of:
   - What was tested and verified.
   - Files changed in source control.
   - Any manual steps the user can perform locally to see the result.
2. **Ask the user for approval** before pushing to remote (`git push`) or creating a GitHub PR (`gh pr create`).
