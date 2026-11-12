/**
 * Shared offline test harness: an in-memory PGlite database exposed over a
 * local socket, the Prisma client pointed at it, and (optionally) the API
 * listening on an ephemeral port. Never touches a real database.
 *
 * Environment variables it changes (DATABASE_URL, DIRECT_URL,
 * DATABASE_POOL_MAX, JWT_SECRET) and the image storage override are restored
 * when the owning test finishes.
 */
import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { TestContext } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../app.js"
import { getPrisma } from "../lib/db.js"
import {
  setServiceImageStorageForTests,
  type ServiceImageStorage,
} from "../features/services/service-image-storage.js"

export const migrationsDirectory = new URL(
  "../../prisma/migrations/",
  import.meta.url,
)

/** Migration directory names in the order Prisma applies them. */
export async function migrationNames() {
  return (await readdir(migrationsDirectory))
    .filter((name) => /^\d/.test(name))
    .sort()
}

export function readMigration(name: string) {
  return readFile(new URL(`${name}/migration.sql`, migrationsDirectory), "utf8")
}

/** Applies every migration (or those `include` accepts) in order. */
export async function applyMigrations(
  db: PGlite,
  include: (name: string) => boolean = () => true,
) {
  for (const name of await migrationNames())
    if (include(name)) await db.exec(await readMigration(name))
}

/** A fake image store for tests that render profile/service image URLs. */
export const testImageStorage: ServiceImageStorage = {
  upload: async () => "unused",
  publicUrl: (path) => `https://images.example.com/${path}`,
  remove: async () => {},
}

export type PgliteDatabaseOptions = {
  /** Prepares the schema. Default: every migration in order. */
  migrate?: (db: PGlite) => Promise<void>
  /** Replaces service/profile image storage for the test. */
  imageStorage?: ServiceImageStorage
}

export type PgliteAppOptions = PgliteDatabaseOptions & {
  app?: Parameters<typeof createApp>[0]
}

const managedEnv = [
  "DATABASE_URL",
  "DIRECT_URL",
  "DATABASE_POOL_MAX",
  "JWT_SECRET",
] as const

/**
 * Starts a migrated PGlite database and points `getPrisma()` at it, with
 * cleanup registered on `t`. `node:test` runs `t.after` hooks in registration
 * order, so anything that must stop before the database (servers, streams)
 * should use the returned `beforeShutdown`, which runs LIFO.
 */
export async function startPgliteDatabase(
  t: TestContext,
  options: PgliteDatabaseOptions = {},
) {
  const original = Object.fromEntries(
    managedEnv.map((key) => [key, process.env[key]]),
  )
  process.env.JWT_SECRET = randomBytes(32).toString("base64url")
  if (options.imageStorage) setServiceImageStorageForTests(options.imageStorage)

  const db = new PGlite()
  const cleanup: {
    socket?: PGLiteSocketServer
    prisma?: ReturnType<typeof getPrisma>
  } = {}
  const shutdownHooks: (() => unknown)[] = []
  t.after(async () => {
    for (const hook of shutdownHooks.reverse()) await hook()
    await cleanup.prisma?.$disconnect()
    await cleanup.socket?.stop()
    await db.close()
    if (options.imageStorage) setServiceImageStorageForTests(undefined)
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  await db.waitReady
  await (options.migrate ?? applyMigrations)(db)
  const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
  cleanup.socket = socket
  await socket.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
  process.env.DATABASE_POOL_MAX = "1"
  delete process.env.DIRECT_URL
  const prisma = getPrisma()!
  cleanup.prisma = prisma
  return {
    db,
    prisma,
    beforeShutdown(hook: () => unknown) {
      shutdownHooks.push(hook)
    },
  }
}

/** Listens on an ephemeral local port; returns the server and its origin. */
export async function listen(app: ReturnType<typeof createApp>) {
  const server = app.listen(0, "127.0.0.1")
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const { port } = server.address() as AddressInfo
  return { server, origin: `http://127.0.0.1:${port}` }
}

/** Closes the server, dropping any connections still open (e.g. streams). */
export function closeServer(server: Server) {
  return new Promise<void>((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })
}

/**
 * `startPgliteDatabase` plus the API listening locally. `base` is the
 * `/api` URL; the server is closed before the database shuts down.
 */
export async function startPgliteApp(
  t: TestContext,
  options: PgliteAppOptions = {},
) {
  const database = await startPgliteDatabase(t, options)
  const { server, origin } = await listen(createApp(options.app))
  database.beforeShutdown(() => closeServer(server))
  return { ...database, server, origin, base: `${origin}/api` }
}
