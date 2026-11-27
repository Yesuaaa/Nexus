import * as React from "react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentProps<"table"> & { density?: "default" | "compact" }
>(({ className, density = "default", ...props }, ref) => (
  <div className="relative min-w-0 w-full overflow-auto">
    <table
      ref={ref}
      className={cn(
        "w-full table-fixed caption-bottom text-xs [&_td]:break-words",
        density === "compact" &&
          "[&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3",
        className,
      )}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"thead">
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"tbody">
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<"tr">
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-[#eceef1] transition-colors hover:bg-[#f8fafd]",
      className,
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<"th">
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-4 text-left align-middle text-xs font-semibold text-foreground",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentProps<"td">
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-4 align-middle", className)} {...props} />
))
TableCell.displayName = "TableCell"

/** Full-width row shown when a semantic table's data failed to load. */
function TableErrorRow({
  message,
  onRetry,
  colSpan,
  className,
}: {
  message: React.ReactNode
  onRetry: () => void
  colSpan: number
  className?: string
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn("p-0", className)}>
        <div className="grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#65718a]">
          <div role="alert" className="grid justify-items-center gap-3">
            <p className="m-0">{message}</p>
            <button
              type="button"
              className={cn(
                "cursor-pointer rounded border-0 bg-transparent p-0 font-bold text-[#244993]",
                focusRing,
              )}
              onClick={onRetry}
            >
              Try again
            </button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableErrorRow,
}
