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
emulator -avd Pixel_8
```

### 2. I-install and Run yung App

Once na running na yung emulator, navigate ka sa `apps/mobile` directory:

```powershell
cd apps/mobile
```

Then run:

```powershell
.\gradlew :androidApp:installDebug
```

This will build the debug version of the app and install it sa running Android emulator.

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

Here's a quick overview ng mobile app structure natin para mas madali malaman kung saan ilalagay yung code.

```text
apps/mobile/
├── androidApp/          # Android entry point and Android-specific manifest/resources
├── iosApp/              # iOS entry point (Xcode project)
├── shared/              # ⭐️ DITO TAYO MOSTLY MAGKO-CODE
│   └── src/
│       ├── commonMain/  # ⭐️ Main shared codebase
│       │                # - Compose Multiplatform UI Screens & Components
│       │                # - Navigation & ViewModels
│       │                # - API Calls (Ktor Client) & State Management
│       ├── androidMain/ # Android-specific APIs (e.g. notifications, context)
│       └── iosMain/     # iOS-specific bridges/configs
├── build.gradle.kts
└── settings.gradle.kts
```

### Quick Explanation

- **`androidApp/`** – Dito yung Android-specific entry point and configurations.
- **`iosApp/`** – Dito naman yung iOS entry point na managed through Xcode.
- **`shared/`** – Ito yung main workspace natin for shared code. Most of our development will happen here.
- **`commonMain/`** – Dito natin ilalagay yung shared UI, navigation, ViewModels, API integration, and state management.
- **`androidMain/`** – For Android-specific implementations.
- **`iosMain/`** – For iOS-specific implementations and configurations.

Ang idea is, instead na gumawa tayo ng separate implementation for Android and iOS, we can share most of our code through `commonMain`.

---

## 🌐 Connecting to the Backend API (`apps/api`)

Kapag magco-connect tayo sa local Express backend natin running at:

`http://localhost:3001`

Take note na magkaiba yung URL na gagamitin depending sa environment na ginagamit mo.

- **Android Emulator:** Use `http://10.0.2.2:3001`

  Yung `10.0.2.2` is basically an alias ng Android emulator para ma-access yung `localhost` ng host machine mo.

- **iOS Simulator:** Use `http://localhost:3001`

- **Physical Device:** Use the local IP address ng PC mo, for example:

  `http://192.168.x.x:3001`

Make sure na running yung backend API and accessible siya sa device or emulator na ginagamit mo.

---

## 🧪 Testing Commands

Para ma-run yung shared unit tests natin, execute:

```powershell
.\gradlew :shared:testDebugUnitTest
```

This will run the debug unit tests under the shared module.

If may errors, check muna yung Gradle configuration, SDK setup, and kung properly configured yung environment mo.
