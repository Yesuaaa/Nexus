import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const envGuard = fileURLToPath(
  new URL("./offline-env-guard.mjs", import.meta.url),
)

/** Keep OS/tool locations, never inherit application credentials, test-worker
 * markers, external origins, NODE_OPTIONS or live-regression configuration. */
export function offlineEnvironment(overrides = {}, source = process.env) {
  if (Object.hasOwn(overrides, "NODE_TEST_CONTEXT"))
    throw new Error("Only native Node may establish test-worker context")
  const keys = [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "ComSpec",
    "COMSPEC",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "HOME",
    "HOMEDRIVE",
    "HOMEPATH",
    "PROCESSOR_ARCHITECTURE",
    "NUMBER_OF_PROCESSORS",
  ]
  const env = Object.fromEntries(
    keys
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  )
  return {
    ...env,
    NODE_OPTIONS: `--import ${JSON.stringify(pathToFileURL(envGuard).href)}`,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_API_URL: "",
    SESSION_GEOLOCATION: "",
    ...overrides,
  }
}

export function pnpmInvocation(source = process.env) {
  const launcher = source.npm_execpath
  if (!launcher || !/pnpm/i.test(path.basename(launcher)))
    throw new Error(
      "Launch controlled local workflows using pnpm test:system-logs-integration or pnpm dev:system-logs-demo",
    )
  return /\.(?:c?js|mjs)$/i.test(launcher)
    ? { command: process.execPath, prefix: [launcher] }
    : { command: launcher, prefix: [] }
}

export function loopbackOrigin(input) {
  const url = new URL(input)
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Offline test origins must be explicit IPv4 loopback origins",
    )
  return url.origin
}
