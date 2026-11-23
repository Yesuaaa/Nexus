"use client"

import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react"
import { gsap } from "gsap"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"
import {
  converynLogoBlue,
  converynLogoDots,
  converynLogoPaths,
} from "./converyn-logo-paths"

gsap.registerPlugin(DrawSVGPlugin)

export type ConverynLogoRevealHandle = { replay: () => void }

export function ConverynLogoReveal({
  ref,
  onComplete,
}: {
  ref?: Ref<ConverynLogoRevealHandle>
  onComplete?: () => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        timelineRef.current?.restart()
      },
    }),
    [],
  )

  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const media = gsap.matchMedia()
    let completed = false
    function completeOnce() {
      if (completed) return
      completed = true
      onComplete?.()
    }

    media.add("(prefers-reduced-motion: reduce)", () => {
      gsap.delayedCall(0, completeOnce)
    })

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const dots = svg.querySelectorAll("[data-logo-dot]")
      const outlines = svg.querySelectorAll("[data-logo-outline] path")
      const fills = svg.querySelector("[data-logo-fill]")

      gsap.set(dots, { opacity: 0, scale: 0.86, transformOrigin: "50% 50%" })
      gsap.set(outlines, { drawSVG: "0%" })
      gsap.set(fills, { opacity: 0 })
      gsap.set(svg, { visibility: "visible" })

      timelineRef.current = gsap
        .timeline({ onComplete: completeOnce })
        .to(
          dots,
          {
            opacity: 1,
            scale: 1,
            duration: 0.32,
            stagger: 0.24,
            ease: "power2.out",
          },
          0,
        )
        .set(outlines, { opacity: 1 }, 0.9)
        .to(outlines, { drawSVG: "100%", duration: 1.3, ease: "none" }, 0.9)
        .to(fills, { opacity: 1, duration: 0.5, ease: "power2.inOut" }, 2.3)
        .to(outlines, { opacity: 0, duration: 0.5, ease: "power2.inOut" }, 2.3)

      return () => {
        timelineRef.current = null
      }
    })

    return () => media.revert()
  }, [onComplete])

  return (
    <svg
      ref={svgRef}
      viewBox="250 527 2500 446"
      role="img"
      aria-label="Converyn"
      className="block h-auto w-[min(76vw,24rem)] motion-safe:invisible"
    >
      <g data-logo-fill fill={converynLogoBlue}>
        {converynLogoPaths.map(({ d, transform }) => (
          <path key={transform} d={d} transform={transform} />
        ))}
      </g>
      <g
        data-logo-outline
        fill="none"
        stroke={converynLogoBlue}
        strokeWidth="7"
        strokeLinejoin="round"
      >
        {converynLogoPaths.map(({ d, transform }) =>
          // DrawSVG needs a separate path for each closed contour.
          d
            .split(/(?=M)/)
            .map((contour, index) => (
              <path
                key={`${transform}-${index}`}
                d={contour}
                transform={transform}
                opacity="0"
              />
            )),
        )}
      </g>
      <g fill={converynLogoBlue}>
        {converynLogoDots.map(({ d, transform }) => (
          <path key={transform} data-logo-dot d={d} transform={transform} />
        ))}
      </g>
    </svg>
  )
}
