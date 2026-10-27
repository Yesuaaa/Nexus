"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

const panelExitDurationMs = 190

export function useAnimatedPanelClose(onClose: () => void) {
  const [open, setOpen] = useState(true)
  const reduceMotion = useReducedMotion() ?? false
  const onCloseRef = useRef(onClose)
  const closeTimerRef = useRef<number | null>(null)
  const closingRef = useRef(false)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    },
    [],
  )

  const closeAfterTransition = useCallback(
    (afterClose?: () => void) => {
      if (closingRef.current) return
      closingRef.current = true
      setOpen(false)

      const finishClose = () => {
        closeTimerRef.current = null
        onCloseRef.current()
        afterClose?.()
      }

      if (reduceMotion) finishClose()
      else {
        closeTimerRef.current = window.setTimeout(
          finishClose,
          panelExitDurationMs,
        )
      }
    },
    [reduceMotion],
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) closeAfterTransition()
    },
    [closeAfterTransition],
  )

  return { open, handleOpenChange, closeAfterTransition }
}
