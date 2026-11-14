"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type CSSProperties,
  type ReactNode,
} from "react"
import {
  motion,
  useIsPresent,
  usePresenceData,
  useReducedMotion,
} from "framer-motion"

type AnimatedRowProps = {
  children: ReactNode
  className?: string
  animateRows: boolean
  /** Accepted for compatibility; rows no longer stagger by position. */
  rowIndex?: number
  role?: AriaRole
}

export type AccountRowMotionPhase = "steady" | "enter" | "exit"

export type AnimatedRowItem<T> = {
  item: T
  index: number
  phase: AccountRowMotionPhase
  runId?: number
  quick?: boolean
  delayMs?: number
}

export type AnimatedRowSlot<T> = {
  index: number
  exiting: AnimatedRowItem<T> | null
  entering: AnimatedRowItem<T> | null
}

/**
 * Row swap timing: a short in-place crossfade (opacity only, no movement, no
 * stagger). The outgoing row fades out on top while the incoming row fades
 * in beneath it, so the whole table updates as one quiet change.
 */
const EXIT_MS = 100
const ENTER_MS = 140
const REDUCED_MS = 80
// Standard "accelerate" / "decelerate" curves.
const EASE_OUT_EXIT = [0.4, 0, 1, 1] as const
const EASE_IN_ENTER = [0, 0, 0.2, 1] as const

export function accountRowMotion({
  phase,
  reduceMotion,
  delayMs = 0,
}: {
  phase: AccountRowMotionPhase
  reduceMotion: boolean
  /** Kept for API compatibility; quick and normal swaps now share timing. */
  quick?: boolean
  delayMs?: number
}) {
  const delay = reduceMotion ? 0 : delayMs / 1000
  const initial = phase === "enter" ? { opacity: 0 } : false
  const animate =
    phase === "exit"
      ? {
          opacity: 0,
          transition: {
            delay,
            duration: (reduceMotion ? REDUCED_MS : EXIT_MS) / 1000,
            ease: EASE_OUT_EXIT,
          },
        }
      : phase === "enter"
        ? {
            opacity: 1,
            transition: {
              delay,
              duration: (reduceMotion ? REDUCED_MS : ENTER_MS) / 1000,
              ease: EASE_IN_ENTER,
            },
          }
        : { opacity: 1, transition: { duration: 0 } }

  return { initial, animate }
}

export function settledAnimatedRows<T>(items: T[]): AnimatedRowSlot<T>[] {
  return items.map((item, index) => ({
    index,
    exiting: null,
    entering: { item, index, phase: "steady" },
  }))
}

export function swapAnimatedRows<T>({
  currentSlots,
  items,
  getKey,
  reduceMotion,
  runId,
  quick,
}: {
  currentSlots: AnimatedRowSlot<T>[]
  items: T[]
  getKey: (item: T) => string
  reduceMotion: boolean
  runId: number
  quick: boolean
}) {
  const currentRows = currentSlots.flatMap((slot) =>
    slot.entering ? [slot.entering] : [],
  )
  const slotCount = Math.max(currentRows.length, items.length)
  let animationDuration = 0

  const slots = Array.from(
    { length: slotCount },
    (_, index): AnimatedRowSlot<T> => {
      const current = currentRows[index] ?? null
      const next = items[index] ?? null
      const unchanged =
        current !== null &&
        next !== null &&
        getKey(current.item) === getKey(next)
      // Every row swaps at once (no stagger); exit and enter overlap.
      const exitDuration = reduceMotion ? REDUCED_MS : EXIT_MS
      const enterDuration = reduceMotion ? REDUCED_MS : ENTER_MS

      if (current && !unchanged) {
        animationDuration = Math.max(animationDuration, exitDuration)
      }
      if (next && !unchanged) {
        animationDuration = Math.max(animationDuration, enterDuration)
      }

      return {
        index,
        exiting:
          current && !unchanged
            ? {
                ...current,
                index,
                phase: "exit",
                runId,
                quick,
                delayMs: 0,
              }
            : null,
        entering: next
          ? {
              item: next,
              index,
              phase: unchanged ? "steady" : "enter",
              quick,
              delayMs: 0,
            }
          : null,
      }
    },
  )

  return { slots, animationDuration }
}

