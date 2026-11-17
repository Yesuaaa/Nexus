import assert from "node:assert/strict"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { Prisma } from "../../src/generated/prisma/client.js"
import {
  isTemporaryDatabaseError,
  readTransaction,
} from "../../src/lib/database-read.js"
import { startPgliteDatabase } from "../support/pglite-app.js"

test(
  "database reads tolerate latency and retry only temporary failures",
  { timeout: 30_000 },
  async (t) => {
    await startPgliteDatabase(t, { migrate: async () => {} })

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
