// Dedicated development entry point. Never imports dotenv or test fixtures.
import { randomBytes } from "node:crypto"
import { once } from "node:events"
import { createLocalDemoDatabase } from "../features/system-logs/local-demo.js"
import { hashPassword } from "../features/auth/auth.password.js"
import { issueSession } from "../features/auth/auth.service.js"
import { verifyAccessToken } from "../features/auth/auth.jwt.js"
import { usersService } from "../features/users/users.service.js"
import { errorLogs } from "../features/error-logs/error-log.js"
import { startApi } from "../server.js"

const demo = await createLocalDemoDatabase()
let api: ReturnType<typeof startApi> | undefined
let stopping: Promise<void> | undefined
function stop() {
  return (stopping ??= (async () => {
    if (api) await api.shutdown("SIGTERM")
    await demo.close()
    if (process.connected) process.disconnect()
  })())
}
process.on("message", (message: unknown) => {
  if (
    message &&
    typeof message === "object" &&
    "type" in message &&
    message.type === "stop"
  )
    void stop()
})
process.once("disconnect", () => void stop())
process.once("SIGINT", () => void stop())
process.once("SIGTERM", () => void stop())
try {
  const password = `Demo!9${randomBytes(18).toString("base64url")}`
  const rootEmail = "superadmin@demo.invalid"
  const user = await demo.prisma.user.create({
    data: {
      email: rootEmail,
      fullName: "Synthetic Demo Superadmin",
      passwordHash: await hashPassword(password),
      role: "SUPERADMIN",
    },
  })
  const session = await issueSession(user)
  const { sessionId } = await verifyAccessToken(session.token)
  // Existing writers create genuine audit records for these synthetic actions.
  for (const role of ["ADMIN", "STAFF", "USER"] as const)
    await usersService.createUser(
      { user, sessionId },
      {
        email: `${role.toLowerCase()}@demo.invalid`,
        password,
        role,
        fullName: `Synthetic Demo ${role}`,
      },
    )
  await demo.prisma.session.deleteMany({ where: { userId: user.id } })
  // One deliberate local-only failed probe demonstrates the existing collector.
  // Its SQL and exception text never enter the diagnostic read contract.
  try {
    await demo.prisma.$transaction(
      (transaction) => transaction.$queryRaw`SELECT 1 / 0`,
    )
  } catch (error: unknown) {
    errorLogs.captureInternal(error, "platform", "database.probe")
  }
  api = startApi({ systemLogsLocalDemo: demo.access })
  await once(api.server, "listening")
  const address = api.server.address()
  if (
    !address ||
    typeof address === "string" ||
    address.address !== "127.0.0.1"
  )
    throw new Error("Local demonstration API did not bind to loopback")
  process.send!({
    type: "ready",
    apiOrigin: `http://127.0.0.1:${address.port}`,
    rootEmail,
    password,
  })
} catch (error) {
  await stop()
  throw error
}
