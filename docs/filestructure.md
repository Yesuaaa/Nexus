# File structure

Nexus is a pnpm workspace with a web app, an API, and a Kotlin Multiplatform mobile app. The tree below highlights the source files and directories developers are most likely to edit; generated output and local environment files are omitted.

```text
Nexus/
├── .github/
│   ├── workflows/ci.yml          # Continuous integration
│   └── CI.md                     # CI notes
├── apps/
│   ├── web/                       # Next.js App Router, TypeScript, and Tailwind CSS
│   │   ├── public/auth/           # Public authentication images and EXP logo
│   │   ├── src/
│   │   │   ├── app/                # Server Component route entry points
│   │   │   │   ├── (auth)/         # /login and /register
│   │   │   │   ├── (portal)/       # Shared authenticated layout
│   │   │   │   │   ├── accounts/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   └── departments/
│   │   │   │   ├── layout.tsx      # Root document, global styles, auth provider
│   │   │   │   ├── not-found.tsx   # 404 page
│   │   │   │   └── page.tsx        # Session-aware home redirect
│   │   │   ├── components/
│   │   │   │   ├── layout/         # Shared portal shell: layout, sidebar, topbar, breadcrumbs, styles
│   │   │   │   └── ui/             # Shared UI primitives
│   │   │   ├── features/
│   │   │   │   ├── accounts/       # Admin and Superadmin account management
│   │   │   │   ├── auth/           # Login/register pages, account loading, and auth components
│   │   │   │   ├── dashboard/      # Empty dashboard page
│   │   │   │   ├── departments/    # Department and membership management
│   │   │   │   ├── not-found/      # Shared 404 page
│   │   │   │   └── status/         # Status page and API calls
│   │   │   ├── lib/                # Cross-feature utilities
│   │   │   └── index.css           # Global styles and Tailwind CSS v4
│   │   ├── test/                   # Web tests
│   │   ├── e2e/                    # Browser migration regression checks
│   │   ├── scripts/                # Prepare and start the standalone server
│   │   ├── package.json
│   │   ├── next.config.ts          # Standalone output and Express API rewrite
│   │   └── postcss.config.mjs      # Tailwind CSS PostCSS integration
│   ├── api/                       # Express, TypeScript, and Prisma API
│   │   ├── prisma/
│   │   │   ├── migrations/         # Database migrations
│   │   │   ├── schema.prisma       # Database schema
│   │   │   └── seed.ts             # Database seed entry point
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── auth/           # Authentication routes and session handling
│   │   │   │   ├── health/         # Health checks
│   │   │   │   └── users/          # User routes and role rules
│   │   │   ├── lib/db.ts           # Prisma database access
│   │   │   ├── app.ts              # Express app and route registration
│   │   │   └── index.ts            # Server entry point
│   │   └── package.json
│   └── mobile/                    # Kotlin and Compose Multiplatform app
│       ├── androidApp/            # Android entry point and resources
│       ├── iosApp/                # iOS Xcode project
│       ├── shared/src/            # Shared code and platform-specific source sets
│       ├── build.gradle.kts
│       └── settings.gradle.kts
├── certs/                         # Bundled database CA certificate
├── docs/                          # Project documentation
│   ├── filestructure.md
│   └── rbac.md                     # Fixed roles and permission matrix
├── compose.yaml                   # Development containers
├── compose.prod.yaml              # Production containers
├── Dockerfile
├── package.json                   # Workspace scripts
├── pnpm-workspace.yaml            # Workspace package list
└── README.md                      # Setup and command reference
```

## Where new code belongs

