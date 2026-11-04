# Nexus Mobile (Kotlin Multiplatform / Compose Multiplatform)

Cross-platform mobile application for **Nexus**, built using **Kotlin Multiplatform (KMP)** and **Compose Multiplatform (CMP)**. The goal is to have one shared codebase na pwedeng gamitin for both **Android** and **iOS**.

---

## 🛠️ Requirements & Prerequisites

Bago natin i-run yung mobile app, make sure na naka-install muna sa machine mo yung mga following:

1. **JDK 17 or JDK 21+ (Java Development Kit)**
   - Needed para sa Gradle and Kotlin development.
   - To check kung naka-install na, run:
     ```bash
     java -version
     ```

2. **Android SDK / Android Studio**
   - Kailangan may naka-install na Android SDK and at least one Android Virtual Device (AVD) or emulator, like Pixel 8.
   - Make sure na properly configured yung SDK path mo, either through PATH or `local.properties`.

3. **(Optional for iOS) macOS + Xcode**
   - If magco-compile or magte-test ka sa iOS Simulator or physical iPhone, kailangan mo ng Mac na may Xcode.
   - **Note for Windows users:** Pwedeng-pwede kang mag-develop and mag-test sa Android emulator using Windows. Yung shared code natin sa `shared/src/commonMain` ay intended to work on both Android and iOS. Kailangan lang i-compile sa Mac or CI environment para ma-build yung iOS version.

---

## 🚀 Setup Steps Pagka-Clone ng Repo

### Step 1: I-configure yung `local.properties`

Yung `local.properties` file, hindi natin sinasama sa Git since unique yung SDK path ng bawat machine.

So after cloning the repository, kailangan mong gumawa ng sariling `local.properties` file sa loob ng `apps/mobile/`.

**Windows:**

```properties
sdk.dir=C\\:\\Users\\<YOUR_WINDOWS_USERNAME>\\AppData\\Local\\Android\\Sdk
```

Example:

```properties
sdk.dir=C\\:\\Users\\Wency\\AppData\\Local\\Android\\Sdk
```

**macOS / Linux:**

```properties
sdk.dir=/Users/<YOUR_USERNAME>/Library/Android/sdk
```

Make sure na tama yung path based sa actual location ng Android SDK mo.

---

## 📱 Paano Patakbuhin yung App

### 1. Buksan yung Android Emulator

Open **Android Studio → Device Manager**, then click yung **Play (Launch)** button sa emulator na gagamitin mo.

Pwede rin naman i-launch through terminal:

```powershell
emulator -avd <Pangalan_ng_AVD_mo>
```

Example:

```powershell
Start-Process emulator -ArgumentList "-avd", "Pixel_8"
```

Wait for the Android home screen before installing. `adb devices` must show the
emulator with status `device`. You can also check readiness with
`adb -e shell getprop sys.boot_completed`; continue when it prints `1`.

### Start the backend (separate PowerShell terminal)

From the repository root, with the existing API environment configured:

```powershell
$env:NODE_ENV = "development"
pnpm dev:mobile
```

Keep this terminal running. This runs `adb reverse tcp:3001 tcp:3001` and starts
the API in watch mode. Put Android SDK `platform-tools` on PATH first (Windows:
`%LOCALAPPDATA%\Android\Sdk\platform-tools`). The app defaults to
`http://localhost:3001`, which reaches the computer through ADB reverse.
The web server is optional for mobile authentication.

### 2. I-install and Run yung App

Once na running na yung emulator, navigate ka sa `apps/mobile` directory:

```powershell
cd apps/mobile
```

Then run:

```powershell
.\gradlew.bat :androidApp:installDebug
adb -e shell am start -n com.nexus.app/.MainActivity
```

This will build the debug version of the app and install it sa running Android emulator.

`No connected devices` means the emulator is not running or ADB has not connected
yet. If installation fails while Android is booting, wait for boot completion and
retry the same install command. You do not need to open Android Studio to start
an already configured emulator.

**Note:** If macOS or Linux yung gamit mo, use:

```bash
./gradlew :androidApp:installDebug
```

### 3. iOS (For Mac Users)

If may access ka sa Mac and Xcode, ganito naman yung process:

1. Open yung `apps/mobile/iosApp` folder sa Xcode.
2. Piliin yung target iPhone Simulator or physical device.
3. Click **Run** or press `Cmd + R`.

---

