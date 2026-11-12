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
  fallback = "?",
}: {
  name: string | null | undefined
  className?: string
  imageUrl?: string | null
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
        "relative grid aspect-square size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e9edf6] text-[11px] font-semibold text-[#294a9b]",
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
        getInitials(name) || fallback
      )}
    </span>
  )
}
