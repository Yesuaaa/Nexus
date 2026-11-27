"use client"

import { useCallback, useEffect, useRef } from "react"
import { animate } from "motion"
import type { AnimationPlaybackControls } from "motion/react"

export function useHoverLabel(defaultText: string, targetText = "EXPlore") {
  const labelRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<AnimationPlaybackControls | null>(null)

  const show = useCallback(() => {
    const label = labelRef.current
    if (!label) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    animationRef.current?.stop()

    if (reduceMotion) {
      label.textContent = targetText
      return
    }

    label.textContent = ""
    animationRef.current = animate(0, targetText.length, {
      duration: 0.5,
      ease: "linear",
      onUpdate: (characters) => {
        label.textContent = targetText.slice(0, Math.ceil(characters))
      },
    })
  }, [targetText])

  const restore = useCallback(() => {
    animationRef.current?.stop()
    if (labelRef.current) labelRef.current.textContent = defaultText
  }, [defaultText])

  useEffect(() => {
    return () => {
      animationRef.current?.stop()
    }
  }, [])

  return { labelRef, show, restore }
}
