"use client"

import { AnimatedSlotGridBody } from "./animated-data-row"
import { AnimatedTableBody } from "./animated-table-body"
import type { ReactNode } from "react"

export type ClientRowTableColumn = {
  className: string
  label: string
}

export function ClientRowTable<T extends { id: string }>({
  items,
  viewKey,
  quickKey = "",
  getKey,
  caption,
  ariaLabel,
  columns,
  rowClassName = "h-[66px] align-middle",
  emptyContent,
  onRowsSettled,
  renderRow,
  renderMobileRow,
}: {
  items: T[]
  viewKey: string
  quickKey?: string
  getKey: (item: T) => string
  caption: string
  ariaLabel: string
  columns: ClientRowTableColumn[]
  rowClassName?: string
  emptyContent: ReactNode
  onRowsSettled?: () => void
  renderRow: (item: T) => ReactNode
  renderMobileRow: (item: T) => ReactNode
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-[#e7edf3] p-1.5 @max-[900px]:hidden">
        <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-y-2 text-left text-xs text-foreground">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col key={column.label} className={column.className} />
            ))}
          </colgroup>
          <thead className="sr-only">
            <tr>
              {columns.map((column) => (
                <th key={column.label} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <AnimatedTableBody
            items={items}
            viewKey={viewKey}
            quickKey={quickKey}
            columns={columns.length}
            rowClassName={rowClassName}
            emptyContent={emptyContent}
            onRowsSettled={onRowsSettled}
            renderRow={renderRow}
          />
        </table>
      </div>
      <div
        className="hidden gap-3 @max-[900px]:grid"
        role="list"
        aria-label={ariaLabel}
      >
        <AnimatedSlotGridBody
          items={items}
          viewKey={viewKey}
          quickKey={quickKey}
          animateRows
          getKey={getKey}
          bodyRole="presentation"
          rowRole="listitem"
          rowClassName={() => "pb-3"}
          emptyContent={emptyContent}
          onRowsSettled={onRowsSettled}
          renderRow={renderMobileRow}
        />
      </div>
    </>
  )
}
