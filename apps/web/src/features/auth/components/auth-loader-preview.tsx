"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  ConverynLogoReveal,
  type ConverynLogoRevealHandle,
} from "./converyn-logo-reveal"

export function AuthLoaderPreview() {
  const logo = useRef<ConverynLogoRevealHandle>(null)

  return (
    <main className="relative grid min-h-dvh place-items-center bg-background">
      <ConverynLogoReveal ref={logo} />
      <Button
        type="button"
        variant="brandOutline"
        className="absolute bottom-8"
        onClick={() => logo.current?.replay()}
      >
        Replay logo reveal
      </Button>
    </main>
  )
}
