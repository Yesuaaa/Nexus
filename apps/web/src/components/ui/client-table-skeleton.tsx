import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function ClientTableSkeleton({
  label,
  gridClassName,
  columns,
  rows = 10,
}: {
  label: string
  gridClassName: string
  columns: number
  rows?: number
}) {
  return (
    <div role="status" aria-label={`Loading ${label}`} className="min-w-0">
      <span className="sr-only">Loading {label}…</span>
      <div className="overflow-x-auto rounded-xl bg-[#e7edf3] p-1.5 max-[900px]:hidden">
        <div
          className={cn(
            gridClassName,
            "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 py-2",
          )}
          aria-hidden="true"
        >
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton
              key={`header-${index}`}
              className={cn("h-3", index === 0 ? "w-10" : "w-3/4")}
            />
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className={cn(
              gridClassName,
              "min-h-[66px] border-b border-[#eceef1] bg-background px-4 py-2 last:rounded-b-[7px] last:border-b-0",
            )}
            aria-hidden="true"
          >
            {Array.from({ length: columns }, (_, columnIndex) => (
              <div key={`cell-${rowIndex}-${columnIndex}`} className="min-w-0">
                {columnIndex === 0 ? (
                  <Skeleton className="mx-auto size-11 rounded-2xl" />
                ) : columnIndex === columns - 1 ? (
                  <Skeleton className="size-8 rounded-[7px]" />
                ) : columnIndex === 1 || columnIndex === 2 ? (
                  <div className="grid gap-2">
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                ) : (
                  <Skeleton className="h-3 w-3/4" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="hidden gap-3 max-[900px]:grid" aria-hidden="true">
        {Array.from({ length: Math.min(rows, 4) }, (_, index) => (
          <article
            key={`mobile-${index}`}
            className="min-w-0 rounded-lg border border-[#e8ebef] bg-background p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="grid min-w-0 gap-2">
                  <Skeleton className="h-3.5 w-36 max-w-[45vw]" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#eceef1] pt-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="size-8 rounded-[7px]" />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
