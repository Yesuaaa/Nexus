"use client"

import { useCallback, useEffect, useRef } from "react"
import { gsap } from "gsap"

export function useHoverLabel(defaultText: string, targetText = "EXPlore") {
  const labelRef = useRef<HTMLSpanElement>(null)
  const tweenRef = useRef<gsap.core.Tween | null>(null)

  const show = useCallback(() => {
    const label = labelRef.current
    if (!label) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    tweenRef.current?.kill()

    if (reduceMotion) {
      label.textContent = targetText
      return
    }

    const progress = { characters: 0 }
    label.textContent = ""
    tweenRef.current = gsap.to(progress, {
      characters: targetText.length,
      duration: 0.5,
      ease: "none",
      onUpdate: () => {
        label.textContent = targetText.slice(0, Math.ceil(progress.characters))
      },
    })
  }, [targetText])

  const restore = useCallback(() => {
    tweenRef.current?.kill()
    if (labelRef.current) labelRef.current.textContent = defaultText
  }, [defaultText])

  useEffect(() => {
    return () => {
      tweenRef.current?.kill()
    }
  }, [])

  return { labelRef, show, restore }
}
