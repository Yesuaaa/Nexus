import * as React from "react"
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
  rowClassName?: string
}

const ResponsiveDataTableHeader = React.forwardRef<
  HTMLDivElement,
  ResponsiveDataTableHeaderProps
>(({ className, rowClassName, children, ...props }, ref) => (
  <div ref={ref} role="rowgroup" className={className} {...props}>
    <div role="row" className={rowClassName}>
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

export {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
}
