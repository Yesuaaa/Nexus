process.env.PORT ||= "5173"
process.env.HOSTNAME ||= "0.0.0.0"

await import("../.next/standalone/apps/web/server.js")
