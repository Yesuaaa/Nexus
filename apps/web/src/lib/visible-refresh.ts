export function watchVisibleRefresh(refresh: () => void) {
  const refreshIfVisible = () => {
    if (document.visibilityState === "visible") refresh()
  }
  const timer = window.setInterval(refreshIfVisible, 5_000)
  window.addEventListener("focus", refreshIfVisible)
  window.addEventListener("online", refreshIfVisible)
  document.addEventListener("visibilitychange", refreshIfVisible)
  return () => {
    window.clearInterval(timer)
    window.removeEventListener("focus", refreshIfVisible)
    window.removeEventListener("online", refreshIfVisible)
    document.removeEventListener("visibilitychange", refreshIfVisible)
  }
}
