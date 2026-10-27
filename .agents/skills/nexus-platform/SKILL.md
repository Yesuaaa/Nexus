---
name: nexus-platform
description: Comprehensive architecture, tech stack, data models, RBAC, domain rules, runbooks, and coding guidelines for the Nexus capstone platform. Use whenever developing, scaffolding, or refactoring features across apps/web, apps/api, or apps/mobile.
---

# Project Context: Nexus

## 1. Business Overview

- **Project:** Nexus
- **Client:** EXP Digital Solutions
- **Description:** A Unified Business Operations and Service Management Platform. It is a centralized, role-based application designed to integrate and automate core business operations including client booking, employee administration, project tracking, payroll processing, and operational analytics.
- **Goal:** Eliminate data fragmentation and manual administrative overhead by establishing a single, coherent technological ecosystem across Web, Mobile, and API.

---

## 2. Core Modules & Domain Logic

### Account & Access Management (RBAC)

Fixed role delineation among `SUPERADMIN`, `ADMIN`, `STAFF`, and `USER` (Client):

- **`SUPERADMIN`**: Full system access, password resets for others (`accounts:reset-password`), role assignment across all roles, privileged account status changes (`accounts:status-privileged`).
- **`ADMIN`**: User and Staff administration, department & employee management, service management, basic account status changes (`accounts:status-basic`). Cannot modify Admin/Superadmin accounts or reset passwords.
- **`STAFF`**: Internal operational workflows, assigned department/team tasks.
- **`USER`**: Client portal access (service discovery, booking requests, profile).
- **Strict Invariants:**
  - No account may change its own role or active status.
  - Role changes and deactivations take effect immediately on subsequent requests.

### Human Resources & Employee Management

- **`User` vs. `Employee` Separation:**
  - `User`: Handles authentication, credentials, role, and active session management.
  - `Employee`: Handles HR records (`employeeId`, `fullName`, `position`, `employmentType`, `status`, `startDate`, department, team).
  - _Atomic Provisioning:_ Creating an employee simultaneously provisions a Staff `User` account in a single database transaction.
- **Enums:**
  - `EmploymentType`: `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`
  - `EmployeeStatus`: `ACTIVE`, `INACTIVE`, `ON_LEAVE`
- **Department Head Temporary Handoff:**
  - When an Admin changes a department head's status to `INACTIVE` or `ON_LEAVE`, a temporary head handoff is recorded. When they return to `ACTIVE`, the handoff is restored and cleared.
- **Login Account Retirement (Soft Delete):**
  - Uses `isActive: false` and `accountDeletedAt` timestamp to retire login credentials while preserving historical HR assignments.

### Service & Booking Catalog

- Services can be categorized and assigned to multiple departments (`ServiceDepartments` relation).
- Public/client endpoint `/api/services/available` returns active services for booking requests.
- Admin/Superadmin management endpoints require `services:read` and `services:manage`.

### Upcoming Domain Modules (Roadmap)

- **Project & Task Management:** Converting approved client bookings into projects with assignable deliverables and milestones.
- **Payroll & Attendance Management:** Clock-in/timekeeping tracking, hourly/salary rate calculations, and internal payroll records.
- **Analytics & Reporting:** Management dashboard summarizing operational metrics, department loads, and service completion.
- **Mobile Companion App:** KMP app providing mobile login, attendance logging, task progress updates, and payroll viewing.

---

## 3. Database Models & Schema Reference (`apps/api/prisma/schema.prisma`)

