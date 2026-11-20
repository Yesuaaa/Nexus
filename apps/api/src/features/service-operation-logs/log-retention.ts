import { getPrisma } from "../../lib/db.js"
export const retentionMs = 30 * 24 * 60 * 60 * 1000
export async function purgeServiceLogs(now = new Date()) {
  return getPrisma()?.serviceOperationLog.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - retentionMs) } },
  })
}
