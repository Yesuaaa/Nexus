export type ShutdownServer = {
  close: (callback: (error?: Error) => void) => void
  closeIdleConnections: () => void
  closeAllConnections: () => void
}

type ShutdownOptions = {
  server: ShutdownServer
  onStart: () => void
  cleanupResources: () => Promise<void>
  setExitCode: (code: number) => void
  onComplete: (code: number) => void
  forceExit: (code: number) => void
  drainTimeoutMs?: number
  forcedCloseWaitMs?: number
  disconnectTimeoutMs?: number
  hardTimeoutMs?: number
}

type TimedResult<T> =
  | { status: "resolved"; value: T }
  | { status: "rejected"; error: unknown }
  | { status: "timeout" }

function waitFor<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<TimedResult<T>> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<TimedResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs)
  })
  const settled = promise.then<TimedResult<T>, TimedResult<T>>(
    (value) => ({ status: "resolved", value }),
    (error: unknown) => ({ status: "rejected", error }),
  )
  return Promise.race([settled, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function logShutdownProblem(message: string) {
  console.error(message)
}

export function createGracefulShutdown(options: ShutdownOptions) {
  const drainTimeoutMs = options.drainTimeoutMs ?? 12_000
  const forcedCloseWaitMs = options.forcedCloseWaitMs ?? 1_000
  const disconnectTimeoutMs = options.disconnectTimeoutMs ?? 3_000
  const hardTimeoutMs = options.hardTimeoutMs ?? 18_000
  let shutdownPromise: Promise<void> | undefined

  return (signal: NodeJS.Signals) => {
    if (shutdownPromise) return shutdownPromise

    shutdownPromise = (async () => {
      let exitCode = 0
      let httpServerClosed = false
      let resourcesCleaned = false

      const hardTimeout = setTimeout(() => {
        logShutdownProblem("API shutdown exceeded its hard deadline")
        try {
          options.server.closeAllConnections()
        } catch {
          // The hard deadline still forces process termination below.
        }
        options.forceExit(1)
      }, hardTimeoutMs)

      try {
        options.onStart()
      } catch {
        exitCode = 1
        logShutdownProblem("API shutdown could not stop background work")
      }

      console.log(`API received ${signal}; draining requests`)

      let closed: Promise<Error | undefined>
      try {
        closed = new Promise((resolve) => {
          options.server.close((error) => resolve(error))
        })
        options.server.closeIdleConnections()
      } catch {
        exitCode = 1
        logShutdownProblem("API HTTP server could not begin draining")
        closed = Promise.resolve(new Error("HTTP server close failed"))
      }

      let closeResult = await waitFor(closed, drainTimeoutMs)
      if (closeResult.status === "timeout") {
        exitCode = 1
        logShutdownProblem(
          "API request drain timed out; closing active connections",
        )
        try {
          options.server.closeAllConnections()
        } catch {
          logShutdownProblem("API could not force-close active connections")
        }
        closeResult = await waitFor(closed, forcedCloseWaitMs)
      }

      if (
        closeResult.status === "resolved" &&
        closeResult.value === undefined
      ) {
        httpServerClosed = true
      } else {
        exitCode = 1
        logShutdownProblem("API HTTP server did not close cleanly")
      }

      const cleanupResult = await waitFor(
        Promise.resolve().then(options.cleanupResources),
        disconnectTimeoutMs,
      )
      if (cleanupResult.status === "resolved") {
        resourcesCleaned = true
      } else {
        exitCode = 1
        logShutdownProblem("API resource cleanup did not complete cleanly")
      }

      options.setExitCode(exitCode)
      if (httpServerClosed && resourcesCleaned) {
        clearTimeout(hardTimeout)
        options.onComplete(exitCode)
      }
    })()

    return shutdownPromise
  }
}
