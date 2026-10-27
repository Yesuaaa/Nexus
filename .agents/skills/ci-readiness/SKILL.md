---
name: ci-readiness
description: Diagnostic runbook and step-by-step procedures to verify, troubleshoot, and fix formatting, ESLint, TypeScript, and build errors in the Nexus monorepo before pushing to CI.
---

# CI Readiness & Code Verification Runbook

This skill outlines the diagnostic workflows and remediation steps to ensure that all changes pass the Nexus CI pipeline ([.github/workflows/ci.yml](file:///c:/FOR%20CODING/capstone/.github/workflows/ci.yml)) cleanly.

---

## 1. Quick Quality Verification Command

Run this command chain to verify the complete matrix evaluated by GitHub Actions:

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

---

## 2. Formatting Troubleshooting (`pnpm format:check`)

### Symptom:

`prettier --check .` reports code style warnings or fails in CI.

### Root Cause:

Manual indentation, unformatted markdown tables, trailing spaces, or imports not matching `.prettierrc.json`.

### Fix:

Always run the automatic formatter rather than manually editing spacing:

```bash
pnpm format
```

Verify afterward:

```bash
pnpm format:check
```

---

## 3. ESLint Troubleshooting (`pnpm lint`)

### Symptom:

`eslint . --max-warnings 0` reports errors or warnings.

> **CRITICAL:** CI enforces `--max-warnings 0`. A single warning will fail the entire build.

### Common Issues & Solutions:

1. **Unused Imports or Variables:**
   - Remove unused symbols or prefix with `_` if intentionally ignored by design.
   - Do not leave dead debug variables in controllers or React components.
2. **React Hooks Dependency Arrays (`react-hooks/exhaustive-deps`):**
   - Ensure all reactive values referenced in `useEffect`, `useCallback`, or `useMemo` are properly included in the dependency list or extracted using stable callbacks.
3. **`any` Usage:**
   - Replace `any` with explicit interfaces, generics, or `unknown` combined with type guards.
4. **Do Not Suppress Recklessly:**
   - Avoid adding `// eslint-disable-next-line` comments unless resolving an unavoidable framework-level bug. Fix the underlying root cause instead.

---

## 4. TypeScript & Typecheck Troubleshooting (`pnpm typecheck`)

### Common Issue A: Prisma Type Mismatches

**Symptom:**
TypeScript errors like `Property '...' does not exist on type 'User'` or `Module '../src/generated/prisma' has no exported member...`

**Fix:**
Regenerate the Prisma client from the active `schema.prisma`:

```bash
pnpm db:generate
```

Then rerun typecheck:

```bash
pnpm typecheck
```

### Common Issue B: Next.js App Router Page Props or Route Types

**Symptom:**
Next.js type errors for dynamic params, searchParams, or layout types in `apps/web`.

**Fix:**
Generate fresh Next.js App Router types:

```bash
pnpm --filter @nexus/web exec next typegen
pnpm typecheck
```

### Common Issue C: Explicit Function Return Types

**Symptom:**
Implicit `any` errors or mismatched Promise returns.

**Fix:**
Always declare return types explicitly for:

- API route handlers: `Promise<void>` or `Promise<Response>`
- Service functions: e.g. `Promise<UserWithDepartment | null>`
- React component props: `interface Props { ... }`

---

## 5. Build Troubleshooting (`pnpm build`)

### Web Standalone Script:

In `apps/web`, the build command runs `next build && node scripts/prepare-standalone.mjs`.

- If `.next/standalone` cannot be copied, verify write permissions and ensure that static asset directories (`public/`) exist.
- Ensure all environment variables needed at build time (e.g. `API_PROXY_TARGET`) have safe fallback values in development.

### API Build:

In `apps/api`, the build command runs `prisma generate && tsc`.

- If build outputs fail, delete `apps/api/dist` and rebuild with:

```bash
pnpm --filter @nexus/api build
```
