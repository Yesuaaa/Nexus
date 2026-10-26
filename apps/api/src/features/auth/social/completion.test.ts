import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import pg from "pg"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { PrismaPg } from "@prisma/adapter-pg"
import {
  PrismaClient,
  type SocialCompletion,
} from "../../../generated/prisma/client.js"
import { after, before, test } from "node:test"
import { finishSocial, SocialError } from "./completion.js"

const { Pool } = pg
let database: PGlite
let socketServer: PGLiteSocketServer
let pool: InstanceType<typeof Pool>
let prisma: PrismaClient

before(async () => {
  database = new PGlite()
  await database.waitReady
  const migrationsPath = resolve("prisma/migrations")
  const migrations = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  for (const migration of migrations) {
    const sql = await readFile(
      join(migrationsPath, migration, "migration.sql"),
      "utf8",
    )
    await database.exec(sql)
  }

  socketServer = new PGLiteSocketServer({
    db: database,
    host: "127.0.0.1",
    port: 0,
    maxConnections: 1,
  })
  await socketServer.start()
  const port = Number(socketServer.getServerConn().split(":").at(-1))
  pool = new Pool({
    host: "127.0.0.1",
    port,
    database: "postgres",
    user: "postgres",
    password: "postgres",
    ssl: false,
    max: 1,
  })
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
})

after(async () => {
  await prisma?.$disconnect()
  await pool?.end()
  await socketServer?.stop()
  await database?.close()
})

async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "SocialCompletion", "OAuthAttempt", "SocialIdentity", "Session", "Team", "Department", "User" CASCADE',
  )
}

async function completion(
  overrides: Partial<SocialCompletion> = {},
): Promise<SocialCompletion> {
  return prisma.socialCompletion.create({
    data: {
      id: `completion-${Math.random().toString(36).slice(2)}`,
      provider: "google",
      subject: "provider-subject-1",
      email: "avery@example.test",
      emailVerified: true,
      fullName: "Avery Example",
      verifierHash: "f".repeat(64),
      purpose: "signin",
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    },
  })
}

async function seedUser(
  email: string,
  role: "USER" | "ADMIN" | "SUPERADMIN" = "USER",
) {
  return prisma.user.create({ data: { email, role, passwordHash: null } })
}

test("new social sign-in creates a passwordless user, identity, and hashed session", async () => {
  await resetDatabase()
  const pending = await completion()
  const result = await prisma.$transaction((tx) =>
    finishSocial(tx, pending, {
      fullName: "Avery Example",
      contactNumber: "+63 912 345 6789",
    }),
  )

  assert.equal("token" in result, true)
  if (!("token" in result)) return
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "avery@example.test" },
  })
  assert.equal(user.passwordHash, null)
  assert.equal(user.role, "USER")
  assert.equal(user.fullName, "Avery Example")
  assert.equal(
    await prisma.socialIdentity.count({
      where: { userId: user.id, subject: pending.subject },
    }),
    1,
  )
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1)
  assert.match(result.token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(
    await prisma.session.count({
      where: {
        tokenHash: createHash("sha256").update(result.token).digest("hex"),
        userId: user.id,
      },
    }),
    1,
  )
  assert.equal(
    await prisma.socialCompletion.count({ where: { id: pending.id } }),
    0,
  )
})

test("returning social sign-in preserves the existing email and elevated role", async () => {
  await resetDatabase()
  const user = await seedUser("admin@example.test", "ADMIN")
  await prisma.socialIdentity.create({
    data: {
      userId: user.id,
      provider: "google",
      subject: "provider-subject-1",
      email: "old@example.test",
    },
  })
  const pending = await completion({ email: "changed@example.test" })
  const result = await prisma.$transaction((tx) =>
    finishSocial(tx, pending, {}),
  )

  assert.equal("token" in result, true)
  if (!("token" in result)) return
  assert.equal(result.user.id, user.id)
  assert.equal(result.user.email, "admin@example.test")
  assert.equal(result.user.role, "ADMIN")
  assert.equal(await prisma.user.count(), 1)
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1)
})

test("matching email requires existing-account sign-in and creates no user or session", async () => {
  await resetDatabase()
  await seedUser("avery@example.test")
  const pending = await completion()

  await assert.rejects(
    prisma.$transaction((tx) => finishSocial(tx, pending, {})),
    (error: unknown) => error instanceof SocialError && error.status === 409,
  )
  assert.equal(await prisma.user.count(), 1)
  assert.equal(await prisma.session.count(), 0)
  assert.equal(await prisma.socialIdentity.count(), 0)
  assert.equal(
    await prisma.socialCompletion.count({ where: { id: pending.id } }),
    1,
  )
})

test("incomplete social profile returns onboarding without database changes", async () => {
  await resetDatabase()
  const pending = await completion({ email: null, emailVerified: false })
  const result = await prisma.$transaction((tx) =>
    finishSocial(tx, pending, {}),
  )

  assert.deepEqual(result, {
    onboarding: true,
    emailRequired: true,
    email: undefined,
    fullName: "Avery Example",
  })
  assert.equal(await prisma.user.count(), 0)
  assert.equal(await prisma.socialIdentity.count(), 0)
  assert.equal(await prisma.session.count(), 0)
  assert.equal(
    await prisma.socialCompletion.count({ where: { id: pending.id } }),
    1,
  )
})

test("linking cannot take a provider identity owned by another user", async () => {
  await resetDatabase()
  const owner = await seedUser("owner@example.test")
  const other = await seedUser("other@example.test")
  await prisma.socialIdentity.create({
    data: {
      userId: other.id,
      provider: "google",
      subject: "provider-subject-1",
      email: "other@example.test",
    },
  })
  const session = await prisma.session.create({
    data: {
      userId: owner.id,
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    },
  })
  const pending = await completion({
    purpose: "link",
    userId: owner.id,
    sessionId: session.id,
  })

  await assert.rejects(
    prisma.$transaction((tx) => finishSocial(tx, pending, {}, session.id)),
    (error: unknown) => error instanceof SocialError && error.status === 409,
  )
  assert.equal(await prisma.socialIdentity.count(), 1)
  assert.equal(
    await prisma.socialIdentity.count({
      where: { userId: other.id, subject: pending.subject },
    }),
    1,
  )
  assert.equal(
    await prisma.socialCompletion.count({ where: { id: pending.id } }),
    1,
  )
})

test("failed session creation rolls back new user, identity, and completion deletion", async () => {
  await resetDatabase()
  const pending = await completion()
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION reject_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'session insert rejected'; END;
    $$
  `)
  await prisma.$executeRawUnsafe(
    'CREATE TRIGGER reject_session_insert BEFORE INSERT ON "Session" FOR EACH ROW EXECUTE FUNCTION reject_session_insert()',
  )

  try {
    await assert.rejects(
      prisma.$transaction((tx) =>
        finishSocial(tx, pending, {
          fullName: "Avery Example",
          contactNumber: "+63 912 345 6789",
        }),
      ),
    )
  } finally {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER reject_session_insert ON "Session"',
    )
    await prisma.$executeRawUnsafe("DROP FUNCTION reject_session_insert()")
  }

  assert.equal(await prisma.user.count(), 0)
  assert.equal(await prisma.socialIdentity.count(), 0)
  assert.equal(await prisma.session.count(), 0)
  assert.equal(
    await prisma.socialCompletion.count({ where: { id: pending.id } }),
    1,
  )
})