- Put shared web components, including the role-based portal shell, in `apps/web/src/components/`. Keep page-specific code in `apps/web/src/features/<feature>/`.
- Define routes and nested layouts in `apps/web/src/app/`. Keep route entry points as Server Components and mark interactive feature entry points with `"use client"`. Pass Server Component content through layout children instead of importing it into Client Components.
- Keep role-specific layout extensions in `components/layout/role-layout.tsx`. Superadmin, Admin, Staff, and Client reuse the shared portal shell; Client corresponds to the API's `USER` role. Account context replaces React Router outlet context without changing the API or role rules.
- The root auth provider keeps the login animation and toasts mounted between routes. Protected features read the current account through `features/auth/providers/account-context.tsx`; bearer tokens stay in browser session storage, and Express enforces access.
- Put API routes and domain logic in `apps/api/src/features/<feature>/`. Update `apps/api/prisma/` when the database schema changes.
- Put cross-platform mobile code in `apps/mobile/shared/src/commonMain/` and platform-specific code in the corresponding `androidMain/` or `iosMain/` source set.

## Frontend feature responsibilities

Keep each business feature under `apps/web/src/features/<feature>/` and group its files by the responsibility they serve. Create a folder when the feature has code that belongs there; small features do not need every folder.

| Folder        | Responsibility                                                    | Existing examples                           |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `pages/`      | Feature screen composition consumed by App Router entry points    | Account management, departments, dashboard  |
| `components/` | Feature UI, forms, dialogs, drawers, and presentation layouts     | Auth form, account dropdown, member drawer  |
| `api/`        | Endpoint calls, request/response contracts, and API error mapping | Auth API, accounts API, departments API     |
| `hooks/`      | React lifecycle and reusable interaction logic                    | Account loading, login transition           |
| `providers/`  | Contexts and providers that share feature state                   | Account context, auth transition provider   |
| `model/`      | Domain types, validation, and permission rules                    | Auth types, form schema, permissions        |
| `content/`    | Localized strings and presentation copy                           | English and Filipino auth copy              |
| `styles/`     | Feature CSS and shared style constants                            | Department CSS, auth styles, account styles |

For example:

```text
features/
├── accounts/
│   ├── api/accounts-api.ts
│   ├── components/
│   │   ├── account-dropdown.tsx
│   │   └── create-account-dialog.tsx
│   ├── pages/account-management-page.tsx
│   └── styles/account-styles.ts
├── auth/
│   ├── api/
│   │   ├── auth-api.ts
│   │   └── auth-errors.ts
│   ├── components/
│   │   ├── auth-form.tsx
│   │   ├── auth-fields.tsx
│   │   ├── auth-header.tsx
│   │   ├── auth-layout.tsx
│   │   ├── auth-loader.tsx
│   │   ├── auth-visuals.tsx
│   │   └── home-redirect.tsx
│   ├── content/auth-copy.ts
│   ├── hooks/
│   │   ├── use-account.ts
│   │   └── use-login-transition.ts
│   ├── model/
│   │   ├── permissions.ts
│   │   ├── schema.ts
│   │   └── types.ts
│   ├── pages/auth-page.tsx
│   ├── providers/
│   │   ├── account-context.tsx
│   │   └── auth-provider.tsx
│   └── styles/auth-styles.ts
├── departments/
│   ├── api/departments-api.ts
│   ├── components/
│   │   ├── create-edit-department-dialog.tsx
│   │   └── manage-members-drawer.tsx
│   ├── pages/department-management-page.tsx
│   └── styles/departments.css
├── dashboard/pages/dashboard-page.tsx
├── not-found/pages/not-found-page.tsx
└── status/
    ├── api/status-api.ts
    └── pages/status-page.tsx
```

Keep Next.js routing conventions in `src/app/`; `pages/` inside a feature is ordinary application code, not a second router. Route files import their feature screen directly. Keep Server/Client Component boundaries explicit when moving components.

Use relative imports within a feature and `@/` imports across features or into shared code. Tests executed directly by Node use relative imports with explicit `.ts` extensions. Prefer direct imports instead of feature-wide barrel exports that can mix server and client modules.

Name UI and API files for their feature or task, such as `auth-form.tsx` and `departments-api.ts`. Keep small related types beside their API functions until they need a separate domain model. Extract hooks only when needed; moving files does not require rewriting working screens.

Keep reusable primitives in `src/components/ui/`, shared portal layouts in `src/components/layout/`, and cross-feature utilities in `src/lib/`. A component belongs in shared code when multiple features use it, not merely because it might become reusable. The backend and mobile app retain their own structures.
