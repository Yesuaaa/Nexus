"use client"

import { useLayoutEffect, type ReactNode } from "react"
import { useAnimate } from "motion/react"
import { cubicOut } from "@/lib/animation-easing"

export function ProjectsRevealMotion({
  children,
  triggerOnScroll = false,
  duration = 0.35,
}: {
  children: ReactNode
  triggerOnScroll?: boolean
  duration?: number
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>()

  useLayoutEffect(() => {
    const element = scope.current
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return

    const targets = Array.from(
      element.querySelectorAll<HTMLElement>("[data-projects-reveal]"),
    )
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const running = new Set<ReturnType<typeof animate>>()
    const play = (target: HTMLElement, onComplete?: () => void) => {
      const animation = animate(
        target,
        { opacity: [0, 1], y: [20, 0] },
        {
          duration,
          ease: cubicOut,
          onComplete: () => {
            running.delete(animation)
            onComplete?.()
          },
        },
      )
      running.add(animation)
    }
    const stop = (finish = false) => {
      running.forEach((animation) => {
        if (finish) animation.complete()
        else animation.stop()
      })
      running.clear()
    }

    if (triggerOnScroll) {
      if (!("IntersectionObserver" in window)) return
      targets.forEach((target) => {
        target.style.opacity = "0"
      })
      const entered = new Set<Element>()
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (
              preference.matches ||
              entry.intersectionRatio < 0.15 ||
              entered.has(entry.target) ||
              !(entry.target instanceof HTMLElement)
            )
              continue
            const target = entry.target
            entered.add(target)
            observer.unobserve(target)
            play(target)
          }
        },
        { threshold: [0, 0.15] },
      )
      targets.forEach((target) => observer.observe(target))
      const updatePreference = () => {
        if (preference.matches) {
          stop(true)
          observer.disconnect()
          entered.clear()
          targets.forEach((target) => {
            target.style.removeProperty("opacity")
          })
        } else {
          targets.forEach((target) => {
            target.style.opacity = "0"
          })
          targets.forEach((target) => observer.observe(target))
        }
      }
      preference.addEventListener("change", updatePreference)
      return () => {
        observer.disconnect()
        preference.removeEventListener("change", updatePreference)
        stop()
        targets.forEach((target) => {
          target.style.removeProperty("opacity")
        })
      }
    }

    const start = () => {
      if (!preference.matches) targets.forEach((target) => play(target))
      else targets.forEach((target) => target.style.removeProperty("opacity"))
    }
    const updatePreference = () => {
      if (preference.matches) {
        stop(true)
        targets.forEach((target) => target.style.removeProperty("opacity"))
      }
    }
    if (document.documentElement.dataset.publicReveal === "pending") {
      targets.forEach((target) => {
        target.style.opacity = "0"
      })
      window.addEventListener("public-reveal-complete", start, { once: true })
    } else start()
    preference.addEventListener("change", updatePreference)
    return () => {
      window.removeEventListener("public-reveal-complete", start)
      preference.removeEventListener("change", updatePreference)
      stop()
      targets.forEach((target) => target.style.removeProperty("opacity"))
    }
  }, [animate, duration, scope, triggerOnScroll])

  return <div ref={scope}>{children}</div>
}
