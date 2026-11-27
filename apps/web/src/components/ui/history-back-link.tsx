"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ComponentProps } from "react"

type HistoryBackLinkProps = Omit<
  ComponentProps<typeof Link>,
  "children" | "onNavigate"
>

export function HistoryBackLink({
  className = "inline-flex items-center gap-2.5 text-xs text-(color:--landing-muted) hover:text-[#203f8c]",
  ...props
}: HistoryBackLinkProps) {
  const router = useRouter()

  return (
    <Link
      {...props}
      className={className}
      onNavigate={(event) => {
        if (window.history.length <= 1) return
        event.preventDefault()
        router.back()
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Go Back
    </Link>
  )
}
