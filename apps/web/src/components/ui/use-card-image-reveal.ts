"use client"

import { useRef, type RefObject } from "react"
import { useAnimate } from "motion/react"
import { quarticInOut, quarticOut } from "@/lib/animation-easing"

export function useCardImageReveal(
  cardRef: RefObject<HTMLElement | null>,
  hoverScale: number,
) {
  const [revealRef, animate] = useAnimate<HTMLSpanElement>()
  const animation = useRef<ReturnType<typeof animate> | null>(null)

  function duration(seconds: number) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : seconds
  }

  function showReveal(clientX?: number, clientY?: number) {
    const card = cardRef.current
    const reveal = revealRef.current
    if (!card || !reveal) return
    const bounds = card.getBoundingClientRect()
    const x = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
    const y = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
    const radius = Math.hypot(bounds.width, bounds.height)

    animation.current?.stop()
    animation.current = animate(
      reveal,
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
        scale: [1, hoverScale],
      },
      { duration: duration(0.55), ease: quarticOut },
    )
  }

  function hideReveal() {
    const card = cardRef.current
    const reveal = revealRef.current
    if (!card || !reveal) return
    const bounds = card.getBoundingClientRect()
    animation.current?.stop()
    animation.current = animate(
      reveal,
      {
        clipPath: `circle(0px at ${bounds.width / 2}px ${bounds.height / 2}px)`,
        scale: 1,
      },
      { duration: duration(0.4), ease: quarticInOut },
    )
  }

  return { revealRef, showReveal, hideReveal }
}
