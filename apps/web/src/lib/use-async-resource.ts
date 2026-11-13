"use client"

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { errorMessage } from "@/lib/error-message"

/** Values that can key a resource; compared by value, not identity. */
export type ResourceKey = string | number | boolean | null | undefined

type Settled<T> = { key: string; data: T | undefined; error: string }

/**
 * Loads a value once per `deps` (and on `retry`), with abort-on-change,
 * a stale-response guard, and a user-facing error message.
 *
 *   const { data, error, loading, retry } = useAsyncResource(
 *     (signal) => getEmployee(employeeId, signal),
 *     [employeeId],
 *     { fallbackError: "Couldn't load this employee." },
 *   )
 *
 * `load` always runs with the latest props, so it doesn't belong in `deps`;
 * list only the primitive values that should trigger a new request.
 * `data` keeps the last successful value while a new request is loading.
 */
export function useAsyncResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly ResourceKey[],
  {
    fallbackError = "Something went wrong. Try again.",
    enabled = true,
    initialData,
  }: {
    fallbackError?: string
    /** When false, nothing loads and `loading` is false. */
    enabled?: boolean
    initialData?: T
  } = {},
) {
  const [revision, setRevision] = useState(0)
  const [settled, setSettled] = useState<Settled<T>>({
    key: "",
    data: initialData,
    error: "",
  })
  const requestKey = JSON.stringify([deps, revision])
  const run = useEffectEvent((signal: AbortSignal) => load(signal))
  const fallbackRef = useRef(fallbackError)

  useEffect(() => {
    fallbackRef.current = fallbackError
  }, [fallbackError])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let active = true
    run(controller.signal).then(
      (data) => {
        if (active) setSettled({ key: requestKey, data, error: "" })
      },
      (reason: unknown) => {
        if (!active) return
        setSettled((current) => ({
          key: requestKey,
          data: current.data,
          error: errorMessage(reason, fallbackRef.current),
        }))
      },
    )
    return () => {
      active = false
      controller.abort()
    }
  }, [requestKey, enabled])

  const retry = useCallback(() => setRevision((value) => value + 1), [])
  /** Replace or update the loaded value locally (e.g. after a save). */
  const setData = useCallback(
    (update: T | ((current: T | undefined) => T | undefined)) =>
      setSettled((current) => ({
        ...current,
        data:
          typeof update === "function"
            ? (update as (current: T | undefined) => T | undefined)(
                current.data,
              )
            : update,
      })),
    [],
  )

  const current = settled.key === requestKey
  return {
    data: settled.data,
    error: current ? settled.error : "",
    loading: enabled && !current,
    retry,
    setData,
  }
}