export const AnimatedSlotRow = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode
    className?: string
    delayMs: number
    phase: AccountRowMotionPhase
    reduceMotion: boolean
    quick: boolean
    role?: AriaRole
    onExitComplete?: () => void
  }
>(function AnimatedSlotRow(
  {
    children,
    className,
    delayMs,
    phase,
    reduceMotion,
    quick,
    onExitComplete,
    role = "row",
  },
  ref,
) {
  const values = accountRowMotion({
    phase,
    reduceMotion,
    quick,
    delayMs,
  })

  return (
    <motion.div
      ref={ref}
      role={role}
      className={className}
      data-animated-slot-row
      initial={values.initial}
      animate={values.animate}
      onAnimationComplete={phase === "exit" ? onExitComplete : undefined}
      aria-hidden={phase !== "steady"}
      inert={phase !== "steady"}
      style={
        phase === "exit"
          ? {
              position: "absolute",
              inset: 0,
              zIndex: 1,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }
          : {
              position: "relative",
              zIndex: 0,
              width: "100%",
              pointerEvents: phase === "steady" ? "auto" : "none",
            }
      }
    >
      {children}
    </motion.div>
  )
})

type AnimatedSlotGridBodyProps<T> = {
  items: T[]
  viewKey: string
  quickKey?: string
  animateRows: boolean
  getKey: (item: T) => string
  rowClassName: (item: T, index: number, isLast: boolean) => string
  renderRow: (item: T) => ReactNode
  emptyContent: ReactNode
  emptyHeight?: number
  defaultRowHeight?: number
  className?: string
  ariaBusy?: boolean
  bodyRole?: AriaRole
  rowRole?: AriaRole
  onRowsSettled?: () => void
}

