"use client"

import { useSyncExternalStore } from "react"

let query: MediaQueryList | undefined
function getQuery() {
  query ??= window.matchMedia("(prefers-reduced-motion: reduce)")
  return query
}
function subscribe(listener: () => void) {
  const media = getQuery()
  media.addEventListener("change", listener)
  return () => media.removeEventListener("change", listener)
}
const getSnapshot = () => getQuery().matches
const getServerSnapshot = () => false

// Reading an OS accessibility preference does not require an animation engine.
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
