"use client"

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { gsap } from "gsap"
import {
  subscribeToasts,
  getToastSnapshot,
  getServerToastSnapshot,
} from "@/lib/toast"

const ToastViewport = dynamic(
  () =>
    import("../components/toast-viewport").then(
      (module) => module.ToastViewport,
    ),
  { ssr: false },
)

// The root layout keeps toasts and the module-selector reveal alive across navigation.
export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const moduleReveal = useRef<{
    cleanup: () => void
    start: () => void
  } | null>(null)
  useEffect(() => {
    if (pathname !== "/module") moduleReveal.current?.start()
  }, [pathname])
  useEffect(() => () => moduleReveal.current?.cleanup(), [])

  function beginModuleReveal(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest<HTMLAnchorElement>(
      'a[aria-label^="Open "][aria-label$=" workspace"]',
    )
    if (
      !link ||
      pathname !== "/module" ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const shell = link.closest<HTMLElement>("main")?.parentElement
    if (!shell || moduleReveal.current) return
    const app = event.currentTarget
    app.inert = true
    const point = event.detail === 0 ? link.getBoundingClientRect() : null
    const x = point ? point.left + point.width / 2 : event.clientX
    const y = point ? point.top + point.height / 2 : event.clientY
    const overlay = document.createElement("div")
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100;overflow:hidden;touch-action:none"
    overlay.setAttribute("aria-hidden", "true")
    const snapshot = shell.cloneNode(true) as HTMLElement
    snapshot.inert = true
    overlay.append(snapshot)
    const ns = "http://www.w3.org/2000/svg"
    const svg = document.createElementNS(ns, "svg")
    svg.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none"
    const mask = document.createElementNS(ns, "mask")
    mask.id = "module-reveal-mask"
    const base = document.createElementNS(ns, "rect")
    const hole = document.createElementNS(ns, "rect")
    for (const rect of [base, hole]) {
      rect.setAttribute("width", "100%")
      rect.setAttribute("height", "100%")
    }
    base.setAttribute("fill", "white")
    hole.setAttribute("fill", "black")
    mask.append(base, hole)
    svg.append(mask)
    overlay.append(svg)
    document.body.append(overlay)
    let animation: gsap.core.Tween | undefined
    const progress = { value: 0 }
    const render = () => {
      const radius =
        Math.ceil(
          Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)),
        ) + 1
      gsap.set(hole, {
        clipPath: `circle(${radius * progress.value}px at ${x}px ${y}px)`,
      })
    }
    render()
    snapshot.style.maskImage = `url(#${mask.id})`
    const cleanup = () => {
      animation?.kill()
      window.removeEventListener("resize", render)
      overlay.remove()
      app.inert = false
      moduleReveal.current = null
    }
    const start = () => {
      if (animation) return
      animation = gsap.to(progress, {
        value: 1,
        duration: 1.1,
        ease: "power2.inOut",
        onUpdate: render,
        onComplete: cleanup,
      })
    }
    window.addEventListener("resize", render)
    moduleReveal.current = { cleanup, start }
  }
  const showToasts = useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    getServerToastSnapshot,
  )
  return (
    <div className="contents" onClick={beginModuleReveal}>
      <div
        className={
          pathname === "/login" || pathname === "/register"
            ? "auth-toast-region"
            : undefined
        }
      >
        {showToasts && <ToastViewport />}
      </div>
      {children}
    </div>
  )
}
