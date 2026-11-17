"use client"

import { useCallback, useEffect, useRef } from "react"
import { gsap } from "gsap"

export function useRadialHoverFill<T extends HTMLElement>() {
  const cardRef = useRef<T>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)

  const showFill = useCallback((clientX?: number, clientY?: number) => {
    const card = cardRef.current
    const fill = fillRef.current
    const content = contentRef.current
    if (!card || !fill || !content) return

    const bounds = card.getBoundingClientRect()
    const localX = (clientX ?? bounds.left + bounds.width / 2) - bounds.left
    const localY = (clientY ?? bounds.top + bounds.height / 2) - bounds.top
    const diameter = Math.hypot(bounds.width, bounds.height) * 2
    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    gsap.killTweensOf([fill, content])
    gsap.set(fill, {
      width: diameter,
      height: diameter,
      left: localX,
      top: localY,
      xPercent: -50,
      yPercent: -50,
      scale: 0,
    })
    gsap.to(fill, {
      scale: 1,
      duration: 0.55 * durationScale,
      ease: "power3.out",
    })
    gsap.to(content, {
      color: "#294c96",
      duration: 0.22 * durationScale,
      delay: 0.12 * durationScale,
    })
  }, [])

  const hideFill = useCallback(() => {
    const fill = fillRef.current
    const content = contentRef.current
    if (!fill || !content) return

    const durationScale = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1

    gsap.killTweensOf([fill, content])
    gsap.to(fill, {
      scale: 0,
      duration: 0.4 * durationScale,
      ease: "power3.inOut",
    })
    gsap.to(content, {
      color: "#ffffff",
      duration: 0.2 * durationScale,
    })
  }, [])

  useEffect(() => {
    const fill = fillRef.current
    const content = contentRef.current

    return () => {
      gsap.killTweensOf([fill, content].filter(Boolean))
    }
  }, [])

  return { cardRef, fillRef, contentRef, showFill, hideFill }
}
