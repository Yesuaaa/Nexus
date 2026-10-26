# Nexus Backend Architecture (`apps/api`)

## 1. Architectural Overview

The backend uses a modular, responsibility-based layered architecture. Code is organized by feature domain, with strict layer separation to ensure low coupling, testability, and maintainability.

### Layer Dependency Direction

```
HTTP Request
     │
     ▼
[Controller]        (HTTP routing, request parameter parsing, status code mapping)
     │
     ▼
 [Service]          (Business logic, validation orchestration, policy enforcement)
  │      │
  ▼      ▼
[Repo] [Schema]     (Repository: Prisma database operations; Schema: pure input validation)
  │
  ▼
Database (Prisma / PostgreSQL)
```

**Golden Rules:**
1. **Controllers** do not query the database directly. They delegate to Services.
2. **Services** do not deal with Express `request` or `response` objects. They accept plain data inputs and throw domain errors (e.g. `AuthError`, `UsersError`, `EmployeeError`, `DepartmentError`, `ServicesError`).
3. **Repositories** isolate Prisma queries, transactions, row-level locks (`SELECT ... FOR UPDATE`), and `include` projection shapes.
4. **Shared utilities** (`src/lib/`, `src/shared/`) never import from `src/features/`.
5. **Backwards compatibility**: Legacy entrypoints (`routes.ts`, `session.ts`, `permissions.ts`, `password.ts`, `validation.ts`) act as thin re-exports to the canonical files so that external callers remain stable.

---

## 2. Directory Structure

```
apps/api/src/
├── index.ts                              # Port binding & server bootstrap
├── app.ts                                # Express factory, global middleware, error handler
├── app.test.ts                           # Smoke & route availability test
├── employee-integration.test.ts          # End-to-end integration test suite
│
├── lib/
│   ├── db.ts                             # PrismaClient singleton & pg pool configuration
│   └── errors.ts                         # Shared Prisma error code checkers (P2002, P2003, P2025, P2034)
│
├── shared/
│   └── query-helpers.ts                  # Shared query string parsers (parsePage, parseQueryString)
│
├── generated/
│   └── prisma/                           # Generated Prisma client (do not edit manually)
│
└── features/
    ├── auth/                             # Authentication, sessions, credentials & permissions
    │   ├── auth.controller.ts            # Route handlers: /register, /login, /me, /logout, /change-password
    │   ├── auth.service.ts               # Authentication business logic & session issuing
    │   ├── auth.repository.ts            # User credential lookups and Session DB persistence
    │   ├── auth.middleware.ts            # requireAuth, requirePermission, requireRole
    │   ├── auth.permissions.ts           # Permission constants and role-permission mappings
    │   ├── auth.password.ts              # Salted scrypt password hashing & timing-safe verification
    │   ├── auth.schema.ts                # Email normalization & profile validation
    │   ├── auth.limiter.ts               # In-process login rate limiter
    │   ├── auth.test.ts                  # Unit tests: passwords, email, profile validation
    │   └── employee-permissions.test.ts  # Unit tests: permission checks
    │
    ├── users/                            # Account management (Superadmin only)
    │   ├── users.controller.ts           # Route handlers: status, deletion, listing, creation, role change
    │   ├── users.service.ts              # User lifecycle business logic & hierarchy checks
    │   ├── users.repository.ts           # User database queries, updates, and sync triggers
    │   ├── users.dto.ts                  # publicUser() response transformer
    │   ├── users.policy.ts               # Role assignment and status transition authorization rules
    │   ├── role-policy.test.ts           # Unit tests: role policy
    │   └── account-status.test.ts        # Unit tests: account status transitions
    │
    ├── employees/                        # Employee directory & profile management
    │   ├── employees.controller.ts       # Route handlers: directory search, CRUD, staff account linkage
    │   ├── employees.service.ts          # Employee sync, seniority comparison, staff account creation
    │   ├── employees.repository.ts       # Employee queries, include definitions & transactions
    │   ├── employees.schema.ts           # Input parsing and assignment validation
    │   └── validation.test.ts            # Unit tests: employee input validation
    │
    ├── departments/                      # Departments, sub-teams, and member management
    │   ├── departments.controller.ts     # Route handlers: departments CRUD, member assignment, team CRUD
    │   ├── departments.service.ts        # Department management, eligible heads, member assignment
    │   ├── teams.service.ts              # Sub-team creation, assignment, and deletion logic
    │   ├── departments.repository.ts     # Department & team queries, transactional stale-member cleanups
    │   └── departments.schema.ts         # Input validators for department and team payloads
    │
    ├── services/                         # Client service catalog management
    │   ├── services.controller.ts        # Route handlers: active list, full list, CRUD, status toggling
    │   ├── services.service.ts           # Service catalog business logic & department association checks
    │   ├── services.repository.ts        # Service database queries & department relation connections
    │   ├── services.schema.ts            # Service input validation
    │   └── validation.test.ts            # Unit tests: service validation
    │
    └── health/                           # Health monitoring
        └── health.controller.ts          # /api/health and /api/db-check routes
```

---

## 3. Error Handling Pattern

1. **Shared Error Detectors** (`src/lib/errors.ts`):
   - `isUniqueConflict(error)`: Checks for Prisma `P2002` violations.
   - `isForeignKeyViolation(error)`: Checks for Prisma `P2003` violations.
   - `isRecordNotFound(error)`: Checks for Prisma `P2025` violations.
   - `isWriteConflict(error)`: Checks for Prisma `P2034` violations.

2. **Domain Errors**:
   Each feature defines a dedicated domain error class (e.g. `AuthError`, `UsersError`, `EmployeeError`, `DepartmentError`, `ServicesError`) containing an HTTP `status` and `message`.
   Controllers catch instances of their domain error and render the appropriate JSON response:
   ```ts
   if (error instanceof DepartmentError) {
     return response.status(error.status).json({ error: error.message })
   }
   next(error)
   ```
3. **Unhandled Errors**:
   Unhandled or unexpected errors are passed to `next(error)` and caught by the global error handler in `src/app.ts` which logs them and returns a 500 status.

---

## 4. How to Add a New Feature

When adding a new feature domain (e.g. `reports`):
1. **Create directory**: `src/features/<feature-name>/`.
2. **Create Schema** (`<feature-name>.schema.ts`): Define TypeScript types and pure validation functions.
3. **Create Repository** (`<feature-name>.repository.ts`): Wrap all Prisma queries and includes.
4. **Create Service** (`<feature-name>.service.ts`): Implement business logic, authorization rules, and throw custom domain errors.
5. **Create Controller** (`<feature-name>.controller.ts`): Create an Express router, apply auth middleware (`requireAuth`, `requirePermission`), map HTTP request bodies/params to service calls, and handle domain errors.
6. **Mount in `src/app.ts`**: Attach the controller router to `app.use("/api/<feature-name>", ...)`.
7. **Add Tests**: Create corresponding unit and integration tests.