## 📁 Project Structure (Saan Tayo Magko-Code?)

Para maging malinis at aligned sa ating monorepo (`apps/web` at `apps/api`), naka-organize ang code natin sa **feature-driven** architecture:

```text
apps/mobile/shared/src/commonMain/kotlin/com/nexus/app/
│
├── core/                                         # Shared utilities, tokens, at UI primitives
│   ├── components/                               # Shared UI atoms (NexusTopAppBar, NexusBottomBar, NexusButton, NexusTextField, StatusBadge, KpiCard)
│   ├── network/                                  # ApiEndpoints (10.0.2.2:3001) & HttpClientFactory (Ktor)
│   ├── storage/                                  # TokenStorage & SettingsTokenStorage (JWT)
│   ├── theme/                                    # Color (EXP Navy #1E3A78), Theme, Type
│   └── validation/                               # Regex para sa PH phone (+63/09), email, password
│
├── features/                                     # ⭐️ DITO MAGCO-CODE NG FEATURES (Katugma ng web/api)
│   ├── auth/                                     # Login, Register, AuthViewModel, AuthRepository
│   │   └── screens/                              # LoginScreen.kt, RegisterScreen.kt
│   ├── dashboard/                                # Portal welcome, quick overview
│   │   └── screens/                              # DashboardScreen.kt
│   ├── services/                                 # Catalog, Packages, Booking Wizard (Steps 1-4)
│   │   └── screens/                              # ServicesScreen.kt
│   └── booked_requests/                          # KPI cards, Request list, Details
│       └── screens/                              # BookedRequestsScreen.kt
│
├── navigation/                                   # Navigation shell
│   ├── Screen.kt                                 # Route definitions & BottomTab enum
│   └── AppNavHost.kt                             # Scaffold host at tab router
│
└── App.kt                                        # Root Compose Multiplatform App
```

### 📦 Installed Dependencies

* **Networking:** Ktor Client 3.1.1 (Content Negotiation, JSON Serialization, Logging, Bearer Auth)
* **Serialization:** Kotlinx Serialization JSON 1.8.0
* **Date & Time:** Kotlinx DateTime 0.6.2
* **Navigation:** JetBrains Navigation-Compose 2.8.0-alpha10
* **Dependency Injection:** Koin 4.0.2 (`koin-core`, `koin-compose`, `koin-compose-viewmodel`)
* **Local Storage:** Multiplatform Settings 1.3.0
* **Image Loading:** Coil 3.1.0 (`coil-compose`, `coil-network-ktor3`)
* **Icons:** Compose Material Icons Extended 1.7.3

---

## 🌐 Connecting to the Backend API (`apps/api`)

Kapag magco-connect tayo sa local Express backend natin running at:

`http://localhost:3001`

Take note na magkaiba yung URL na gagamitin depending sa environment na ginagamit mo.

### Android physical device over USB

1. Enable Developer options and USB debugging, connect a data-capable USB cable,
   and accept the computer authorization prompt.
2. Run `adb devices`; the phone must show `device`, not `unauthorized` or `offline`.
3. Run `pnpm dev:mobile` from the repository root. If multiple devices are connected,
   select one with `$env:ANDROID_SERIAL = "<serial>"` in PowerShell or
   `export ANDROID_SERIAL=<serial>` on macOS/Linux before running the command.
4. Keep `DEFAULT_BASE_URL` in
   `shared/src/commonMain/kotlin/com/nexus/app/core/network/ApiEndpoints.kt` set to
   `http://localhost:3001` (or `http://127.0.0.1:3001`). Rebuild/reinstall after edits.
5. Check `adb reverse --list` for `tcp:3001 tcp:3001`. After reconnecting or rebooting,
   stop the previous backend and rerun `pnpm dev:mobile` to restore forwarding.

The script stops if ADB fails. Fix PATH, authorization, or device selection and
retry. API environment/database configuration is still required. Keep the API on
port 3001 for this mapping. The command does not install or launch the mobile app.

### Physical device over Wi-Fi

- Connect both devices to the same Wi-Fi network without client isolation.
- Change `DEFAULT_BASE_URL` in `ApiEndpoints.kt` to the computer's LAN IPv4 address,
  e.g. `http://192.168.1.20:3001`. Find it using `ipconfig` on Windows.
- For Android local HTTP development, add that exact IP as a `<domain>` inside the
  existing domain-config in `androidApp/src/main/res/xml/network_security_config.xml`.
  Rebuild/reinstall, and remove the machine-specific entry afterward.
