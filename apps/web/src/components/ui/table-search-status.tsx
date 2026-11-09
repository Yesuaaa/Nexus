export function TableSearchStatus({
  active,
  label,
}: {
  active: boolean
  label: string
}) {
  if (!active) return null
  return (
    <p role="status" className="mt-3 text-[11px] text-[#65718a]">
      Searching all {label}…
    </p>
  )
}
