import { access } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const appRoot = path.resolve(import.meta.dirname, "..")
const serverPath = path.join(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
)

try {
  await access(serverPath)
} catch {
  throw new Error('Standalone server not found. Run "pnpm build" first.')
}

process.env.HOSTNAME ||= "0.0.0.0"
process.env.PORT ||= "5173"

await import(pathToFileURL(serverPath).href)
