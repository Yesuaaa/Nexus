"use client"

import { memo, useEffect } from "react"
import {
  useRequestWorkflow,
  type WorkflowControls,
} from "@/features/request-workflow/hooks/use-request-workflow"

// Keep one controller per booking so timeline actions never use the sidebar's booking.
export const ConversationBookingWorkflow = memo(
  function ConversationBookingWorkflow({
    bookingId,
    revision,
    onChange,
  }: {
    bookingId: string
    revision: number
    onChange: (bookingId: string, controls: WorkflowControls) => void
  }) {
    const controls = useRequestWorkflow(bookingId)
    const refresh = controls.refresh
    useEffect(() => {
      onChange(bookingId, controls)
    }, [bookingId, controls, onChange])
    useEffect(() => {
      if (!revision) return
      const controller = new AbortController()
      void refresh(controller.signal)
      return () => controller.abort()
    }, [revision, refresh])
    return null
  },
)
