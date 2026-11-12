import * as React from "react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

type ResponsiveDataTableProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "role" | "aria-label"
> & {
  label: string
}

const ResponsiveDataTable = React.forwardRef<
  HTMLDivElement,
  ResponsiveDataTableProps
>(({ label, className, ...props }, ref) => (
  <div
    ref={ref}
    role="table"
    aria-label={label}
    className={cn(
      "@container min-w-0 overflow-x-clip rounded-lg border border-[#e8ebef] bg-background",
      className,
    )}
    {...props}
  />
))
ResponsiveDataTable.displayName = "ResponsiveDataTable"

type ResponsiveDataTableHeaderProps = Omit<
  React.ComponentPropsWithoutRef<"div">,
  "role"
> & {
  /** Merged over the standard header-row look (tinted bar, small bold text). */
  rowClassName?: string
}

const headerRowClass =
  "min-h-[39px] rounded-t-[7px] border-b border-[#dfe6eb] bg-[#e8eef2] px-4 text-xs font-semibold text-foreground"

const ResponsiveDataTableHeader = React.forwardRef<
  HTMLDivElement,
  ResponsiveDataTableHeaderProps
>(({ className, rowClassName, children, ...props }, ref) => (
  <div ref={ref} role="rowgroup" className={className} {...props}>
    <div role="row" className={cn(headerRowClass, rowClassName)}>
      {children}
    </div>
  </div>
))
ResponsiveDataTableHeader.displayName = "ResponsiveDataTableHeader"

const ResponsiveDataTableBody = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<"div">, "role">
>(({ className, ...props }, ref) => (
  <div ref={ref} role="rowgroup" className={className} {...props} />
))
ResponsiveDataTableBody.displayName = "ResponsiveDataTableBody"

const ResponsiveDataTableRow = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<"div">, "role">
>(({ className, ...props }, ref) => (
  <div ref={ref} role="row" className={className} {...props} />
))
ResponsiveDataTableRow.displayName = "ResponsiveDataTableRow"

const ResponsiveDataTableColumnHeader = React.forwardRef<
  HTMLSpanElement,
  Omit<React.ComponentPropsWithoutRef<"span">, "role">
>(({ className, ...props }, ref) => (
  <span ref={ref} role="columnheader" className={className} {...props} />
))
ResponsiveDataTableColumnHeader.displayName = "ResponsiveDataTableColumnHeader"

const ResponsiveDataTableCell = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<"div">, "role">
>(({ className, ...props }, ref) => (
  <div ref={ref} role="cell" className={className} {...props} />
))
ResponsiveDataTableCell.displayName = "ResponsiveDataTableCell"

/** Full-width row shown when a table's data failed to load. */
function DataTableErrorRow({
  message,
  onRetry,
  colSpan,
  className,
}: {
  message: React.ReactNode
  onRetry: () => void
  /** Number of columns the message spans (sets aria-colspan). */
  colSpan: number
  className?: string
}) {
  return (
    <ResponsiveDataTableRow>
      <ResponsiveDataTableCell
        aria-colspan={colSpan}
        className={cn(
          "grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#7183a2]",
          className,
        )}
      >
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
      </ResponsiveDataTableCell>
    </ResponsiveDataTableRow>
  )
}

export {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
}
