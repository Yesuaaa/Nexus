"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"
import { gsap } from "gsap"

export function ProjectsHeroMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = root.current
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return

    const context = gsap.context(() => {
      const timeline = gsap.timeline({ paused: true })
      timeline
        .from("[data-projects-line-start]", {
          scaleY: 0,
          transformOrigin: "top center",
          duration: 0.3,
          ease: "power2.out",
        })
        .from("[data-projects-headline]", {
          opacity: 0,
          y: 20,
          duration: 0.35,
          ease: "power2.out",
        })
        .from("[data-projects-line-end]", {
          scaleY: 0,
          transformOrigin: "top center",
          duration: 0.35,
          ease: "power2.inOut",
        })
      const start = () => timeline.play()
      if (document.documentElement.dataset.publicReveal === "pending")
        window.addEventListener("public-reveal-complete", start, { once: true })
      else start()
      return () => window.removeEventListener("public-reveal-complete", start)
    }, element)
    return () => context.revert()
  }, [])

  return <div ref={root}>{children}</div>
}