- **`User`**: `id`, `email`, `fullName`, `contactNumber`, `position`, `passwordHash`, `role`, `isActive`, `accountDeletedAt`, `departmentId`, `teamId`, relations to `Department`, `Team`, `Employee`, `Session`, `AuditLog`.
- **`Employee`**: `id`, `employeeId` (unique), `fullName`, `email`, `contactNumber`, `position`, `employmentType`, `status`, `startDate`, `departmentId`, `teamId`, `userId` (unique link to `User`).
- **`Department`**: `id`, `name` (unique), `code` (unique), `description`, `headId`, `temporaryHeadOriginalId`, `temporaryHeadAssignedId`, `members`, `employees`, `teams`, `services`.
- **`Team`**: `id`, `name`, `description`, `departmentId`, `leadId`, `members`, `employees`. Unique constraint on `[departmentId, name]`.
- **`Service`**: `id`, `name` (unique), `description`, `isActive`, `departments`.
- **`Session`**: `id`, `tokenHash` (unique), `userId`, `expiresAt`, `createdAt`.
- **`AuditLog`**: `id`, `action` (`PASSWORD_RESET`), `actorId`, `targetUserId`, `createdAt`.

---

## 4. Tech Stack & Environment Reference

### Monorepo Infrastructure

- **Package Manager:** `pnpm@12.7.0` (pnpm workspaces)
- **Runtime:** Node.js `22.12+` or `24+`
- **Docker:** `compose.yaml` (dev with volume mounts), `compose.prod.yaml` (standalone prod), `Dockerfile`
- **Lint & Format:** ESLint 10 (flat config with `typescript-eslint v8`), Prettier 3

### Web Frontend (`apps/web`)

- **Framework:** Next.js 16 (`^16.4.3`) App Router
- **React:** React 19 (`^19.0.0`) + React DOM 19, TypeScript `~5.9.0`
- **Styling:** Tailwind CSS v4 (`^4.0.0`, `@tailwindcss/postcss`), shadcn/ui (Radix UI primitives), `clsx`, `tailwind-merge`, `cva`
- **Animation & Notifications:** GSAP `^3.15.0` (EXP loader & page transitions), Framer Motion `12.43.0`, Lucide React, Sileo toasts
- **Testing:** Playwright (`^1.64.1`) for E2E tests on port 5273 (mocked API)
- **Networking:** Next.js proxies `/api/*` requests to Express on `http://localhost:3001` via `next.config.ts`. Browser makes same-origin calls (`/api/...`).
- **Port:** `http://localhost:5173`

### Backend API (`apps/api`)

- **Framework:** Express 5 (`^5.0.0`) with `tsx` watch mode
- **Database & ORM:** PostgreSQL on Supabase, Prisma 7 (`@prisma/adapter-pg`, `pg`). Client generated to `src/generated/prisma`.
- **Testing:** Native Node runner (`node --test`) + PGlite (`@electric-sql/pglite`) for in-memory PostgreSQL simulation without live DB calls.
- **Port:** `http://localhost:3001`

### Mobile Companion (`apps/mobile`)

- **Framework:** Kotlin Multiplatform (KMP) & Compose Multiplatform (CMP 1.12)
- **Language:** Kotlin 2.4 (`2.4.20`), Java 17/21
- **Platforms:** Android (AGP 9.1.1, SDK 37, Min SDK 24) and iOS (Native compilation via Kotlin/Native static framework)
- **UI & State:** Compose Material 3 (`1.12.0-alpha03`), AndroidX Lifecycle ViewModel Compose

---

## 5. Folder & Responsibility Conventions

### Web (`apps/web/src/features/<feature>/`)

When creating or editing frontend features, group files strictly by responsibility:

- `pages/`: Screen composition consumed by App Router page entry points.
- `components/`: UI components, forms, dialogs, sheets, and drawers.
- `api/`: Fetch calls, endpoint DTOs, and error mapping.
- `hooks/`: Custom React hooks, state logic, and queries.
- `providers/`: Context providers (e.g., `account-context.tsx`).
- `model/`: TypeScript interfaces, Zod/form validation schemas, permission rules.
- `content/`: Static text copy and localized strings.
- `styles/`: Feature-specific styles or layout constants.

_Server vs. Client Boundary:_

- Routes in `src/app/` are Server Components.
- Interactive screens, forms, and hooks must include `"use client"` at the top.

### API (`apps/api/src/features/<feature>/`)

When adding backend features, maintain strict separation of concerns:

