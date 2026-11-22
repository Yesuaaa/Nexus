import { Server } from "node:http"

const originalListen = Server.prototype.listen

Server.prototype.listen = function payrollE2eLoopbackListen(...args) {
  const apiPort = Number(process.env.NEXUS_PAYROLL_E2E_API_PORT)
  if (
    apiPort > 0 &&
    Number(args[0]) === apiPort &&
    typeof args[1] === "function"
  ) {
    args.splice(1, 0, "127.0.0.1")
  }
  return Reflect.apply(originalListen, this, args)
}
