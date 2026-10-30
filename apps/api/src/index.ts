import "dotenv/config"
import { createApp } from "./app.js"
import { jwtKey } from "./features/auth/auth.jwt.js"

jwtKey()
const port = Number(process.env.PORT || 3001)
createApp().listen(port, () =>
  console.log(`API listening on http://localhost:${port}`),
)
