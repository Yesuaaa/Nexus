import Image from "next/image"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  isShowcaseImage,
  type ShowcaseImageLayout,
} from "../model/showcase-images"

const slots = ["a", "b", "c", "d", "e"]

export function ShowcaseImageGrid({
  layout,
  images = [],
  thumbnail = false,
  className,
  renderSlot,
}: {
  layout: ShowcaseImageLayout
  images?: string[]
  thumbnail?: boolean
  className?: string
  renderSlot?: (index: number, src: string | undefined) => ReactNode
}) {
  const columns = layout.rows[0].split(" ").length
  return (
    <span
      className={cn(
        "grid gap-1.5 sm:gap-3",
        thumbnail ? "h-10 max-w-full gap-0.5 sm:gap-0.5" : "mx-auto w-full",
        className,
      )}
      style={{
        aspectRatio: layout.ratio,
        maxWidth:
          !thumbnail && "maxWidth" in layout ? layout.maxWidth : undefined,
        gridTemplateAreas: layout.rows.map((row) => `"${row}"`).join(" "),
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${layout.rows.length}, minmax(0, 1fr))`,
      }}
    >
      {slots.slice(0, layout.count).map((slot, index) => {
        const src = images[index]?.trim()
        return (
          <span
            key={slot}
            className="relative min-h-0 min-w-0 overflow-hidden rounded-sm bg-slate-200"
            style={{ gridArea: slot }}
          >
            {!thumbnail &&
              src &&
              (isShowcaseImage(src) ||
                src.startsWith("data:image/webp;base64,")) && (
                <Image
                  src={src}
                  unoptimized={
                    src.startsWith("https://") || src.startsWith("data:")
                  }
                  alt=""
                  fill
                  sizes="(max-width: 1360px) 100vw, 1360px"
                  className="object-cover"
                />
              )}
            {renderSlot?.(index, src)}
          </span>
        )
      })}
    </span>
  )
}
