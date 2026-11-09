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