- `routes.ts`: Express route definitions with RBAC authorization middlewares.
- `validation.ts`: Request body, parameter, and query validation.
- `controller.ts` or `handlers.ts`: HTTP request/response orchestration.
- `service.ts`: Business logic and Prisma database access (`lib/db.ts`).
- `*.test.ts`: Integration tests using PGlite in-memory database.

---

## 6. Domain Data & Validation Rules

- **Contact Numbers:** Philippine mobile numbers strictly: 11 digits starting with `08` or `09` (`^(08|09)\d{9}$`).
- **Emails:** Required, valid format ending in `.com` or `.ph`.
- **Passwords:** Minimum 12 characters, max 1024 bytes. Must include uppercase, lowercase, numeric, and special characters. Hashed with Node scrypt.
- **Employee ID:** 2 to 40 characters, letters, numbers, hyphens, and underscores only (`^[a-zA-Z0-9_-]{2,40}$`).
- **Full Name:** 2 to 100 characters supporting Unicode letters, spaces, hyphens, apostrophes, and periods.
- **Departments & Teams:** Every team must belong to a valid department. Employee forms require an explicit team selection or `No team`.

---

## 7. Developer Runbooks & Essential Commands

| Action                    | Command                                     | Notes                                             |
| :------------------------ | :------------------------------------------ | :------------------------------------------------ |
| **Run all dev servers**   | `pnpm dev`                                  | Starts web (5173) and API (3001)                  |
| **Build all packages**    | `pnpm build`                                | Production builds                                 |
| **Run typechecks**        | `pnpm typecheck`                            | Checks TS types across workspace                  |
| **Run linter**            | `pnpm lint`                                 | ESLint 10 checks                                  |
| **Seed Superadmin**       | `pnpm --filter @nexus/api db:seed`          | Requires `BOOTSTRAP_EMAIL` & `BOOTSTRAP_PASSWORD` |
| **Seed Services**         | `pnpm --filter @nexus/api db:seed:services` | Seeds initial service catalog                     |
| **Prisma Migrate**        | `pnpm db:migrate --name <name>`             | Creates and applies new migration                 |
| **Prisma Studio**         | `pnpm db:studio`                            | Opens database browser GUI                        |
| **Run API Tests**         | `pnpm --filter @nexus/api test`             | Runs offline PGlite tests                         |
| **Run Web Unit Tests**    | `pnpm --filter @nexus/web test`             | Runs frontend unit/validation checks              |
| **Run E2E Browser Tests** | `pnpm --filter @nexus/web test:e2e`         | Runs Playwright tests on port 5273                |

---

## 8. AI Code Generation Guardrails (Do's and Don'ts)

### DO:

1. **Always use `sessionStorage`** for Bearer token storage on the frontend.
2. **Import Prisma Client** from `src/generated/prisma` or use `apps/api/src/lib/db.ts`.
3. **Use PGlite** for writing automated backend tests to ensure offline reliability.
4. **Enforce RBAC** on both backend route middlewares (`requirePermission(...)`) and frontend navigation/action guards.
5. **Use Tailwind CSS v4 & shadcn/ui** styling with existing EXP design tokens (navy action accents, clean borders, Inter font).
6. **Trigger Sileo toasts** for feedback after asynchronous API mutations.
7. **Ensure atomicity** with Prisma `$transaction` when creating or modifying dependent records (e.g. Employee + User).

### DO NOT:

1. **DO NOT** use `localStorage` or introduce cookie-based authentication.
2. **DO NOT** use `any` in TypeScript code — supply strict types and DTO interfaces.
3. **DO NOT** place feature-specific business components inside `src/components/ui/` (keep `ui/` pure primitives).
4. **DO NOT** bypass the Next.js API proxy with hardcoded URLs when fetching from the web client; use `/api/...`.
5. **DO NOT** allow users to modify their own role or active status.
6. **DO NOT** mix Tailwind v3 config patterns (e.g. `tailwind.config.js`) with Tailwind v4 CSS imports.
