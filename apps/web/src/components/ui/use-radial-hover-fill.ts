"use client"

import { useCallback, useRef } from "react"
import { useAnimate } from "motion/react"
import { quarticInOut, quarticOut } from "@/lib/animation-easing"

export function useRadialHoverFill<T extends HTMLElement>() {
  const [cardRef, animate] = useAnimate<T>()
  const fillRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const animations = useRef<ReturnType<typeof animate>[]>([])

  const showFill = useCallback(
    (clientX?: number, clientY?: number) => {
      const card = cardRef.current
      const fill = fillRef.current
      const content = contentRef.current
      if (!card || !fill || !content) return

      const bounds = card.getBoundingClientRect()
      const localX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
      const localY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
      const diameter = Math.hypot(bounds.width, bounds.height) * 2
      const durationScale = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
        ? 0
        : 1

      animations.current.forEach((animation) => animation.stop())
      Object.assign(fill.style, {
        width: `${diameter}px`,
        height: `${diameter}px`,
        left: `${localX - diameter / 2}px`,
        top: `${localY - diameter / 2}px`,
      })
      animations.current = [
        animate(
          fill,
          { scale: [0, 1] },
          {
            duration: 0.55 * durationScale,
            ease: quarticOut,
          },
        ),
        animate(
          content,
          { color: "#294c96" },
          {
            duration: 0.22 * durationScale,
            delay: 0.12 * durationScale,
            ease: (progress) => 1 - (1 - progress) ** 2,
          },
        ),
      ]
    },
    [animate, cardRef],
  )

  const hideFill = useCallback(() => {
    const fill = fillRef.current
    const content = contentRef.current
    if (!fill || !content) return

    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    animations.current.forEach((animation) => animation.stop())
    animations.current = [
      animate(
        fill,
        { scale: 0 },
        {
          duration: 0.4 * durationScale,
          ease: quarticInOut,
        },
      ),
      animate(
        content,
        { color: "#ffffff" },
        {
          duration: 0.2 * durationScale,
          ease: (progress) => 1 - (1 - progress) ** 2,
        },
      ),
    ]
  }, [animate])

  return { cardRef, fillRef, contentRef, showFill, hideFill }
}
