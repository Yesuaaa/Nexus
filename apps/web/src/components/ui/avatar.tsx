"use client"

import { useState } from "react"
import { getInitials } from "@/lib/initials"
import { cn } from "@/lib/utils"

/**
 * Round avatar: the person's photo (HTTPS URLs only) or their initials,
 * falling back to initials if the image fails to load. Decorative
 * (`aria-hidden`); put the name in nearby text.
 */
export function Avatar({
  name,
  className,
  imageUrl,
  size = "default",
  initials,
  fallback = "?",
}: {
  name: string | null | undefined
  className?: string
  imageUrl?: string | null
  size?: "default" | "sm"
  initials?: string
  /** Shown when the name has no letters. */
  fallback?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(
    imageUrl?.startsWith("https://") && imageUrl !== failedUrl,
  )

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid aspect-square shrink-0 place-items-center overflow-hidden rounded-full bg-[#e9edf6] font-semibold text-[#294a9b]",
        size === "sm" ? "size-6 text-[9px]" : "size-9 text-[11px]",
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl!}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedUrl(imageUrl!)}
        />
      ) : (
        (initials ?? getInitials(name)) || fallback
      )}
    </span>
  )
}
