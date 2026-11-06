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

// 1. Ensure adb reverse port forwarding is active for the local backend
try {
  spawnSync("adb", ["reverse", "tcp:3001", "tcp:3001"])
} catch {
  // Ignore if adb is not ready yet or device is starting
}

// 2. Build and install debug APK onto connected device or emulator
console.log("==> Building and installing Nexus Client on Android...")
run(
  windows ? ".\\gradlew.bat" : "./gradlew",
  [":androidApp:installDebug"],
  mobileDir,
)

// 3. Launch MainActivity
console.log("==> Launching Nexus Client App (MainActivity)...")
run("adb", ["shell", "am", "start", "-n", "com.nexus.app/.MainActivity"], root)
