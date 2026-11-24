import { gsap } from "gsap"
import type { PublicService } from "../model/types"

let pending: {
  service: PublicService
  image: HTMLImageElement
  origin: DOMRect
  naturalWidth: number
  naturalHeight: number
  timeout: number
  frame: number
  clear: () => void
} | null = null

export function startServiceImageTransition(
  service: PublicService,
  source: HTMLImageElement | null,
) {
  pending?.clear()
  if (
    !source?.naturalWidth ||
    !source.naturalHeight ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return

  const origin = source.getBoundingClientRect()
  const { left, top, width, height, bottom, right } = origin
  if (
    !width ||
    !height ||
    bottom <= 0 ||
    right <= 0 ||
    top >= window.innerHeight ||
    left >= window.innerWidth
  )
    return

  const image = new window.Image()
  image.src = source.currentSrc
  image.alt = ""
  image.setAttribute("aria-hidden", "true")
  image.setAttribute("data-service-image-flight", "")
  Object.assign(image.style, {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: "none",
    objectFit: "cover",
    borderRadius: "0px",
    pointerEvents: "none",
    zIndex: "100",
  })
  document.body.append(image)

  const timeout = window.setTimeout(clear, 3000)
  function clear() {
    window.clearTimeout(timeout)
    window.removeEventListener("pagehide", clear)
    image.remove()
    if (pending?.image === image) {
      window.cancelAnimationFrame(pending.frame)
      pending = null
    }
  }
  pending = {
    service,
    image,
    origin,
    naturalWidth: source.naturalWidth,
    naturalHeight: source.naturalHeight,
    timeout,
    frame: 0,
    clear,
  }
  window.addEventListener("pagehide", clear)
}

export function getServiceImagePreview(serviceId: string) {
  return pending?.service.id === serviceId ? pending.service : undefined
}

export function cancelServiceImageTransition(serviceId: string) {
  if (pending?.service.id === serviceId) pending.clear()
}

function coverBounds(
  frame: DOMRect,
  naturalWidth: number,
  naturalHeight: number,
) {
  const scale = Math.max(
    frame.width / naturalWidth,
    frame.height / naturalHeight,
  )
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  const insetX = Math.max(0, (width - frame.width) / 2)
  const insetY = Math.max(0, (height - frame.height) / 2)
  return {
    scale,
    width,
    height,
    left: frame.left - insetX,
    top: frame.top - insetY,
    insetX,
    insetY,
  }
}

export function finishServiceImageTransition(
  serviceId: string,
  target: HTMLImageElement,
) {
  const transition = pending
  if (transition?.service.id !== serviceId || transition.frame) return
  // Measure after the destination route has committed and placed its scroll position.
  transition.frame = window.requestAnimationFrame(() =>
    animate(target, transition),
  )
}

function animate(
  target: HTMLImageElement,
  transition: NonNullable<typeof pending>,
) {
  const { image, clear, origin, naturalWidth, naturalHeight } = transition
  const destination = target.getBoundingClientRect()
  if (
    !destination.width ||
    !destination.height ||
    image.src !== target.currentSrc
  ) {
    clear()
    return
  }

  pending = null
  window.clearTimeout(transition.timeout)
  const from = coverBounds(origin, naturalWidth, naturalHeight)
  const to = coverBounds(destination, naturalWidth, naturalHeight)
  const scale = from.scale / to.scale
  const radius = target.parentElement
    ? getComputedStyle(target.parentElement).borderRadius
    : "0px"
  const { scrollX, scrollY } = window

  // Size the image once and animate its position, scale, and visible crop.
  gsap.set(image, {
    left: to.left,
    top: to.top,
    width: to.width,
    height: to.height,
    transformOrigin: "0 0",
    x: from.left - to.left,
    y: from.top - to.top,
    scale,
    clipPath: `inset(${from.insetY / scale}px ${from.insetX / scale}px round 0px)`,
  })

  const restore = () => {
    window.removeEventListener("resize", interrupt)
    window.removeEventListener("scroll", interruptOnScroll)
    window.removeEventListener("pagehide", interrupt)
    clear()
  }
  const tween = gsap.to(image, {
    x: 0,
    y: 0,
    scale: 1,
    clipPath: `inset(${to.insetY}px ${to.insetX}px round ${radius})`,
    duration: 0.48,
    ease: "power2.inOut",
    onComplete: restore,
    onInterrupt: restore,
  })
  function interrupt() {
    tween.kill()
  }
  function interruptOnScroll() {
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) interrupt()
  }
  window.addEventListener("resize", interrupt)
  window.addEventListener("scroll", interruptOnScroll)
  window.addEventListener("pagehide", interrupt)
}
