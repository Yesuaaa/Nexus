import { SearchIcon } from "@/components/layout/icons"

export function SearchEmptyState({ query }: { query: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid justify-items-center gap-2 text-center text-xs text-[#65718a]"
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-full bg-[#f1f4f7] text-[#738096]"
      >
        <SearchIcon width="16" height="16" />
      </span>
      <p className="m-0">
        No results for{" "}
        <span className="font-semibold text-foreground">“{query}”</span> found.
      </p>
    </div>
  )
}
