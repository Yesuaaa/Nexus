import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import dotenv from "dotenv"

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
})

if (!process.env.DIRECT_URL) {
  console.error(
    "Set DIRECT_URL in apps/api/.env before starting Prisma Studio.",
  )
  process.exit(1)
}

const connection = new URL(process.env.DIRECT_URL)
const isSupabase =
  connection.hostname.endsWith(".supabase.co") ||
  connection.hostname.endsWith(".supabase.com")
const caPath =
  connection.searchParams.get("sslrootcert") ||
  process.env.NODE_EXTRA_CA_CERTS ||
  (isSupabase
    ? fileURLToPath(
        new URL("../../../certs/supabase-root-2021.crt", import.meta.url),
      )
    : undefined)

// Studio 0.33 uses postgres.js, which forwards sslrootcert to PostgreSQL as a
// server setting. Trust the CA through Node instead, before the CLI starts.
if (caPath) connection.searchParams.delete("sslrootcert")

const studio = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/prisma/build/index.js", import.meta.url),
    ),
    "studio",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DIRECT_URL: connection.toString(),
      ...(caPath ? { NODE_EXTRA_CA_CERTS: caPath } : {}),
    },
  },
)

studio.on("error", (error) => {
  console.error("Could not start Prisma Studio:", error.message)
  process.exitCode = 1
})
studio.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1)
})
