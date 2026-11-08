import { spawn, spawnSync } from "node:child_process"

function checkDockerInstalled() {
  try {
    const res = spawnSync("docker", ["--version"], { encoding: "utf-8" })
    if (res.status !== 0) {
      console.error("\n❌ Docker CLI is not installed or not found on PATH.")
      console.error(
        "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop\n",
      )
      process.exit(1)
    }
  } catch {
    console.error("\n❌ Docker CLI is not installed or not found on PATH.")
    console.error(
      "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop\n",
    )
    process.exit(1)
  }
}

function checkDockerDaemonRunning() {
  try {
    const res = spawnSync("docker", ["info"], { stdio: "ignore" })
    if (res.status !== 0) {
      console.error("\n❌ Docker Desktop is not running!")
      console.error(
        "   Please start Docker Desktop on your computer and wait for the engine to initialize,",
      )
      console.error("   then run this command again.\n")
      process.exit(1)
    }
  } catch (error) {
    console.error("\n❌ Could not connect to Docker daemon:", error.message)
    process.exit(1)
  }
}

function setupAdbReverse() {
  try {
    const res = spawnSync("adb", ["devices"], { encoding: "utf-8" })
    if (res.stdout) {
      const hasDevice = res.stdout
        .split("\n")
        .slice(1)
        .some((line) => line.trim().endsWith("device"))

      if (hasDevice) {
        spawnSync("adb", ["reverse", "tcp:3001", "tcp:3001"], {
          stdio: "ignore",
        })
        console.log(
          "✔ ADB reverse active: Android emulator/device is forwarding port 3001 to host.",
        )
        return
      }
    }
  } catch {
    // adb not available or no devices
  }
  console.log(
    "ℹ No active Android device or emulator detected yet. ADB reverse will be applied when you run `pnpm run:mobile`.",
  )
}

checkDockerInstalled()
checkDockerDaemonRunning()
setupAdbReverse()

console.log("\n==> Starting Nexus Backend in Docker for Mobile...")
const userArgs = process.argv.slice(2)
const composeArgs = [
  "compose",
  "-f",
  "compose.yaml",
  "-f",
  "compose.mobile.yaml",
  "up",
  "api",
  ...userArgs,
]

const child = spawn("docker", composeArgs, { stdio: "inherit" })

process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))

child.on("exit", (code) => {
  process.exit(code ?? 0)
})
