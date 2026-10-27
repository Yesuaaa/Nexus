"use client"

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
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
}

function motionValues(reduceMotion: boolean, animateRows: boolean) {
  if (!animateRows) {
    return {
      initial: false,
      animate: {
        opacity: 1,
        transition: { duration: 0 },
      },
    }
  }

  return {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        delay: reduceMotion ? 0 : 0.04,
        duration: reduceMotion ? 0.12 : 0.18,
        ease: "easeOut" as const,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: reduceMotion ? 0.12 : 0.14,
        ease: "easeIn" as const,
      },
    },
  }
}

export const AnimatedGridRow = forwardRef<HTMLDivElement, AnimatedRowProps>(
  function AnimatedGridRow({ children, className, animateRows }, ref) {
    const present = useIsPresent()
    const presenceData = usePresenceData() as boolean | null
    const reduceMotion = useReducedMotion() ?? false
    const shouldAnimate = present ? animateRows : (presenceData ?? animateRows)
    const values = motionValues(reduceMotion, shouldAnimate)

    return (
      <motion.div
        ref={ref}
        role="row"
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
  const cachedLayout = useRef<{ isTableRow: boolean; columns: number[] }>({
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
      cachedLayout.current = {
        isTableRow: display === "table-row",
        columns: Array.from(
          row.cells,
          (cell) => cell.getBoundingClientRect().width,
        ),
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [present])
  const shouldAnimate = present ? animateRows : (presenceData ?? animateRows)
  const values = motionValues(reduceMotion, shouldAnimate)
  const frozenLayout: CSSProperties =
    !present && cachedLayout.current.isTableRow
      ? {
          display: "grid",
          gridTemplateColumns: cachedLayout.current.columns
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
