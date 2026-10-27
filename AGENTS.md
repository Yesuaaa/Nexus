# Nexus Agent Guidelines & Quality Guardrails

This file provides workspace-level instructions for AI assistants working on the Nexus codebase.

---

## 1. Mandatory Pre-Handoff Quality Gate

Before declaring any task, feature, or bug fix complete, you **MUST** run the quality verification commands and ensure all pass with exit code 0:

```bash
# 1. Format all code and docs using Prettier
pnpm format

# 2. Verify ESLint (CI enforces --max-warnings 0)
pnpm lint

# 3. Typecheck both web and api
pnpm typecheck
```

If any check fails, resolve the issues immediately before concluding your response. Never ask the user to commit code that fails `format`, `lint`, or `typecheck`.

---

## 2. Core Architecture Invariants

- **Authentication Token Storage:** Web client stores Bearer tokens in `sessionStorage` only. Never use `localStorage` or introduce cookie-based sessions.
- **Network Routing:** Next.js proxies `/api/*` to the Express backend (`http://localhost:3001`). Web clients make same-origin requests (`/api/...`).
- **RBAC Strictness:**
  - Roles are fixed: `SUPERADMIN`, `ADMIN`, `STAFF`, `USER`.
  - No user may change their own role or active status.
  - Only Superadmins may reset passwords for other accounts.
- **Database Access:**
  - Always import Prisma client from `src/generated/prisma` or `apps/api/src/lib/db.ts`.
  - Always run `pnpm db:generate` when `schema.prisma` is modified.
  - Creating dependent records (e.g. `Employee` + `User`) must be wrapped in a Prisma `$transaction`.

---

## 3. Code Standards & Discipline

- **TypeScript:** Strict typing is required across all packages. The use of `any` is forbidden.
- **Styling:** Use Tailwind CSS v4 and shadcn/Radix UI primitives. Maintain visual alignment with the EXP navy tokens and Inter typography. Do not introduce legacy Tailwind v3 config files.
- **File Organization:** Adhere to feature-driven folder structures under `src/features/<feature>/` (`components/`, `api/`, `model/`, `hooks/`, `providers/`, `pages/`).
- **Tests:** Backend tests must utilize `@electric-sql/pglite` for offline, in-memory PostgreSQL testing without touching live databases.
