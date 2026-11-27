import type { Prisma } from "../../src/generated/prisma/client.js"

/** Conversation database triggers broadcast when a realtime provider is installed. */
export async function assertShowcaseRealtimeDisabled(
  tx: Prisma.TransactionClient,
) {
  const result = await tx.$queryRaw<
    { provider: string | null }[]
  >`SELECT to_regprocedure('realtime.send(jsonb,text,text,boolean)')::text AS provider`
  if (result[0]?.provider)
    throw new Error(
      "Showcase writes are blocked because database realtime broadcasts are enabled",
    )
}
