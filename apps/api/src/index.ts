import "dotenv/config"
import { createApp } from "./app.js"
import { jwtKey } from "./features/auth/auth.jwt.js"
import { purgeExpiredConversationMessages } from "./features/request-conversations/request-conversations.service.js"

jwtKey()
const port = Number(process.env.PORT || 3001)
createApp().listen(port, () =>
  console.log(`API listening on http://localhost:${port}`),
)

function purgeExpiredMessages() {
  void purgeExpiredConversationMessages().catch((error: unknown) => {
    console.error("Unable to purge expired conversation messages", error)
  })
}

purgeExpiredMessages()
const messagePurgeTimer = setInterval(purgeExpiredMessages, 60 * 60 * 1000)
messagePurgeTimer.unref()