export function AnimatedSlotGridBody<T>({
  items,
  viewKey,
  quickKey = "",
  animateRows,
  getKey,
  rowClassName,
  renderRow,
  emptyContent,
  emptyHeight = 150,
  defaultRowHeight = 58,
  className,
  ariaBusy = false,
  onRowsSettled,
  bodyRole = "rowgroup",
  rowRole = "row",
}: AnimatedSlotGridBodyProps<T>) {
  const reduceMotion = useReducedMotion() ?? false
  const [rowSlots, setRowSlots] = useState<AnimatedRowSlot<T>[]>(() =>
    settledAnimatedRows(items),
  )
  const rowSlotsRef = useRef(rowSlots)
  const latestItemsRef = useRef(items)
  const [rowHeight, setRowHeight] = useState(defaultRowHeight)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animateBodyHeight, setAnimateBodyHeight] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const animationTimerRef = useRef<number | null>(null)
  const bodyHeightTimerRef = useRef<number | null>(null)
  const animationGenerationRef = useRef(0)
  const lastViewKeyRef = useRef<string | null>(null)
  const lastQuickKeyRef = useRef<string | null>(null)
  const onRowsSettledRef = useRef(onRowsSettled)
  useEffect(() => {
    onRowsSettledRef.current = onRowsSettled
  }, [onRowsSettled])

  const removeExitedRow = useCallback(
    (row: AnimatedRowItem<T>) => {
      setRowSlots((currentSlots) => {
        return currentSlots.map((slot) =>
          slot.exiting &&
          slot.exiting.runId === row.runId &&
          getKey(slot.exiting.item) === getKey(row.item)
            ? { ...slot, exiting: null }
            : slot,
        )
      })
    },
    [getKey],
  )

  useEffect(
    () => () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current)
      }
      if (bodyHeightTimerRef.current !== null) {
        window.clearTimeout(bodyHeightTimerRef.current)
      }
    },
    [],
  )

  useLayoutEffect(() => {
    const firstRow = bodyRef.current?.querySelector<HTMLElement>(
      "[data-animated-slot-row]",
    )
    if (!firstRow) return

    const updateHeight = () => {
      const nextHeight = Math.round(firstRow.getBoundingClientRect().height)
      if (nextHeight > 0) setRowHeight(nextHeight)
    }
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(firstRow)
    return () => observer.disconnect()
  }, [rowSlots])

  useEffect(() => {
    latestItemsRef.current = items
    const settle = () => {
      animationGenerationRef.current += 1
      const nextSlots = settledAnimatedRows(latestItemsRef.current)
      rowSlotsRef.current = nextSlots
      setRowSlots(nextSlots)
      setIsAnimating(false)
      onRowsSettledRef.current?.()
    }
    const previousViewKey = lastViewKeyRef.current
    const previousQuickKey = lastQuickKeyRef.current
    const shouldAnimate =
      animateRows &&
      viewKey !== "" &&
      previousViewKey !== null &&
      previousViewKey !== viewKey
    const quick =
      shouldAnimate &&
      previousQuickKey !== null &&
      previousQuickKey !== quickKey

    if (viewKey !== "") {
      lastViewKeyRef.current = viewKey
      lastQuickKeyRef.current = quickKey
    }

    if (
      animationTimerRef.current !== null &&
      rowSlotsRef.current.filter((slot) => slot.entering).length ===
        items.length &&
      items.every((item, index) => {
        const row = rowSlotsRef.current[index]?.entering
        return row && getKey(row.item) === getKey(item)
      })
    ) {
      return
    }

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current)
      animationTimerRef.current = null
    }
    if (bodyHeightTimerRef.current !== null) {
      window.clearTimeout(bodyHeightTimerRef.current)
      bodyHeightTimerRef.current = null
    }

    if (!shouldAnimate) {
      settle()
      setAnimateBodyHeight(false)
      return
    }

    const runId = animationGenerationRef.current + 1
    const { slots, animationDuration } = swapAnimatedRows({
      currentSlots: rowSlotsRef.current,
      items,
      getKey,
      reduceMotion,
      runId,
      quick,
    })
    const hasRowSwap = slots.some(
      (slot) => slot.exiting !== null || slot.entering?.phase === "enter",
    )

    if (!hasRowSwap || animationDuration === 0) {
      settle()
      setAnimateBodyHeight(false)
      return
    }

    animationGenerationRef.current = runId
    rowSlotsRef.current = slots
    setRowSlots(slots)
    setIsAnimating(true)
    setAnimateBodyHeight(true)
    animationTimerRef.current = window.setTimeout(() => {
      const finalSlots = settledAnimatedRows(latestItemsRef.current)
      rowSlotsRef.current = finalSlots
      setRowSlots(finalSlots)
      setIsAnimating(false)
      animationTimerRef.current = null
      onRowsSettledRef.current?.()
      bodyHeightTimerRef.current = window.setTimeout(() => {
        setAnimateBodyHeight(false)
        bodyHeightTimerRef.current = null
      }, 250)
    }, animationDuration)
  }, [animateRows, getKey, items, quickKey, reduceMotion, viewKey])

  const bodyHeight =
    rowSlots.length > 0 ? rowSlots.length * rowHeight : emptyHeight

  return (
    <div
      ref={bodyRef}
      role={bodyRole}
      aria-live="polite"
      aria-busy={ariaBusy || isAnimating}
      className={className}
      style={{
        height: bodyHeight,
        transition: animateBodyHeight
          ? `height ${reduceMotion ? 0 : ENTER_MS}ms cubic-bezier(0, 0, 0.2, 1)`
          : "none",
      }}
    >
      {rowSlots.length === 0 && !isAnimating && (
        <div
          role="row"
          className="grid h-full place-content-center p-6 text-center text-xs text-[#7183a2]"
        >
          <div role="cell">{ariaBusy ? "Searchingâ€¦" : emptyContent}</div>
        </div>
      )}
      {rowSlots.map((slot) => {
        const renderSlotRow = (
          row: AnimatedRowItem<T>,
          delayMs: number,
          phase: "entering" | "exiting",
        ) => (
          <AnimatedSlotRow
            key={`${getKey(row.item)}:${phase}`}
            role={rowRole}
            className={rowClassName(
              row.item,
              slot.index,
              slot.index === rowSlots.length - 1,
            )}
            delayMs={delayMs}
            phase={row.phase}
            reduceMotion={reduceMotion}
            quick={row.quick ?? false}
            onExitComplete={
              phase === "exiting" ? () => removeExitedRow(row) : undefined
            }
          >
            {renderRow(row.item)}
          </AnimatedSlotRow>
        )

        return (
          <div
            key={slot.index}
            className="relative"
            style={{ height: rowHeight }}
          >
            {slot.exiting &&
              renderSlotRow(slot.exiting, slot.exiting.delayMs ?? 0, "exiting")}
            {slot.entering &&
              renderSlotRow(
                slot.entering,
                slot.entering.delayMs ?? 0,
                "entering",
              )}
          </div>
        )
      })}
    </div>
  )
}

