import { cp, mkdir } from "node:fs/promises"
import path from "node:path"

const appRoot = path.resolve(import.meta.dirname, "..")
const standaloneAppRoot = path.join(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "web",
)

async function copyDirectory(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true, force: true })
}

await Promise.all([
  copyDirectory(
    path.join(appRoot, "public"),
    path.join(standaloneAppRoot, "public"),
  ),
  copyDirectory(
    path.join(appRoot, ".next", "static"),
    path.join(standaloneAppRoot, ".next", "static"),
  ),
])
