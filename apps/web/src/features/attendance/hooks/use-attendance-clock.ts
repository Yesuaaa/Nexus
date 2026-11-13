"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  currentAttendance,
  mutateAttendance,
  type AttendanceMutation,
  type AttendanceState,
} from "../api/attendance-api"
import { errorMessage } from "@/lib/error-message"
import { watchVisibleRefresh } from "@/lib/visible-refresh"

export function useAttendanceClock() {
  const [state, setState] = useState<AttendanceState | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [now, setNow] = useState(0)
  const anchor = useRef({ server: 0, local: 0 })
  const busy = useRef(false)
  const sequence = useRef(0)
  const accept = useCallback((value: AttendanceState) => {
    anchor.current = {
      server: Date.parse(value.asOf),
      local: performance.now(),
    }
    setNow(anchor.current.server)
    setState(value)
    setError("")
  }, [])
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (busy.current) return
      const revision = ++sequence.current
      try {
        const value = await currentAttendance(signal)
        if (!signal?.aborted && revision === sequence.current) accept(value)
      } catch (reason) {
        if (!signal?.aborted && revision === sequence.current)
          setError(errorMessage(reason, "Couldn't load attendance."))
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [accept],
  )
  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const stop = watchVisibleRefresh(() => {
      void refresh(controller.signal)
    })
    const timer = window.setInterval(() => {
      if (anchor.current.server)
        setNow(
          anchor.current.server +
            Math.max(0, performance.now() - anchor.current.local),
        )
    }, 1000)
    return () => {
      controller.abort()
      stop()
      window.clearInterval(timer)
    }
  }, [refresh])
  async function act(input: AttendanceMutation) {
    if (busy.current) return
    busy.current = true
    sequence.current++
    setPending(true)
    try {
      const result = await mutateAttendance(input)
      accept(result)
      return true
    } catch (reason) {
      setError(errorMessage(reason, "Attendance action failed."))
      throw reason
    } finally {
      busy.current = false
      setPending(false)
      void refresh()
    }
  }
  return { state, error, loading, pending, now, refresh, act }
}
