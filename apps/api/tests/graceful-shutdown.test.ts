import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createGracefulShutdown,
  type ShutdownServer,
} from "../src/graceful-shutdown.js"

function createServer(
  onClose: (callback: (error?: Error) => void) => void,
  onIdleClose: () => void = () => {},
  onForceClose: () => void = () => {},
): ShutdownServer {
  return {
    close: onClose,
    closeIdleConnections: onIdleClose,
    closeAllConnections: onForceClose,
  }
}

test("graceful shutdown drains requests before disconnecting the database", async () => {
  const events: string[] = []
  const server = createServer(
    (callback) => {
      events.push("stop-accepting")
      callback()
    },
    () => events.push("close-idle-connections"),
  )
  const shutdown = createGracefulShutdown({
    server,
    onStart: () => events.push("mark-not-ready", "stop-background-work"),
    cleanupResources: async () => {
      events.push("cleanup-resources")
    },
    setExitCode: (code) => events.push(`exit-${code}`),
    onComplete: (code) => events.push(`complete-${code}`),
    forceExit: (code) => events.push(`force-exit-${code}`),
  })

  const firstCall = shutdown("SIGTERM")
  const repeatedCall = shutdown("SIGINT")
  assert.equal(firstCall, repeatedCall)
  await firstCall

  assert.deepEqual(events, [
    "mark-not-ready",
    "stop-background-work",
    "stop-accepting",
    "close-idle-connections",
    "cleanup-resources",
    "exit-0",
    "complete-0",
  ])
})

test("graceful shutdown waits for an in-flight request", async () => {
  const events: string[] = []
  let completeRequest: ((error?: Error) => void) | undefined
  const server = createServer((callback) => {
    completeRequest = callback
    events.push("stop-accepting")
  })
  const shutdown = createGracefulShutdown({
    server,
    onStart: () => events.push("mark-not-ready"),
    cleanupResources: async () => {
      events.push("cleanup-resources")
    },
    setExitCode: (code) => events.push(`exit-${code}`),
    onComplete: (code) => events.push(`complete-${code}`),
    forceExit: (code) => events.push(`force-exit-${code}`),
  })

  const pendingShutdown = shutdown("SIGTERM")
  await new Promise<void>((resolve) => setImmediate(resolve))
  assert.equal(events.includes("cleanup-resources"), false)

  completeRequest?.()
  await pendingShutdown
  assert.equal(events.includes("cleanup-resources"), true)
  assert.equal(events.at(-1), "complete-0")
})

test("shutdown forces connections closed after the drain limit", async () => {
  let completeClose: ((error?: Error) => void) | undefined
  let forcedCloseCount = 0
  const server = createServer(
    (callback) => {
      completeClose = callback
    },
    () => {},
    () => {
      forcedCloseCount += 1
      completeClose?.()
    },
  )
  const exitCodes: number[] = []
  const shutdown = createGracefulShutdown({
    server,
    onStart: () => {},
    cleanupResources: async () => {},
    setExitCode: (code) => exitCodes.push(code),
    onComplete: () => {},
    forceExit: (code) => exitCodes.push(code),
    drainTimeoutMs: 5,
    disconnectTimeoutMs: 20,
    hardTimeoutMs: 40,
    forcedCloseWaitMs: 10,
  })

  await shutdown("SIGTERM")
  assert.equal(forcedCloseCount, 1)
  assert.deepEqual(exitCodes, [1])
})

test("resource cleanup that hangs ends with a bounded forced exit", async () => {
  const forcedExitCodes: number[] = []
  const shutdown = createGracefulShutdown({
    server: createServer((callback) => callback()),
    onStart: () => {},
    cleanupResources: () => new Promise<void>(() => {}),
    setExitCode: () => {},
    onComplete: () => {},
    forceExit: (code) => forcedExitCodes.push(code),
    drainTimeoutMs: 5,
    disconnectTimeoutMs: 5,
    hardTimeoutMs: 15,
    forcedCloseWaitMs: 5,
  })

  await shutdown("SIGTERM")
  await new Promise<void>((resolve) => setTimeout(resolve, 20))
  assert.deepEqual(forcedExitCodes, [1])
})
