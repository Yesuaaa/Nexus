"use client"

import { useEffect, useRef } from "react"
import { animate } from "motion"
import type { AnimationPlaybackControls } from "motion/react"
import { cubicOut } from "@/lib/animation-easing"

const stats = [
  { value: 98, label: "Satisfaction", suffix: "%", decimals: 0 },
  { value: 120, label: "Projects built", suffix: "+", decimals: 0 },
  { value: 4.9, label: "Average rating", suffix: "★", decimals: 1 },
]

export function HeroStats() {
  const statsRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const container = statsRef.current
    if (!container) return

    const values = Array.from(
      container.querySelectorAll<HTMLElement>("[data-stat-value]"),
    )
    const revealPending =
      document.documentElement.dataset.publicReveal === "pending"
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    const showFinalValues = () => {
      values.forEach((element, index) => {
        element.textContent = stats[index].value.toFixed(stats[index].decimals)
      })
    }

    if (reducedMotion) {
      if (revealPending) {
        window.addEventListener("public-reveal-complete", showFinalValues, {
          once: true,
        })
        return () =>
          window.removeEventListener("public-reveal-complete", showFinalValues)
      }
      showFinalValues()
      return
    }

    let visible = false
    let played = false
    let revealReady = !revealPending
    const animations: AnimationPlaybackControls[] = []
    const play = () => {
      if (played || !visible || !revealReady || container.closest("[inert]"))
        return
      played = true
      values.forEach((element, index) => {
        const { value, decimals } = stats[index]
        animations.push(
          animate(0, value, {
            duration: 1.4,
            delay: index * 0.12,
            ease: cubicOut,
            onUpdate: (count) => {
              element.textContent = count.toFixed(decimals)
            },
          }),
        )
      })
      observer.disconnect()
      loaderObserver.disconnect()
    }
    const onRevealComplete = () => {
      revealReady = true
      play()
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        play()
      },
      { threshold: 0.4 },
    )
    const loaderObserver = new MutationObserver(play)
    const loader = container.closest("[inert]")
    if (loader)
      loaderObserver.observe(loader, {
        attributes: true,
        attributeFilter: ["inert"],
      })
    if (revealPending)
      window.addEventListener("public-reveal-complete", onRevealComplete, {
        once: true,
      })
    observer.observe(container)
    return () => {
      observer.disconnect()
      loaderObserver.disconnect()
      window.removeEventListener("public-reveal-complete", onRevealComplete)
      animations.forEach((animation) => animation.stop())
    }
  }, [])

  return (
    <ul
      ref={statsRef}
      aria-label="Converyn at a glance"
      className="relative z-10 col-start-1 grid w-full max-w-[840px] grid-cols-3 overflow-hidden rounded-md border border-[#203f8c]/15 bg-transparent [margin:22px_0_0] p-0 list-none max-[761px]:mt-0"
    >
      {stats.map(({ value, label, suffix, decimals }) => (
        <li
          key={label}
          className="flex min-w-0 flex-col items-center justify-center border-r border-[#203f8c]/15 px-4 py-7 text-center last:border-r-0 max-[761px]:px-2 max-[761px]:py-5"
        >
          <span
            aria-hidden="true"
            className="block text-[clamp(32px,3vw,40px)] leading-none font-medium tracking-[-0.05em] text-[#203f8c] [font-variant-numeric:tabular-nums]"
          >
            <span data-stat-value>{(0).toFixed(decimals)}</span>
            <span className="text-[0.5em] tracking-normal text-[#203f8c]/60">
              {suffix}
            </span>
          </span>
          <span className="sr-only">
            {value}
            {suffix === "★" ? " out of 5" : suffix}{" "}
          </span>
          <span className="mt-2 block max-w-[190px] text-[10px] leading-[1.4] tracking-[0.08em] text-[#203f8c]/65 uppercase max-[761px]:text-[9px]">
            {label}
          </span>
        </li>
      ))}
    </ul>
  )
}
