/**
 * Calls `refresh` whenever the page becomes visible again: on window focus,
 * tab visibility, network reconnect and back/forward-cache restores, plus on
 * an interval while the page stays visible (unless `poll` is false).
 * Returns a cleanup function that removes every listener.
 */
export function watchVisibleRefresh(
  refresh: () => void,
  options: {
    /** Poll on an interval while visible. Defaults to true. */
    poll?: boolean
    /** Poll interval in milliseconds. Defaults to 5 seconds. */
    intervalMs?: number
  } = {},
) {
  const refreshIfVisible = () => {
    if (document.visibilityState === "visible") refresh()
  }
  const timer =
    options.poll === false
      ? null
      : window.setInterval(refreshIfVisible, options.intervalMs ?? 5_000)
  window.addEventListener("focus", refreshIfVisible)
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) refreshIfVisible()
  }
  window.addEventListener("pageshow", onPageShow)
  window.addEventListener("online", refreshIfVisible)
  document.addEventListener("visibilitychange", refreshIfVisible)
  return () => {
    if (timer !== null) window.clearInterval(timer)
    window.removeEventListener("focus", refreshIfVisible)
    window.removeEventListener("pageshow", onPageShow)
    window.removeEventListener("online", refreshIfVisible)
    document.removeEventListener("visibilitychange", refreshIfVisible)
  }
}
