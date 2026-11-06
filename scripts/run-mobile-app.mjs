import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const mobileDir = fileURLToPath(new URL("../apps/mobile/", import.meta.url))
const windows = process.platform === "win32"

function run(command, args, cwd) {
  const result =
    windows && command.endsWith(".bat")
      ? spawnSync("cmd.exe", ["/c", command, ...args], {
          cwd,
          stdio: "inherit",
        })
      : spawnSync(command, args, { cwd, stdio: "inherit" })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function getConnectedDevices() {
  try {
    const res = spawnSync("adb", ["devices"], { encoding: "utf-8" })
    if (res.stdout) {
      return res.stdout
        .split("\n")
        .slice(1)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.endsWith("device"))
    }
  } catch {
    return []
  }
  return []
}

// 1. Verify that an Android emulator or device is connected
const devices = getConnectedDevices()
if (devices.length === 0) {
  console.error("\n❌ No Android emulator or connected device found!")
  console.error(
    "   To run the app, please start your emulator first (e.g. Pixel_8 from Android Studio or run `emulator -avd Pixel_8`),",
  )
  console.error(
    "   or connect an Android device via USB with USB debugging enabled.\n",
  )
  process.exit(1)
}

// 2. Ensure adb reverse port forwarding is active for the local backend
try {
  spawnSync("adb", ["reverse", "tcp:3001", "tcp:3001"])
} catch {
  // Ignore if adb is not ready
}

// 3. Build and install debug APK onto connected device or emulator
console.log("==> Building and installing Nexus Client on Android...")
run(
  windows ? ".\\gradlew.bat" : "./gradlew",
  [":androidApp:installDebug"],
  mobileDir,
)

// 4. Launch MainActivity
console.log("==> Launching Nexus Client App (MainActivity)...")
run("adb", ["shell", "am", "start", "-n", "com.nexus.app/.MainActivity"], root)
