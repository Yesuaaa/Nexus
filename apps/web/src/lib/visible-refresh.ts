export function watchVisibleRefresh(
  refresh: () => void,
  options: { poll?: boolean } = {},
) {
  const refreshIfVisible = () => {
    if (document.visibilityState === "visible") refresh()
  }
  const timer =
    options.poll === false ? null : window.setInterval(refreshIfVisible, 5_000)
  window.addEventListener("focus", refreshIfVisible)
  window.addEventListener("online", refreshIfVisible)
  document.addEventListener("visibilitychange", refreshIfVisible)
  return () => {
    if (timer !== null) window.clearInterval(timer)
    window.removeEventListener("focus", refreshIfVisible)
    window.removeEventListener("online", refreshIfVisible)
    document.removeEventListener("visibilitychange", refreshIfVisible)
  }
}
