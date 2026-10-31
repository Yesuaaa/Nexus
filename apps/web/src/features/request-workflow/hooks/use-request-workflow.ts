"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { sileo } from "sileo"
import { ApiError } from "@/features/auth/api/auth-api"
import {
  getWorkflow,
  performWorkflowAction,
  uploadWorkflowFile,
} from "../api/workflow-api"
import type { Workflow, WorkflowAction } from "../model/workflow"

export function useRequestWorkflow(requestId: string) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const flight = useRef(false)
  const alive = useRef(true)
  const revoked = useRef(false)
  const current = useRef<Workflow | null>(null)
  const pending = useRef<{
    fingerprint: string
    actionId: string
    expectedVersion: number
  } | null>(null)
  const upload = useRef<{ file: File; id: string } | null>(null)

  const revoke = useCallback(
    (message = "You no longer have access to this request workspace.") => {
      revoked.current = true
      current.current = null
      setWorkflow(null)
      setLoading(false)
      setError(message)
    },
    [],
  )

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (revoked.current || !alive.current || signal?.aborted) return
      try {
        const result = await getWorkflow(requestId, signal)
        if (!alive.current || revoked.current || signal?.aborted) return
        if (!current.current || result.version >= current.current.version) {
          current.current = result
          setWorkflow(result)
        }
        setError("")
      } catch (reason) {
        if (!alive.current || revoked.current || signal?.aborted) return
        if (
          reason instanceof ApiError &&
          [401, 403, 404].includes(reason.status)
        ) {
          revoke(reason.message)
          return
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't load the request workflow.",
        )
      } finally {
        if (alive.current && !signal?.aborted) setLoading(false)
      }
    },
    [requestId, revoke],
  )

  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    const initial = setTimeout(() => void refresh(controller.signal), 0)
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal)
    }, 15_000)
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      alive.current = false
      controller.abort()
      clearTimeout(initial)
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])

  async function act(action: WorkflowAction) {
    if (flight.current || revoked.current || !current.current) return false
    const fingerprint = JSON.stringify(action)
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = {
        fingerprint,
        actionId: crypto.randomUUID(),
        expectedVersion: current.current.version,
      }
    flight.current = true
    setBusy(true)
    setError("")
    try {
      const result = await performWorkflowAction(requestId, {
        ...action,
        actionId: pending.current.actionId,
        expectedVersion: pending.current.expectedVersion,
      })
      if (!alive.current || revoked.current) return false
      if (!current.current || result.version >= current.current.version) {
        current.current = result
        setWorkflow(result)
      }
      pending.current = null
      sileo.success({ title: "Request updated" })
      return true
    } catch (reason) {
      if (!alive.current || revoked.current) return false
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't update this request."
      setError(message)
      sileo.error({ title: "Action not completed", description: message })
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status))
        revoke(message)
      if (reason instanceof ApiError && reason.status === 409) {
        pending.current = null
        await refresh()
        setError(message)
      }
      return false
    } finally {
      flight.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function attach(file: File) {
    if (flight.current || revoked.current) return null
    if (upload.current?.file !== file)
      upload.current = { file, id: crypto.randomUUID() }
    flight.current = true
    setBusy(true)
    try {
      const result = await uploadWorkflowFile(
        requestId,
        file,
        upload.current.id,
      )
      if (!alive.current || revoked.current) return null
      upload.current = null
      await refresh()
      sileo.success({ title: "File attached", description: file.name })
      return result
    } catch (reason) {
      if (!alive.current || revoked.current) return null
      const message =
        reason instanceof Error ? reason.message : "Couldn't upload this file."
      setError(message)
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status))
        revoke(message)
      sileo.error({ title: "Upload not completed", description: message })
      return null
    } finally {
      flight.current = false
      if (alive.current) setBusy(false)
    }
  }

  return { workflow, loading, error, busy, act, attach, refresh, revoke }
}

export type WorkflowControls = ReturnType<typeof useRequestWorkflow>
