"use client"

import type { ReactNode } from "react"
import Link, { useLinkStatus } from "next/link"
import { ArrowRight } from "lucide-react"
import { compactHeaderActionClass } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function LinkArrow() {
  // Pending only while a not-yet-prefetched route loads; fixed size, so no
  // layout shift when it starts pulsing.
  const { pending } = useLinkStatus()
  return (
    <ArrowRight
      aria-hidden="true"
      size={14}
      strokeWidth={2.25}
      className={cn(
        "flex-none transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none",
        pending && "translate-x-1 animate-pulse",
      )}
    />
  )
}

/**
 * Secondary page-header action that navigates within a module, e.g. an
 * Overview's "Manage departments". The arrow nudges on hover and the
 * navigation plays the module's directional slide (see ModuleTransition).
 */
export function PageHeaderLink({
  href,
  direction = "forward",
  children,
}: {
  href: string
  direction?: "forward" | "back"
  children: ReactNode
}) {
  return (
    <Button
      asChild
      variant="brand"
      size="header"
      className={cn(
        "group active:scale-[0.98] motion-reduce:active:scale-100",
        compactHeaderActionClass,
      )}
    >
      <Link
        href={href}
        transitionTypes={[direction === "forward" ? "nav-forward" : "nav-back"]}
      >
        {children}
        <LinkArrow />
      </Link>
    </Button>
  )
}
