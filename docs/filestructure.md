# File structure

Nexus is a pnpm workspace with a web app, an API, and a Kotlin Multiplatform mobile app. The tree below highlights the source files and directories developers are most likely to edit; generated output and local environment files are omitted.

```text
Nexus/
├── .github/
│   ├── workflows/ci.yml          # Continuous integration
│   └── CI.md                     # CI notes
├── apps/
│   ├── web/                       # React, TypeScript, and Vite app
│   │   ├── public/auth/           # Public authentication images and EXP logo
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── layout/         # Shared portal shell: layout, sidebar, topbar, breadcrumbs, styles
│   │   │   │   └── ui/             # Shared UI primitives
│   │   │   ├── features/
│   │   │   │   ├── auth/           # Login/register pages, API calls, and auth components
│   │   │   │   ├── dashboard/      # Empty dashboard page and account loading
│   │   │   │   └── status/         # Status page and API calls
│   │   │   ├── lib/                # Cross-feature utilities
│   │   │   ├── pages/              # General pages, such as the 404 page
│   │   │   ├── App.tsx             # Browser routes
│   │   │   ├── index.css           # Global styles
│   │   │   └── main.tsx            # React entry point
│   │   ├── test/                   # Web tests
│   │   ├── package.json
│   │   └── vite.config.ts
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
│   └── filestructure.md
├── compose.yaml                   # Development containers
├── compose.prod.yaml              # Production containers
├── Dockerfile
├── package.json                   # Workspace scripts
├── pnpm-workspace.yaml            # Workspace package list
└── README.md                      # Setup and command reference
```

## Where new code belongs

- Put shared web components, including the role-based portal shell, in `apps/web/src/components/`. Keep page-specific code in `apps/web/src/features/<feature>/`.
- Define browser routes in `apps/web/src/App.tsx`. The Dashboard page is under `features/dashboard/`; its sidebar, topbar, and breadcrumbs are reusable components under `components/layout/`.
- Put API routes and domain logic in `apps/api/src/features/<feature>/`. Update `apps/api/prisma/` when the database schema changes.
- Put cross-platform mobile code in `apps/mobile/shared/src/commonMain/` and platform-specific code in the corresponding `androidMain/` or `iosMain/` source set.
