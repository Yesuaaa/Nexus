export function PanelLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center bg-[rgb(13_28_57_/_48%)]"
    >
      <p className="rounded-xl bg-background px-6 py-4 text-sm text-foreground shadow-xl">
        Loading…
      </p>
    </div>
  )
}
