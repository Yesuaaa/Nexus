"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"

const stats = [
  { value: 98, label: "Satisfaction", suffix: "%", decimals: 0 },
  { value: 120, label: "Projects built", suffix: "+", decimals: 0 },
  { value: 4.9, label: "Average rating", suffix: "★", decimals: 1 },
]

export function HeroStats() {
  const statsRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const container = statsRef.current
    if (
      !container ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return

    let visible = false
    let played = false
    const animations: gsap.core.Tween[] = []
    const play = () => {
      if (played || !visible || container.closest("[inert]")) return
      played = true
      container
        .querySelectorAll<HTMLElement>("[data-stat-value]")
        .forEach((element, index) => {
          const counter = { value: 0 }
          element.textContent = (0).toFixed(stats[index].decimals)
          animations.push(
            gsap.to(counter, {
              value: stats[index].value,
              duration: 1.4,
              delay: index * 0.12,
              ease: "power2.out",
              onUpdate: () => {
                element.textContent = counter.value.toFixed(
                  stats[index].decimals,
                )
              },
            }),
          )
        })
      observer.disconnect()
      loaderObserver.disconnect()
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
    observer.observe(container)
    return () => {
      observer.disconnect()
      loaderObserver.disconnect()
      animations.forEach((animation) => animation.kill())
    }
  }, [])

  return (
    <ul
      ref={statsRef}
      aria-label="Converyn at a glance"
      className="relative z-10 col-start-1 grid w-full max-w-[840px] grid-cols-3 overflow-hidden rounded-md border border-white/15 bg-[#121214]/85 backdrop-blur-md [margin:22px_0_0] p-0 list-none max-[761px]:mt-0"
    >
      {stats.map(({ value, label, suffix, decimals }) => (
        <li
          key={label}
          className="flex min-w-0 flex-col items-center justify-center border-r border-white/10 px-4 py-7 text-center last:border-r-0 max-[761px]:px-2 max-[761px]:py-5"
        >
          <span
            aria-hidden="true"
            className="block text-[clamp(32px,3vw,40px)] leading-none font-medium tracking-[-0.05em] text-white [font-variant-numeric:tabular-nums]"
          >
            <span data-stat-value>{value.toFixed(decimals)}</span>
            <span className="text-[0.5em] tracking-normal text-white/55">
              {suffix}
            </span>
          </span>
          <span className="sr-only">
            {value}
            {suffix === "★" ? " out of 5" : suffix}{" "}
          </span>
          <span className="mt-2 block max-w-[190px] text-[10px] leading-[1.4] tracking-[0.08em] text-white/55 uppercase max-[761px]:text-[9px]">
            {label}
          </span>
        </li>
      ))}
    </ul>
  )
}