- Start the backend with `pnpm --filter @nexus/api dev` when ADB is unavailable.
  The API binds to `0.0.0.0`. Allow inbound TCP 3001 on the private-network firewall
  and check VPN routing if necessary.
- Open `http://<computer-LAN-IP>:3001/api/health` on the phone to verify reachability.
  Phone localhost requires ADB reverse; it does not refer to your computer over Wi-Fi.

### Emulator and connection diagnostics

Android emulators can use localhost with `pnpm dev:mobile`, or `http://10.0.2.2:3001`
with the backend started directly. The `10.0.2.2` alias is emulator-only. iOS
simulators use `http://localhost:3001` and start the backend directly; ADB is Android-only.

Connection failure toasts show the configured URL, for example:
"Cannot reach API at http://10.0.2.2:3001. Ensure backend is running via `pnpm dev:mobile`."
Check the backend terminal and `http://localhost:3001/api/health` on the computer.
To smoke-test the toast, stop the API and submit a validly formatted login or
registration form.

---

## 🧪 Testing Commands

Para ma-run yung shared unit tests natin, execute:

```powershell
.\gradlew.bat :shared:testAndroidHostTest
.\gradlew.bat :androidApp:assembleDebug
```

This will run the debug unit tests under the shared module.

If may errors, check muna yung Gradle configuration, SDK setup, and kung properly configured yung environment mo.

## Authentication contract and smoke test

For automated API, native networking, routing, and rendered UI coverage, see
[Mobile regression coverage](../../docs/mobile-regression.md). Run
`pnpm test:mobile --device` from the repository root with an Android emulator
running; omit `--device` for API and shared host tests only.

Registration and login return `token`, `refreshToken`, `expiresIn`, and `user`.
The account status field is `user.isActive`. Use these existing web/API names;
there are no `accessToken` or `active` aliases.

Registration requires a full name (2–100 characters), a valid `.com` or `.ph`
email, an 11-digit contact number starting with `08` or `09`, and a password of
at least 12 characters (at most 1,024 UTF-8 bytes), including uppercase, lowercase,
a number, and a special character. Email is normalized by the backend. Accounts
always register as active clients (`USER`). Passwords use the existing scrypt
hashing implementation.

Use the team-managed development client account, with credentials shared
privately. The seed script does not create or reset a fixed client credential.
Do not put shared credentials in source code, issue descriptions, or logs.

For ticket #149, verify these flows against the local API:

1. Register a fresh development-only account and confirm the dashboard appears.
2. Open the profile icon next to Notifications; verify the account details.
3. Close and reopen the app; a valid saved session is checked with `/api/auth/me`.
4. Select **Profile → Log out**; verify login appears and restarting stays signed out.
5. Register again with the same email; verify the duplicate-email message.
6. Sign in with a wrong password; verify the invalid-credentials message.
7. Sign in correctly after logout; verify the new account/session is used.

The access token lasts 15 minutes. Automatic refresh remains a follow-up task;
reopening with an expired token requires signing in again. Logout calls the API
to revoke the current session and clears both local tokens. If the API cannot be
reached, local logout still completes and login shows a notice that server
sign-out could not be confirmed.

In development, registration allows 50 requests/minute, login 300 requests/minute,
and failed passwords 50 attempts per IP/email in 15 minutes. Production remains
10, 60, and 10 respectively; refresh stays at 120 requests/minute in all modes.

## Responsive screens and feedback

The mobile layout uses the available logical screen width/height rather than a
fixed device resolution. Auth forms are capped at 480dp and scroll when space is
limited or the keyboard opens. The header shows the language label; auth navigation
uses the account-switch links beneath the forms. Fields, password help, submit button, and the alternate
sign-in/register link form one compact scrolling group, matching the web flow.
Portal content is bounded on tablets, service
cards use an adaptive grid, and request counters use two columns below 600dp and
four on wider screens. Text continues to respect the device font scale; buttons
retain a minimum 48dp touch target.

Native top-center toasts match the web app's EXP navy styling and use a spring
entrance, compact-pill expansion, and collapse/slide/fade exit. They sit below the
header so its content remains visible. They report sign-in,
registration, logout, and request failures, survive navigation, can be dismissed,
and announce their text to accessibility services. Local validation and
registration input/duplicate-email errors stay inline, matching the web flow.
