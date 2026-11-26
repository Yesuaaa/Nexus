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
  error,
  onRetry,
  ariaBusy = false,
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
  error?: ReactNode
  onRetry?: () => void
  ariaBusy?: boolean
  onRowsSettled?: () => void
  renderRow: (item: T) => ReactNode
  renderMobileRow: (item: T) => ReactNode
}) {
  const empty = items.length === 0 && !error

  return (
    <div className="@container min-w-0">
      <div
        className={
          empty
            ? "overflow-x-auto rounded-lg border border-[#e8ebef] bg-background @max-[900px]:hidden"
            : "overflow-x-auto rounded-xl bg-[#e7edf3] p-1.5 @max-[900px]:hidden"
        }
      >
        <table
          className={
            empty
              ? "w-full min-w-[920px] table-fixed text-left text-xs text-foreground"
              : "w-full min-w-[920px] table-fixed border-separate border-spacing-y-2 text-left text-xs text-foreground"
          }
          aria-busy={ariaBusy}
        >
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col key={column.label} className={column.className} />
            ))}
          </colgroup>
          <thead
            className={
              empty
                ? "h-[39px] border-b border-[#dfe6eb] bg-[#e8eef2] [&_th]:px-4 [&_th]:font-semibold"
                : "sr-only"
            }
          >
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
            error={error}
            onRetry={onRetry}
            onRowsSettled={onRowsSettled}
            renderRow={renderRow}
          />
        </table>
      </div>
      <div
        className={
          empty
            ? "hidden rounded-lg border border-[#e8ebef] bg-background @max-[900px]:grid"
            : "hidden gap-3 @max-[900px]:grid"
        }
        role="list"
        aria-label={ariaLabel}
        aria-busy={ariaBusy}
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
          emptyContent={
            error && onRetry ? (
              <div
                role="alert"
                className="grid min-h-[150px] place-content-center gap-3 p-6 text-center text-xs text-[#65718a]"
              >
                <p className="m-0">{error}</p>
                <button
                  type="button"
                  className="cursor-pointer rounded border-0 bg-transparent p-0 font-bold text-[#244993] focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={onRetry}
                >
                  Try again
                </button>
              </div>
            ) : (
              emptyContent
            )
          }
          onRowsSettled={onRowsSettled}
          renderRow={renderMobileRow}
        />
      </div>
    </div>
  )
}
