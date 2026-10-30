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

export function accountRowMotion({
  phase,
  reduceMotion,
  quick = false,
  delayMs = 0,
}: {
  phase: AccountRowMotionPhase
  reduceMotion: boolean
  quick?: boolean
  delayMs?: number
}) {
  const delay = reduceMotion ? 0 : delayMs / 1000
  const initial =
    phase === "enter"
      ? { opacity: 0, x: reduceMotion ? 0 : quick ? -36 : -48 }
      : false
  const animate =
    phase === "exit"
      ? {
          opacity: 0,
          x: reduceMotion ? 0 : quick ? 36 : 48,
          transition: {
            delay,
            duration: reduceMotion ? 0.12 : quick ? 0.14 : 0.22,
            ease: "easeIn" as const,
          },
        }
      : phase === "enter"
        ? {
            opacity: 1,
            x: 0,
            transition: {
              delay,
              duration: reduceMotion ? 0.12 : quick ? 0.17 : 0.26,
              ease: "easeOut" as const,
            },
          }
        : { opacity: 1, x: 0, transition: { duration: 0 } }

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
      const stagger = reduceMotion
        ? 0
        : Math.min(index, quick ? 5 : 9) * (quick ? 20 : 40)
      const enterDelay =
        stagger + (current && next && !reduceMotion ? (quick ? 50 : 100) : 0)
      const exitDuration = reduceMotion ? 120 : quick ? 140 : 220
      const enterDuration = reduceMotion ? 120 : quick ? 170 : 260

      if (current && !unchanged) {
        animationDuration = Math.max(animationDuration, stagger + exitDuration)
      }
      if (next && !unchanged) {
        animationDuration = Math.max(
          animationDuration,
          enterDelay + enterDuration,
        )
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
                delayMs: stagger,
              }
            : null,
        entering: next
          ? {
              item: next,
              index,
              phase: unchanged ? "steady" : "enter",
              quick,
              delayMs: enterDelay,
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
    onExitComplete?: () => void
  }
>(function AnimatedSlotRow(
  { children, className, delayMs, phase, reduceMotion, quick, onExitComplete },
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
      role="row"
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
}: AnimatedSlotGridBodyProps<T>) {
  const reduceMotion = useReducedMotion() ?? false
  const [rowSlots, setRowSlots] = useState<AnimatedRowSlot<T>[]>(() =>
    settledAnimatedRows(items),
  )
  const rowSlotsRef = useRef(rowSlots)
  const [rowHeight, setRowHeight] = useState(defaultRowHeight)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animateBodyHeight, setAnimateBodyHeight] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const animationTimerRef = useRef<number | null>(null)
  const bodyHeightTimerRef = useRef<number | null>(null)
  const animationGenerationRef = useRef(0)
  const lastViewKeyRef = useRef<string | null>(null)
  const lastQuickKeyRef = useRef<string | null>(null)

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
    const settle = () => {
      animationGenerationRef.current += 1
      const nextSlots = settledAnimatedRows(items)
      rowSlotsRef.current = nextSlots
      setRowSlots(nextSlots)
      setIsAnimating(false)
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
      const finalSlots = settledAnimatedRows(items)
      rowSlotsRef.current = finalSlots
      setRowSlots(finalSlots)
      setIsAnimating(false)
      animationTimerRef.current = null
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
      role="rowgroup"
      aria-live="polite"
      aria-busy={ariaBusy || isAnimating}
      className={className}
      style={{
        height: bodyHeight,
        transition: animateBodyHeight ? "height 220ms ease-out" : "none",
      }}
    >
      {rowSlots.length === 0 && !isAnimating && (
        <div
          role="row"
          className="grid h-full place-content-center p-6 text-center text-xs text-[#7183a2]"
        >
          <div role="cell">{emptyContent}</div>
        </div>
      )}
      {rowSlots.map((slot) => {
        const quick = slot.entering?.quick ?? slot.exiting?.quick ?? false
        const stagger = reduceMotion
          ? 0
          : Math.min(slot.index, quick ? 5 : 9) * (quick ? 20 : 40)
        const renderSlotRow = (
          row: AnimatedRowItem<T>,
          delayMs: number,
          phase: "entering" | "exiting",
        ) => (
          <AnimatedSlotRow
            key={`${getKey(row.item)}:${phase}`}
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
              renderSlotRow(
                slot.exiting,
                slot.exiting.delayMs ?? stagger,
                "exiting",
              )}
            {slot.entering &&
              renderSlotRow(
                slot.entering,
                slot.entering.delayMs ??
                  stagger +
                    (slot.exiting && !reduceMotion ? (quick ? 50 : 100) : 0),
                "entering",
              )}
          </div>
        )
      })}
    </div>
  )
}

function presenceMotionValues(
  reduceMotion: boolean,
  animateRows: boolean,
  rowIndex: number,
) {
  if (!animateRows) {
    return {
      ...accountRowMotion({ phase: "steady", reduceMotion }),
      exit: undefined,
    }
  }

  const staggerMs = reduceMotion ? 0 : Math.min(rowIndex, 9) * 40
  const entering = accountRowMotion({
    phase: "enter",
    reduceMotion,
    delayMs: staggerMs + (reduceMotion ? 0 : 100),
  })
  const exiting = accountRowMotion({
    phase: "exit",
    reduceMotion,
    delayMs: staggerMs,
  })

  return {
    initial: entering.initial,
    animate: entering.animate,
    exit: exiting.animate,
  }
}

export const AnimatedGridRow = forwardRef<HTMLDivElement, AnimatedRowProps>(
  function AnimatedGridRow(
    { children, className, animateRows, rowIndex = 0, role = "row" },
    ref,
  ) {
    const present = useIsPresent()
    const presenceData = usePresenceData() as boolean | null
    const reduceMotion = useReducedMotion() ?? false
    const shouldAnimate = present ? animateRows : (presenceData ?? animateRows)
    const values = presenceMotionValues(reduceMotion, shouldAnimate, rowIndex)

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
>(function AnimatedTableRow(
  { children, className, animateRows, rowIndex = 0 },
  ref,
) {
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
  const values = presenceMotionValues(reduceMotion, shouldAnimate, rowIndex)
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
