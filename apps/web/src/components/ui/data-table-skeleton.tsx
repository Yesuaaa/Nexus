import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function DataTableSkeletonRows({
  label,
  rowClassName,
  cellClassNames,
  cellSkeletonClassNames,
  rows = 10,
}: {
  label: string
  rowClassName: string
  cellClassNames?: string[]
  cellSkeletonClassNames?: string[]
  rows?: number
}) {
  const cells = cellClassNames ?? []

  return (
    <>
      <span className="sr-only" role="status">
        Loading {label}…
      </span>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={`${label}-skeleton-${rowIndex}`}
          role="row"
          className={cn(
            rowClassName,
            "border-b border-[#eceef1] bg-background last:rounded-b-[7px] last:border-b-0",
          )}
        >
          {cells.map((cellClassName, cellIndex) => (
            <div
              key={`${label}-skeleton-${rowIndex}-${cellIndex}`}
              role="cell"
              className={cn("min-w-0", cellClassName)}
            >
              <Skeleton
                className={cellSkeletonClassNames?.[cellIndex] ?? "h-3 w-3/4"}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
