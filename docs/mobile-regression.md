# Mobile regression coverage

The native app lives in `apps/mobile`: shared Kotlin/Compose code, Android host
and device targets, and an iOS application. Browser viewport emulation does not
execute this app. The TypeScript entry point is
`apps/api/src/mobile/regression.spec.ts`; it tests the mobile HTTP contract against
the real Express application and an isolated PGlite database with all migrations.
It never connects to the development or production database.

## Run

From the repository root:

```sh
# Mobile API journey plus all shared Kotlin host tests
pnpm test:mobile

# Also run rendered Compose UI, navigation, and secure-storage tests
pnpm test:mobile --device

# Entire backend suite, including mobile regression, RBAC, and workflows
pnpm --filter @nexus/api test

# detailed console output from apps/mobile:
.\gradlew.bat :shared:testAndroidHostTest :shared:connectedAndroidDeviceTest --info --rerun-tasks
```

The device command requires a booted, authorized Android emulator/device. Gradle
requires the configured JDK and Android SDK; first use may download dependencies.
Failures stop the combined command with a nonzero exit code. No live API server,
ADB reverse tunnel, shared account, or credentials are needed. The native network
tests use Ktor MockEngine; the API tests use real loopback HTTP on an ephemeral port.

Individual native commands, from `apps/mobile`:

```sh
./gradlew :shared:testAndroidHostTest
./gradlew :shared:connectedAndroidDeviceTest
# macOS with Xcode and a compatible simulator only
./gradlew :shared:iosSimulatorArm64Test
```

On Windows use `.\gradlew.bat` instead of `./gradlew`.

## Coverage map

| Area                 | Automated checks                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication       | Registration validation, login validation and errors, duplicate submissions, client role restriction, restore, offline retry, logout, token clearing, refresh, account switching                                                                                                                                                                                                                                                                                    |
| Routing              | Deep-link allowlist and consumption, session boundaries, saved tab isolation, retry preserving drafts, repeated tab selection, protected back-stack removal                                                                                                                                                                                                                                                                                                         |
| Networking           | Bearer injection, refresh behavior, encoded query parameters, cancellation routing, workflow version/action IDs, JSON error messages, HTML failures, malformed success payloads, no retry of rejected writes                                                                                                                                                                                                                                                        |
| Services and booking | Active catalog, packages, catalog pagination, draft service-switch confirmation, specialist selection and rich profile sheet (socials + portfolio), required fields and length limits, draft preservation, hidden pricing, frozen submission and idempotent retry                                                                                                                                                                                                   |
| Request history      | Search debounce and limits, filters, sorting, pagination boundaries, prior results retained on errors, detail retry, stale result cancellation, cancellation locking and idempotency                                                                                                                                                                                                                                                                                |
| Rendered Android UI  | Empty login validation, catalog search/reset, pagination, draft switch guard, Step 4 specialist profile sheet, cancellation confirmation/dismissal, Project Overview tabs (Overview/Deliverables/Notes/Team) and deliverable details, quotation breakdown/approval/activation cards, Xendit sandbox checkout and verified banner, compact profile scrolling and fallback fields, profile back/logout, logout disabled state, landscape tab actions, loading buttons |
| Backend/API          | Native auth payloads, missing/invalid bearer rejection, active service/details/specialists, booking validation and persistence, idempotent replay, ownership isolation, history totals/KPIs, cancellation, refresh/logout isolation                                                                                                                                                                                                                                 |
| Platform storage     | Existing Android secure-storage instrumentation checks; shared session/token tests                                                                                                                                                                                                                                                                                                                                                                                  |

The new native cases are in `MobileRegressionTest.kt`, `MobileUiRegressionTest.kt`,
`BookingRepositoryTest.kt`, `CommunicationTest.kt`, `BillingUiTest.kt`, and `SessionNavigationTest.kt`. Existing auth,
registration, session, booking, deep-link, and repository suites run alongside
them. The API spec also runs as part of the normal API test command.

## Boundaries and verification scope

- Automated Compose UI tests execute in `androidDeviceTest` (`MobileUiRegressionTest.kt`,
  `BillingUiTest.kt`, `SessionNavigationTest.kt`, `SecureSettingsTest.kt`) against
  Ktor `MockEngine` / fake gateways rather than screenshot diffs.
- MockEngine tests and PGlite HTTP tests are separate layers. They do not prove
  device-to-server TLS, Wi-Fi, ADB forwarding, or production connectivity.
- Android execution does not validate iOS Keychain, Swift launch integration, or
  iOS rendering. Run the shared iOS suite and device smoke checks on macOS/Xcode.
- Backend workflow and role-policy coverage remains in the full API suite;
  run it along with mobile regression when changing shared endpoints.
