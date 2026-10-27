"use client"

import { forwardRef, type ReactNode } from "react"
import { motion, useIsPresent, useReducedMotion } from "framer-motion"

type AnimatedRowProps = {
  children: ReactNode
  className?: string
  index: number
  previousRowCount: number
}

function motionValues(index: number, previousRowCount: number, reduceMotion: boolean) {
  const stagger = reduceMotion ? 0 : Math.min(index, 9) * 40
  const enterDelay =
    stagger + (index < previousRowCount && !reduceMotion ? 100 : 0)

  return {
    initial: { opacity: 0, x: reduceMotion ? 0 : -48 },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        delay: enterDelay / 1000,
        duration: reduceMotion ? 0.12 : 0.26,
        ease: "easeOut" as const,
      },
    },
    exit: {
      opacity: 0,
      x: reduceMotion ? 0 : 48,
      transition: {
        delay: stagger / 1000,
        duration: reduceMotion ? 0.12 : 0.22,
        ease: "easeIn" as const,
      },
    },
  }
}

export const AnimatedGridRow = forwardRef<HTMLDivElement, AnimatedRowProps>(
  function AnimatedGridRow(
    { children, className, index, previousRowCount },
    ref,
  ) {
    const present = useIsPresent()
    const reduceMotion = useReducedMotion() ?? false
    const values = motionValues(index, previousRowCount, reduceMotion)

    return (
      <motion.div
        ref={ref}
        role="row"
        className={className}
        layout
        initial={values.initial}
        animate={values.animate}
        exit={values.exit}
        aria-hidden={!present}
        inert={!present}
        style={{ pointerEvents: present ? "auto" : "none" }}
      >
        {children}
      </motion.div>
    )
  },
)

export const AnimatedTableRow = forwardRef<HTMLTableRowElement, AnimatedRowProps>(
  function AnimatedTableRow(
    { children, className, index, previousRowCount },
    ref,
  ) {
    const present = useIsPresent()
    const reduceMotion = useReducedMotion() ?? false
    const values = motionValues(index, previousRowCount, reduceMotion)

    return (
      <motion.tr
        ref={ref}
        className={className}
        layout
        initial={values.initial}
        animate={values.animate}
        exit={values.exit}
        aria-hidden={!present}
        inert={!present}
        style={{ pointerEvents: present ? "auto" : "none" }}
      >
        {children}
      </motion.tr>
    )
  },
)
