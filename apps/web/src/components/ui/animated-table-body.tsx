"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  accountRowMotion,
  settledAnimatedRows,
  swapAnimatedRows,
  type AnimatedRowSlot,
} from "./animated-data-row"

type RowLayout = {
  top: number
  width: number
  height: number
  columns: number[]
}
const rowKey = (item: { id: string }) => item.id

/** The account-table transition for semantic HTML tables, with frozen exit cells. */
export function AnimatedTableBody<T extends { id: string }>({
  items,
  viewKey,
  quickKey = "",
  renderRow,
  rowClassName,
  emptyContent,
  columns,
  onRowsSettled,
}: {
  items: T[]
  viewKey: string
  quickKey?: string
  renderRow: (item: T) => ReactNode
  rowClassName?: string | ((item: T) => string)
  emptyContent: ReactNode
  columns: number
  onRowsSettled?: () => void
}) {
  const reduced = useReducedMotion() ?? false
  const [slots, setSlots] = useState(() => settledAnimatedRows(items))
  const slotsRef = useRef<AnimatedRowSlot<T>[]>(slots)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const layouts = useRef(new Map<string, RowLayout>())
  const [exitLayouts, setExitLayouts] = useState(new Map<string, RowLayout>())
  const previous = useRef({ view: viewKey, quick: quickKey })
  const callback = useRef(onRowsSettled)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<number | null>(null)
  const latestItems = useRef(items)
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )
  useEffect(() => {
    callback.current = onRowsSettled
  }, [onRowsSettled])

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const measure = () => {
      const next = new Map<string, RowLayout>()
      for (const row of body.querySelectorAll<HTMLTableRowElement>(
        "tr[data-row-id]:not([data-exiting])",
      )) {
        const box = row.getBoundingClientRect()
        next.set(row.dataset.rowId!, {
          top: box.top - body.getBoundingClientRect().top,
          width: box.width,
          height: box.height,
          columns: Array.from(
            row.cells,
            (cell) => cell.getBoundingClientRect().width,
          ),
        })
      }
      layouts.current = next
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [slots])

  useEffect(() => {
    latestItems.current = items
    const changed = previous.current.view !== viewKey
    const quick = previous.current.quick !== quickKey
    previous.current = { view: viewKey, quick: quickKey }
    const settle = () => {
      const next = settledAnimatedRows(latestItems.current)
      timerRef.current = null
      slotsRef.current = next
      setSlots(next)
      setAnimating(false)
      callback.current?.()
    }
    if (
      timerRef.current !== null &&
      slotsRef.current.filter((slot) => slot.entering).length ===
        items.length &&
      items.every(
        (item, index) => slotsRef.current[index]?.entering?.item.id === item.id,
      )
    )
      return
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (!changed) {
      settle()
      return
    }
    const { slots: next, animationDuration } = swapAnimatedRows({
      currentSlots: slotsRef.current,
      items,
      getKey: rowKey,
      reduceMotion: reduced,
      runId: 0,
      quick,
    })
    if (!animationDuration) {
      settle()
      return
    }
    setExitLayouts(new Map(layouts.current))
    slotsRef.current = next
    setSlots(next)
    setAnimating(true)
    timerRef.current = window.setTimeout(settle, animationDuration)
  }, [items, viewKey, quickKey, reduced])

  return (
    <motion.tbody
      ref={bodyRef}
      layout
      className="relative"
      aria-live="polite"
      aria-busy={animating}
      transition={{
        layout: { duration: reduced ? 0 : 0.14, ease: [0, 0, 0.2, 1] },
      }}
    >
      {slots.length === 0 && (
        <tr>
          <td
            colSpan={columns}
            className="p-8 text-center text-xs text-[#7183a2]"
          >
            {emptyContent}
          </td>
        </tr>
      )}
      {slots.flatMap((slot) =>
        [slot.exiting, slot.entering]
          .filter((row) => row !== null)
          .map((row) => {
            const exiting = row.phase === "exit"
            const layout = exitLayouts.get(row.item.id)
            const values = accountRowMotion({
              phase: row.phase,
              reduceMotion: reduced,
              quick: row.quick,
              delayMs: row.delayMs,
            })
            return (
              <motion.tr
                key={`${slot.index}:${row.item.id}:${exiting ? "exit" : "row"}`}
                data-row-id={row.item.id}
                data-exiting={exiting ? "" : undefined}
                data-animated-slot-row
                className={
                  typeof rowClassName === "function"
                    ? rowClassName(row.item)
                    : rowClassName
                }
                initial={values.initial}
                animate={values.animate}
                aria-hidden={row.phase !== "steady"}
                inert={row.phase !== "steady"}
                style={
                  exiting
                    ? {
                        position: "absolute",
                        top: layout?.top ?? 0,
                        left: 0,
                        width: layout?.width ?? "100%",
                        height: layout?.height,
                        display: "grid",
                        gridTemplateColumns: layout?.columns
                          .map((width) => `${width}px`)
                          .join(" "),
                        alignItems: "center",
                        pointerEvents: "none",
                      }
                    : undefined
                }
              >
                {renderRow(row.item)}
              </motion.tr>
            )
          }),
      )}
      {slots
        .filter((slot) => !slot.entering && slot.exiting)
        .map((slot) => (
          <tr
            key={`spacer-${slot.index}`}
            aria-hidden="true"
            inert
            style={{
              height: exitLayouts.get(slot.exiting!.item.id)?.height ?? 58,
            }}
          >
            <td colSpan={columns} className="p-0" />
          </tr>
        ))}
    </motion.tbody>
  )
}
