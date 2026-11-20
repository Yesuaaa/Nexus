import "dotenv/config"
import { createApp } from "./app.js"
import { jwtKey } from "./features/auth/auth.jwt.js"
import { purgeExpiredConversationMessages } from "./features/request-conversations/request-conversations.service.js"
import { safeLog } from "./shared/safe-logger.js"

jwtKey()
const port = Number(process.env.PORT || 3001)
const host = "0.0.0.0"
createApp().listen(port, host, () =>
  safeLog("info", "api.started", { host, port }),
)

function purgeExpiredMessages() {
  void purgeExpiredConversationMessages().catch((error: unknown) => {
    safeLog("error", "conversation.expired_message_purge_failed", {}, error)
  })
}

purgeExpiredMessages()
const messagePurgeTimer = setInterval(purgeExpiredMessages, 60 * 60 * 1000)
messagePurgeTimer.unref()
