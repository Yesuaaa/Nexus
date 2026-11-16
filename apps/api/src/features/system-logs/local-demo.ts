import { randomBytes } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import type { PGlite } from "@electric-sql/pglite"
import type { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { getPrisma, hasDatabaseClient } from "../../lib/db.js"

declare const demoBrand: unique symbol
export type LocalDemoAccess = { readonly [demoBrand]: true }
type Owner = {
  active: boolean
  db: PGlite
  socket: PGLiteSocketServer
  prisma: NonNullable<ReturnType<typeof getPrisma>>
  databaseUrl: string
  webOrigin: string
}
const owners = new WeakMap<object, Owner>()

/** A boolean, environment flag or deserialized object cannot mint this proof. */
export function verifyLocalDemo(access: unknown): boolean {
  if (!access || typeof access !== "object") return false
  const owner = owners.get(access)
  return !!(
    owner?.active &&
    !owner.db.closed &&
    process.env.NODE_ENV === "development" &&
    process.env.NODE_TEST_CONTEXT === undefined &&
    process.connected &&
    process.env.DATABASE_URL === owner.databaseUrl &&
    process.env.DIRECT_URL === undefined &&
    process.env.WEB_ORIGIN === owner.webOrigin &&
    getPrisma() === owner.prisma
  )
}

/** Dedicated IPC-launched development process only. No URL, path, client or data
 * source can be supplied. The only database this capability can attest is the
 * fresh in-memory PGlite instance created here, before any Prisma pool exists.
 */
export async function createLocalDemoDatabase() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.NODE_TEST_CONTEXT !== undefined ||
    !process.connected ||
    !process.send ||
    process.env.DATABASE_URL !== undefined ||
    process.env.DIRECT_URL !== undefined ||
    hasDatabaseClient()
  )
    throw new Error(
      "Local demonstration requires a fresh credential-isolated development process",
    )
  const web = new URL(process.env.WEB_ORIGIN ?? "")
  if (
    web.protocol !== "http:" ||
    web.hostname !== "127.0.0.1" ||
    !web.port ||
    web.username ||
    web.password ||
    web.pathname !== "/" ||
    web.search ||
    web.hash
  )
    throw new Error(
      "Local demonstration requires an explicit loopback frontend",
    )

  const { PGlite: Database } = await import("@electric-sql/pglite")
  const { PGLiteSocketServer: Socket } =
    await import("@electric-sql/pglite-socket")
  const db = new Database()
  let socket: PGLiteSocketServer | undefined
  let prisma: ReturnType<typeof getPrisma>
  const access = Object.freeze({}) as LocalDemoAccess
  let closing: Promise<void> | undefined
  const close = () =>
    (closing ??= (async () => {
      const owner = owners.get(access)
      if (owner) owner.active = false
      await prisma?.$disconnect()
      await socket?.stop()
      if (!db.closed) await db.close()
    })())
  try {
    await db.waitReady
    const migrations = new URL("../../../prisma/migrations/", import.meta.url)
    // Same migration order and SQL as the established PGlite test support.
    for (const name of (await readdir(migrations))
      .filter((name) => /^\d/.test(name))
      .sort())
      await db.exec(
        await readFile(new URL(`${name}/migration.sql`, migrations), "utf8"),
      )
    await db.exec("SET TIME ZONE 'UTC'")
    socket = new Socket({ db, host: "127.0.0.1", port: 0 })
    await socket.start()
    const databaseUrl = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_URL = databaseUrl
    process.env.DATABASE_POOL_MAX = "1"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    prisma = getPrisma()!
    await prisma.$queryRaw`SELECT 1`
    owners.set(access, {
      active: true,
      db,
      socket,
      prisma,
      databaseUrl,
      webOrigin: web.origin,
    })
    return { access, prisma, close }
  } catch (error) {
    await close()
    throw error
  }
}
