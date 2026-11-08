import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const windows = process.platform === "win32"
const device = process.argv.includes("--device")
if (process.argv.slice(2).some((arg) => arg !== "--device")) {
  throw new Error("Usage: pnpm test:mobile [--device]")
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: windows,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run("pnpm", ["--filter", "@nexus/api", "test:mobile"], root)
run(
  windows ? ".\\gradlew.bat" : "./gradlew",
  [
    ":shared:testAndroidHostTest",
    ...(device ? [":shared:connectedAndroidDeviceTest"] : []),
  ],
  fileURLToPath(new URL("../apps/mobile/", import.meta.url)),
)
