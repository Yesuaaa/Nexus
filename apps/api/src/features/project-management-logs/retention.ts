import { getPrisma } from "../../lib/db.js"
import { retentionMs } from "../service-operation-logs/log-retention.js"

export async function purgeProjectLogs(now = new Date()) {
  return getPrisma()?.projectManagementLog.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - retentionMs) } },
  })
}
