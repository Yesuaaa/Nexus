import type { SileoOptions } from "sileo"

let requested = false
const listeners = new Set<() => void>()

export function subscribeToasts(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const getToastSnapshot = () => requested
export const getServerToastSnapshot = () => false

const defaults: SileoOptions = {
  position: "top-center",
  fill: "#253f8c",
  roundness: 12,
  styles: { title: "exp-toast-title", description: "exp-toast-description" },
}

// Load the notification renderer and its animation dependency when feedback is
// actually needed. Sileo retains early notifications until its viewport mounts.
async function show(kind: "success" | "error", options: SileoOptions) {
  if (!requested) {
    requested = true
    for (const listener of listeners) listener()
  }
  const { sileo } = await import("sileo")
  return sileo[kind]({ ...defaults, ...options })
}

export const sileo = {
  success: (options: SileoOptions) => show("success", options),
  error: (options: SileoOptions) => show("error", options),
  dismiss: async (id: string) => {
    const { sileo } = await import("sileo")
    sileo.dismiss(id)
  },
}