function presenceMotionValues(reduceMotion: boolean, animateRows: boolean) {
  if (!animateRows) {
    return {
      ...accountRowMotion({ phase: "steady", reduceMotion }),
      exit: undefined,
    }
  }

  const entering = accountRowMotion({ phase: "enter", reduceMotion })
  const exiting = accountRowMotion({ phase: "exit", reduceMotion })

  return {
    initial: entering.initial,
    animate: entering.animate,
    exit: exiting.animate,
  }
}

export const AnimatedGridRow = forwardRef<HTMLDivElement, AnimatedRowProps>(
  function AnimatedGridRow(
    { children, className, animateRows, role = "row" },
    ref,
  ) {
    const present = useIsPresent()
    const presenceData = usePresenceData() as boolean | null
    const reduceMotion = useReducedMotion() ?? false
    const shouldAnimate = present ? animateRows : (presenceData ?? animateRows)
    const values = presenceMotionValues(reduceMotion, shouldAnimate)

    return (
      <motion.div
        ref={ref}
        role={role}
        className={className}
        aria-hidden={!present}
        inert={!present}
        style={{ pointerEvents: present ? "auto" : "none" }}
        initial={values.initial}
        animate={values.animate}
        exit={values.exit}
      >
        {children}
      </motion.div>
    )
  },
)

export const AnimatedTableRow = forwardRef<
  HTMLTableRowElement,
  AnimatedRowProps
>(function AnimatedTableRow({ children, className, animateRows }, ref) {
  const present = useIsPresent()
  const presenceData = usePresenceData() as boolean | null
  const reduceMotion = useReducedMotion() ?? false
  const rowRef = useRef<HTMLTableRowElement>(null)
  const [cachedLayout, setCachedLayout] = useState<{
    isTableRow: boolean
    columns: number[]
  }>({
    isTableRow: false,
    columns: [],
  })
  const setRowRef = useCallback(
    (row: HTMLTableRowElement | null) => {
      rowRef.current = row
      if (typeof ref === "function") ref(row)
      else if (ref) ref.current = row
    },
    [ref],
  )
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!present || !row) return

    const measure = () => {
      const display = window.getComputedStyle(row).display
      setCachedLayout({
        isTableRow: display === "table-row",
        columns: Array.from(
          row.cells,
          (cell) => cell.getBoundingClientRect().width,
        ),
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [present])
  const shouldAnimate = present ? animateRows : (presenceData ?? animateRows)
  const values = presenceMotionValues(reduceMotion, shouldAnimate)
  const frozenLayout: CSSProperties =
    !present && cachedLayout.isTableRow
      ? {
          display: "grid",
          gridTemplateColumns: cachedLayout.columns
            .map((width) => width + "px")
            .join(" "),
          alignItems: "center",
          boxSizing: "border-box",
        }
      : {}

  return (
    <motion.tr
      ref={setRowRef}
      className={className}
      aria-hidden={!present}
      inert={!present}
      style={{
        ...frozenLayout,
        pointerEvents: present ? "auto" : "none",
      }}
      initial={values.initial}
      animate={values.animate}
      exit={values.exit}
    >
      {children}
    </motion.tr>
  )
})
