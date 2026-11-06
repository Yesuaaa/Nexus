import assert from "node:assert/strict"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { Prisma } from "../generated/prisma/client.js"
import { getPrisma } from "./db.js"
import { isTemporaryDatabaseError, readTransaction } from "./database-read.js"

test(
  "database reads tolerate latency and retry only temporary failures",
  { timeout: 30_000 },
  async (t) => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    }
    const db = new PGlite()
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
    process.env.DATABASE_POOL_MAX = "1"
    delete process.env.DIRECT_URL
    const prisma = getPrisma()!
    t.after(async () => {
      await prisma.$disconnect()
      await socket.stop()
      await db.close()
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })

    await t.test(
      "a read can finish beyond Prisma's default five-second deadline",
      async () => {
        const result = await readTransaction(async (tx) => {
          await tx.$queryRaw`SELECT 1`
          await delay(5_200)
          return tx.$queryRaw<{ value: number }[]>`SELECT 42::int AS value`
        })
        assert.equal(result[0]?.value, 42)
      },
    )

    await t.test(
      "a dropped connection retries the whole read in a fresh transaction",
      async () => {
        let attempts = 0
        const result = await readTransaction(async (tx) => {
          await tx.$queryRaw`SELECT 1`
          if (++attempts === 1)
            throw new Prisma.PrismaClientKnownRequestError(
              "Connection closed",
              {
                code: "P1017",
                clientVersion: Prisma.prismaVersion.client,
              },
            )
          return tx.$queryRaw<{ value: number }[]>`SELECT 7::int AS value`
        })
        assert.equal(attempts, 2)
        assert.equal(result[0]?.value, 7)
      },
    )

    await t.test(
      "persistent failures stop after one retry and programming errors are not retried",
      async () => {
        for (const code of ["P1017", "P2002"]) {
          let attempts = 0
          const failure = new Prisma.PrismaClientKnownRequestError(
            "Read failed",
            {
              code,
              clientVersion: Prisma.prismaVersion.client,
            },
          )
          await assert.rejects(
            readTransaction(async (tx) => {
              await tx.$queryRaw`SELECT 1`
              attempts++
              throw failure
            }),
            (error) => error === failure,
          )
          assert.equal(attempts, code === "P1017" ? 2 : 1)
        }
        assert.equal(
          isTemporaryDatabaseError(new Error("Unexpected bug")),
          false,
        )
        assert.equal(
          isTemporaryDatabaseError(
            new Prisma.PrismaClientKnownRequestError(
              "Transaction already closed: expired transaction",
              {
                code: "P2028",
                clientVersion: Prisma.prismaVersion.client,
              },
            ),
          ),
          true,
        )
      },
    )
  },
)
