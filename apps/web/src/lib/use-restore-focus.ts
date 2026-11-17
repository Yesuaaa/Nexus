"use client"

import { useState } from "react"

function focusedElement() {
  if (typeof document === "undefined") return null
  const active = document.activeElement
  return active instanceof HTMLElement && active !== document.body
    ? active
    : null
}

/**
 * Returns focus to whatever opened a Radix dialog/sheet when it closes, or
 * to `fallback()` when that element is gone (e.g. a menu item or a row that
 * re-rendered). Pass the handler to the dialog content:
 *
 *   const restoreFocus = useRestoreFocus(() => document.getElementById("heading"))
 *   <DialogContent onCloseAutoFocus={restoreFocus.onCloseAutoFocus}>…</DialogContent>
 *
 * The opener is captured on mount, and again whenever `open` turns true, so
 * it also works for dialogs that stay mounted and toggle `open`.
 */
export function useRestoreFocus(
  fallback?: () => HTMLElement | null | undefined,
  open = true,
) {
  const [state, setState] = useState(() => ({
    open,
    opener: open ? focusedElement() : null,
  }))
  if (state.open !== open) {
    // Opening: remember the element that had focus before the dialog takes it.
    setState({ open, opener: open ? focusedElement() : state.opener })
  }
  return {
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      const opener = state.opener
      if (opener?.isConnected) opener.focus()
      else fallback?.()?.focus()
    },
  }
}
