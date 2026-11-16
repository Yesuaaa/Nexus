// The installed Next development CLI, with an owned IPC
// lifecycle so Windows teardown can close it gracefully without a shell tree kill.
import path from "node:path"
import { nextDev } from "next/dist/cli/next-dev.js"
if (!process.connected || process.env.NODE_ENV !== "development")
  throw new Error("Use pnpm dev:system-logs-demo")
const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local demonstration port")
const stop = () => process.emit("SIGTERM", "SIGTERM")
process.on("message", (message) => {
  if (message?.type === "stop") stop()
})
process.once("disconnect", stop)
await nextDev(
  {
    disableSourceMaps: false,
    turbopack: true,
    hostname: "127.0.0.1",
    port,
  },
  "cli",
  path.resolve(import.meta.dirname, ".."),
)
process.send({ type: "ready" })
