"use client"

import Lenis from "lenis"
import "lenis/dist/lenis.css"
import { useEffect } from "react"

export function LandingSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      allowNestedScroll: true,
      anchors: true,
      respectReducedMotion: true,
      stopInertiaOnNavigate: true,
    })

    return () => lenis.destroy()
  }, [])

  return null
}
