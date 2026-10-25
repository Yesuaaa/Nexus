import { cpSync, mkdirSync } from "node:fs"
import path from "node:path"

const webRoot = path.resolve(import.meta.dirname, "..")
const standaloneApp = path.join(webRoot, ".next/standalone/apps/web")

// Next.js leaves these assets out of standalone output by default.
mkdirSync(path.join(standaloneApp, ".next"), { recursive: true })
cpSync(path.join(webRoot, "public"), path.join(standaloneApp, "public"), {
  recursive: true,
})
cpSync(
  path.join(webRoot, ".next/static"),
  path.join(standaloneApp, ".next/static"),
  {
    recursive: true,
  },
)
