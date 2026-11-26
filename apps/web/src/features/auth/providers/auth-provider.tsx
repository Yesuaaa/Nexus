"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react"
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
    origin: string
    start: () => void
  } | null>(null)
  useLayoutEffect(() => {
    if (moduleReveal.current && pathname !== moduleReveal.current.origin)
      moduleReveal.current.start()
  }, [pathname])
  useEffect(() => () => moduleReveal.current?.cleanup(), [])

  function beginModuleReveal(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest<HTMLAnchorElement>("a[href]")
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const destination = new URL(link.href, window.location.href)
    const page = link.closest<HTMLElement>("[data-landing-page]")
    const landing = pathname === "/" ? page : null
    const isPublicNavigation = Boolean(link.closest("header, footer"))
    const publicServicesPage =
      (/^\/explore\/(?:services|projects)(?:\/|$)/.test(pathname) ||
        pathname === "/about") &&
      (isPublicNavigation ||
        link.hasAttribute("data-service-card-link") ||
        link.hasAttribute("data-service-inquiry-link") ||
        link.hasAttribute("data-service-back-link"))
        ? page
        : null
    const authPage =
      (pathname === "/login" || pathname === "/register") &&
      link.hasAttribute("data-auth-home-link")
        ? link.closest<HTMLElement>("main")
        : null
    const isWorkspaceLink =
      pathname === "/module" &&
      link.matches('a[aria-label^="Open "][aria-label$=" workspace"]')
    const isLandingSectionLink = Boolean(
      landing && isPublicNavigation && destination.hash,
    )
    const samePage = destination.pathname === pathname
    if (
      landing &&
      samePage &&
      link.getAttribute("aria-label") === "Converyn home"
    )
      return
    if (
      (!landing && !publicServicesPage && !authPage && !isWorkspaceLink) ||
      destination.origin !== window.location.origin ||
      (samePage && !isLandingSectionLink) ||
      (link.target && link.target !== "_self") ||
      link.hasAttribute("download")
    )
      return
    const shell =
      landing ||
      publicServicesPage ||
      authPage ||
      link.closest<HTMLElement>("main")?.parentElement
    if (!shell || moduleReveal.current) return
    const app = event.currentTarget
    const waitForPublicPage = Boolean(
      !samePage && (landing || publicServicesPage || authPage),
    )
    if (!waitForPublicPage) app.inert = true
    const point = event.detail === 0 ? link.getBoundingClientRect() : null
    const x = point ? point.left + point.width / 2 : event.clientX
    const y = point ? point.top + point.height / 2 : event.clientY
    const overlay = document.createElement("div")
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100;overflow:hidden;touch-action:none"
    if (waitForPublicPage) overlay.style.visibility = "hidden"
    overlay.setAttribute("aria-hidden", "true")
    const snapshot = shell.cloneNode(true) as HTMLElement
    snapshot.inert = true
    if (landing || publicServicesPage || authPage) {
      const bounds = shell.getBoundingClientRect()
      snapshot.style.position = "absolute"
      snapshot.style.top = `${bounds.top}px`
      snapshot.style.left = `${bounds.left}px`
      snapshot.style.width = `${bounds.width}px`
      snapshot.style.margin = "0"
    }
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
    const timeout = window.setTimeout(() => cleanup(), 10000)
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
    overlay.style.maskImage = `url(#${mask.id})`
    const cleanup = () => {
      animation?.kill()
      window.clearTimeout(timeout)
      window.removeEventListener("resize", render)
      overlay.remove()
      app.inert = false
      moduleReveal.current = null
    }
    const start = () => {
      if (animation) return
      overlay.style.visibility = ""
      app.inert = true
      animation = gsap.to(progress, {
        value: 1,
        duration: 1.1,
        ease: "power2.inOut",
        onUpdate: render,
        onComplete: cleanup,
      })
    }
    window.addEventListener("resize", render)
    moduleReveal.current = { cleanup, origin: pathname, start }
    if (samePage) {
      window.requestAnimationFrame(() => window.requestAnimationFrame(start))
    }
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
