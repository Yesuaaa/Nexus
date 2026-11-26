"use client"

import { useEffect, useRef } from "react"

export function ProjectsScrollMarker() {
  const marker = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = marker.current
    if (!element) return
    const line = element.querySelector<HTMLElement>("[data-line]")
    const circleContainer = element.querySelector<SVGSVGElement>("svg")
    const circle = element.querySelector<SVGCircleElement>("circle")
    if (!line || !circle || !circleContainer) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => {
      const progress = preference.matches
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              (window.innerHeight - element.getBoundingClientRect().top) /
                (window.innerHeight * 0.45),
            ),
          )
      const lineProgress = Math.min(1, progress * 1.5)
      line.style.transform = `scaleY(${lineProgress})`
      circleContainer.style.top = `${lineProgress * 80}px`
      circle.style.strokeDashoffset = String(
        -100 * (1 - Math.max(0, (progress - 2 / 3) * 3)),
      )
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    preference.addEventListener("change", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
      preference.removeEventListener("change", update)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        marginTop: 32,
      }}
    >
      <div
        ref={marker}
        style={{ position: "relative", width: 24, height: 104, flexShrink: 0 }}
      >
        <span
          data-line
          style={{
            position: "absolute",
            left: 11,
            top: 0,
            display: "block",
            width: 2,
            height: 80,
            backgroundColor: "#203f8c",
            transformOrigin: "top center",
          }}
        />
        <svg
          viewBox="0 0 24 24"
          style={{
            position: "absolute",
            left: 0,
            top: 80,
            width: 24,
            height: 24,
          }}
        >
          <circle
            cx="12"
            cy="12"
            r="11"
            fill="none"
            stroke="#203f8c"
            strokeWidth="2"
            pathLength="100"
            strokeDasharray="100 100"
            transform="rotate(-90 12 12)"
          />
        </svg>
      </div>
    </div>
  )
}
