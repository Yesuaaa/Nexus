import { Skeleton } from "@/components/ui/skeleton"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export function TableSkeletonBody({
  label,
  columns,
  rows = 10,
}: {
  label: string
  columns: number
  rows?: number
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TableCell key={columnIndex} className="h-[58px] px-4 py-3">
              {rowIndex === 0 && columnIndex === 0 && (
                <span className="sr-only" role="status">
                  Loading {label}…
                </span>
              )}
              <Skeleton className="h-3 w-3/4" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}

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
