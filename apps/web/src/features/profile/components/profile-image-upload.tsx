"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Upload, X } from "lucide-react"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { uploadProfileImage, type Profile } from "../api/profile-api"
import { errorMessage } from "@/lib/error-message"

export function ProfileImageUpload({
  kind,
  value,
  label,
  onUploaded,
  onUploadingChange,
}: {
  kind: "avatar" | "banner" | "project"
  value?: string | null
  label: string
  onUploaded: (url: string, profile: Profile | null) => void
  onUploadingChange?: (busy: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const reader = useRef<FileReader | null>(null)
  const [selected, setSelected] = useState<{
    name: string
    dataUrl: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [failedUrl, setFailedUrl] = useState("")
  useEffect(
    () => () => {
      if (reader.current?.readyState === FileReader.LOADING)
        reader.current.abort()
    },
    [],
  )
  function choose(file?: File) {
    setError("")
    if (!file) return
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      setError("Choose a JPEG, PNG, or WebP image up to 2 MB.")
      return
    }
    if (reader.current?.readyState === FileReader.LOADING)
      reader.current.abort()
    const nextReader = new FileReader()
    reader.current = nextReader
    nextReader.onload = () => {
      if (typeof nextReader.result === "string") {
        const image = { name: file.name, dataUrl: nextReader.result }
        setSelected(image)
      }
    }
    nextReader.onerror = () =>
      setError("This image could not be read. Choose another file.")
    nextReader.readAsDataURL(file)
  }
  async function upload(image = selected) {
    if (!image || busy) return
    setBusy(true)
    onUploadingChange?.(true)
    setError("")
    try {
      const result = await uploadProfileImage(kind, image.dataUrl)
      onUploaded(result.url, result.profile)
      setSelected(null)
    } catch (reason) {
      setError(
        errorMessage(reason, "The image could not be uploaded. Try again."),
      )
    } finally {
      setBusy(false)
      onUploadingChange?.(false)
    }
  }
  const preview = selected?.dataUrl || value
  return (
    <div className="grid min-w-0 gap-3 rounded-xl border border-[#dce3ee] bg-[#f8faff] p-4">
      <p className="m-0 text-xs font-semibold text-[#182235]">{label}</p>
      {preview && preview !== failedUrl && (
        <img
          src={preview}
          alt={`${label} preview`}
          onError={() => setFailedUrl(preview)}
          className={
            kind === "avatar"
              ? "size-24 rounded-full object-cover"
              : `w-full rounded-lg object-cover ${kind === "banner" ? "aspect-[3/1]" : "aspect-[16/10] max-h-52"}`
          }
        />
      )}
      {selected && (
        <p className="m-0 break-all text-xs text-[#52627a]">
          {selected.name} · Not uploaded yet
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`Choose ${label.toLowerCase()}`}
        disabled={busy}
        onChange={(event) => {
          choose(event.currentTarget.files?.[0])
          event.currentTarget.value = ""
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 text-xs"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {kind === "project" ? (
            <ImagePlus size={15} aria-hidden="true" />
          ) : (
            <Upload size={15} aria-hidden="true" />
          )}
          {kind === "project"
            ? value || selected
              ? "Choose another image"
              : "Choose image"
            : busy
              ? "Uploading…"
              : "Upload image"}
        </Button>
        {selected && (
          <>
            <Button
              type="button"
              variant="brand"
              size="touch"
              disabled={busy}
              onClick={() => void upload()}
            >
              <Upload size={15} aria-hidden="true" />
              {busy ? "Saving…" : kind === "project" ? "Upload image" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="size-11 p-0"
              aria-label="Remove selected image"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <X size={15} aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
      <p className="m-0 text-[11px] leading-5 text-[#738096]">
        JPEG, PNG, or WebP · Up to 2 MB
        {kind === "banner"
          ? " · A wide image works best."
          : kind === "avatar"
            ? " · A square image works best."
            : ". Upload the image, then save your specialist profile."}
      </p>
      {error && (
        <Alert variant="text" className="leading-5">
          {error}
        </Alert>
      )}
    </div>
  )
}
