"use client"

import { Button } from "@/components/ui/button"
import { SidePanelFieldset, SidePanelSection } from "@/components/ui/side-panel"
import { sileo } from "@/lib/toast"
import { ChevronDown, Upload } from "lucide-react"
import { useId, useRef, useState } from "react"
import { imageAsWebp } from "@/lib/image-as-webp"
import {
  showcaseImageLayouts,
  type ShowcaseImageLayout,
} from "../model/showcase-images"
import { ShowcaseImageGrid } from "./showcase-image-grid"

const maxImageSize = 2 * 1024 * 1024

export function ShowcaseImagesFields({
  layout,
  images,
  onLayoutChange,
  onImageChange,
  onProcessingChange,
  disabled,
}: {
  layout: ShowcaseImageLayout
  images: string[]
  onLayoutChange: (layout: ShowcaseImageLayout) => void
  onImageChange: (index: number, value: string) => void
  onProcessingChange: (processing: boolean) => void
  disabled: boolean
}) {
  const [openCount, setOpenCount] = useState<number | null>(layout.count)
  const panelId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedSlot = useRef(0)
  const uploadSequence = useRef(0)

  async function selectFile(file: File | undefined) {
    if (!file) return
    const sequence = ++uploadSequence.current
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > maxImageSize ||
      file.size === 0
    ) {
      sileo.error({ title: "Choose a JPG, PNG, or WebP image up to 2 MB." })
      return
    }
    const slot = selectedSlot.current
    onProcessingChange(true)
    let image: Blob
    try {
      image = await imageAsWebp(file)
    } catch {
      if (sequence === uploadSequence.current)
        sileo.error({
          title: "The selected image could not be converted to WebP.",
        })
      onProcessingChange(false)
      return
    }
    if (sequence !== uploadSequence.current) {
      onProcessingChange(false)
      return
    }
    if (image.size === 0 || image.size > maxImageSize) {
      sileo.error({
        title: "The converted WebP image must be no larger than 2 MB.",
      })
      onProcessingChange(false)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (
        sequence === uploadSequence.current &&
        typeof reader.result === "string"
      ) {
        onImageChange(slot, reader.result)
      }
      onProcessingChange(false)
    }
    reader.onerror = () => {
      if (sequence === uploadSequence.current)
        sileo.error({ title: "The selected image could not be read." })
      onProcessingChange(false)
    }
    reader.readAsDataURL(image)
  }

  return (
    <div className="grid min-w-0 gap-5">
      <SidePanelFieldset
        title="Gallery layout"
        className="grid-cols-1 gap-y-3 sm:grid-cols-1 [&>legend]:sm:col-span-1"
      >
        {[1, 2, 3, 4, 5].map((count) => (
          <div key={count} className="border-b border-[#eceef1]">
            <button
              type="button"
              disabled={disabled}
              aria-expanded={openCount === count}
              aria-controls={`${panelId}-${count}`}
              onClick={() => setOpenCount(openCount === count ? null : count)}
              className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c] disabled:opacity-50"
            >
              {count === 1 ? "1 image" : `${count} images`}
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`transition-transform motion-reduce:transition-none ${openCount === count ? "rotate-180" : ""}`}
              />
            </button>
            <div
              id={`${panelId}-${count}`}
              hidden={openCount !== count}
              role="group"
              aria-label={`${count} image layouts`}
              className="pb-4"
            >
              <div className="grid grid-cols-3 gap-2">
                {showcaseImageLayouts
                  .filter(
                    (choice) =>
                      choice.count === count && choice.id !== "single-portrait",
                  )
                  .map((choice) => (
                    <Button
                      key={choice.id}
                      type="button"
                      variant={
                        choice.id === layout.id ? "brand" : "brandOutline"
                      }
                      aria-pressed={choice.id === layout.id}
                      disabled={disabled}
                      onClick={() => onLayoutChange(choice)}
                      className="h-auto min-w-0 flex-col gap-1.5 px-2 py-2 text-center text-xs whitespace-normal"
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-10 w-full place-items-center"
                      >
                        <ShowcaseImageGrid layout={choice} thumbnail />
                      </span>
                      {choice.label}
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </SidePanelFieldset>
      <SidePanelSection title="Gallery preview">
        <p className="text-xs text-muted-foreground">
          Select a slot to upload a JPG, PNG, or WebP image up to 2 MB. JPG and
          PNG images are converted to WebP. The first image is the cover.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Choose gallery image"
          onChange={(event) => {
            selectFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        <ShowcaseImageGrid
          layout={layout}
          images={images}
          renderSlot={(index, src) => (
            <button
              type="button"
              disabled={disabled}
              aria-label={`${src ? "Replace" : "Upload"} ${index === 0 ? "cover image" : `image ${index + 1}`}`}
              onClick={() => {
                selectedSlot.current = index
                inputRef.current?.click()
              }}
              className="absolute inset-0 flex cursor-pointer items-center justify-center gap-1 bg-black/30 p-1 text-xs text-white hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#203f8c] disabled:cursor-not-allowed"
            >
              <Upload size={16} aria-hidden="true" />{" "}
              <span>{src ? "Replace" : "Upload"}</span>
            </button>
          )}
        />
      </SidePanelSection>
    </div>
  )
}
