"use client"

import type { ReactNode } from "react"
import { Section } from "@/components/ui/overview-panel"
import {
  DataTableSkeletonRows,
  TableSkeletonBody,
} from "@/components/ui/data-table-skeleton"
import {
  DataTableErrorRow,
  DataTableEmptyRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import {
  SidePanel,
  SidePanelBody,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Modal, ModalBody, ModalHeader } from "@/components/ui/modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { cn } from "@/lib/utils"
import { staffTableRow, type Page } from "../../model/payroll-documents"

export function PayrollSidePanel({
  title,
  description,
  onClose,
  busy,
  preventClose = false,
  onPreventClose,
  children,
  footer,
}: {
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  preventClose?: boolean
  onPreventClose?: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panel = useSidePanel(onClose)
  function handleOpenChange(open: boolean) {
    if (!open && preventClose) {
      onPreventClose?.()
      return
    }
    panel.onOpenChange(open)
  }
  return (
    <SidePanel open={panel.open} onOpenChange={handleOpenChange} busy={busy}>
      <SidePanelHeader title={title} description={description} />
      <SidePanelBody>{children}</SidePanelBody>
      {footer}
    </SidePanel>
  )
}

export function PayrollRecordDetail({
  sidePanel,
  title,
  description,
  onClose,
  busy,
  children,
  footer,
  preventClose,
  onPreventClose,
}: {
  sidePanel: boolean
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
  footer?: ReactNode
  preventClose?: boolean
  onPreventClose?: () => void
}) {
  if (sidePanel)
    return (
      <PayrollSidePanel
        title={title}
        description={description}
        onClose={onClose}
        busy={busy}
        preventClose={preventClose}
        onPreventClose={onPreventClose}
        footer={footer}
      >
        {children}
      </PayrollSidePanel>
    )
  return (
    <Modal
      open
      size="lg"
      busy={busy}
      onClose={onClose}
      className={footer ? "flex flex-col overflow-hidden" : undefined}
    >
      <ModalHeader
        title={title}
        description={description}
        closeDisabled={busy}
      />
      <ModalBody
        className={footer ? "min-h-0 flex-1 overflow-y-auto" : undefined}
      >
        {children}
      </ModalBody>
      {footer}
    </Modal>
  )
}

export function RecordTable({
  headings,
  children,
  loading,
  empty,
  alignments,
  columnClassNames,
  tableClassName,
  responsive,
  emptyMessage = "No records to show.",
}: {
  headings: string[]
  children: ReactNode
  loading: boolean
  empty: boolean
  emptyMessage?: string
  alignments?: Record<string, "center" | "right">
  columnClassNames?: Record<string, string>
  tableClassName?: string
  responsive?: {
    label: string
    grid: string
    emptyMessage: string
    error: string
    retry: () => void
  }
}) {
  if (responsive)
    return (
      <ResponsiveDataTable label={responsive.label} aria-busy={loading}>
        <ResponsiveDataTableHeader
          className="@max-[900px]:sr-only"
          rowClassName={responsive.grid}
        >
          {headings.map((heading) => (
            <ResponsiveDataTableColumnHeader key={heading}>
              {heading}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {loading ? (
            <DataTableSkeletonRows
              label={responsive.label}
              rowClassName={responsive.grid + " " + staffTableRow}
              cellClassNames={headings.map(() => "")}
              rows={3}
            />
          ) : responsive.error ? (
            <DataTableErrorRow
              message={responsive.error}
              onRetry={responsive.retry}
              colSpan={headings.length}
            />
          ) : empty ? (
            <DataTableEmptyRow colSpan={headings.length}>
              {responsive.emptyMessage}
            </DataTableEmptyRow>
          ) : (
            children
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
    )
  return (
    <Table
      className={cn(
        "[&_tbody_tr]:h-12 [&_tbody_td]:px-4 [&_tbody_td]:py-3",
        tableClassName,
      )}
      aria-busy={loading}
    >
      <TableHeader className="bg-[#e8eef2]">
        <TableRow className="hover:bg-[#e8eef2]">
          {headings.map((heading) => (
            <TableHead
              key={heading}
              className={cn(
                alignments?.[heading] === "right"
                  ? "text-right"
                  : alignments?.[heading] === "center"
                    ? "text-center"
                    : undefined,
                columnClassNames?.[heading],
              )}
            >
              {heading}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      {loading ? (
        <TableSkeletonBody
          label={headings[0] ?? "payroll records"}
          columns={headings.length}
          rows={3}
        />
      ) : (
        <TableBody>
          {empty ? (
            <TableRow>
              <TableCell colSpan={headings.length} className="p-0">
                <div className="grid min-h-[170px] place-content-center p-6 text-center text-xs text-[#7183a2]">
                  <span role="status">{emptyMessage}</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      )}
    </Table>
  )
}

export function PayrollPageSection({
  title,
  staff,
  children,
}: {
  title: string
  staff: boolean
  children: ReactNode
}) {
  if (staff) return <Section title={title}>{children}</Section>

  return <section aria-label={title}>{children}</section>
}

export function Pages({
  result,
  label,
  onPageChange,
}: {
  result: Page<unknown> | null | undefined
  label: string
  onPageChange: (page: number) => void
}) {
  if (!result) return null
  const { page, pageSize, total } = result
  return (
    <TablePaginationFooter
      {...pageRange(page, pageSize, total)}
      page={page}
      total={total}
      totalPages={Math.ceil(total / pageSize)}
      label={label}
      onPageChange={onPageChange}
    />
  )
}
