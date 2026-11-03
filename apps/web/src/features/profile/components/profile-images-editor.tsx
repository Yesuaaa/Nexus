"use client"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { ImagePlus, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadProfileImage, type Profile } from "../api/profile-api"
type ImageKind = "avatar" | "banner"
const labels = { avatar: "Profile picture", banner: "Cover banner" }
export function ProfileImagesEditor({
  profile,
  onApplied,
  onClose,
  onUploadingChange,
}: {
  profile: Profile
  onApplied: (profile: Profile) => void
  onClose: () => void
  onUploadingChange: (busy: boolean) => void
}) {
  const inputs = useRef<Partial<Record<ImageKind, HTMLInputElement | null>>>({})
  const readers = useRef<Partial<Record<ImageKind, FileReader>>>({})
  const [drafts, setDrafts] = useState<Partial<Record<ImageKind, string>>>({})
  const [reading, setReading] = useState<Partial<Record<ImageKind, boolean>>>(
    {},
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [failedPreview, setFailedPreview] = useState<
    Partial<Record<ImageKind, string>>
  >({})
  useEffect(
    () => () => {
      for (const reader of Object.values(readers.current)) {
        if (reader.readyState === FileReader.LOADING) reader.abort()
      }
    },
    [],
  )
  function choose(kind: ImageKind, file?: File) {
    if (!file) return
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size === 0 ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a JPEG, PNG, or WebP image up to 2 MB.")
      return
    }
    const previous = readers.current[kind]
    if (previous?.readyState === FileReader.LOADING) previous.abort()
    const reader = new FileReader()
    readers.current[kind] = reader
    setReading((current) => ({ ...current, [kind]: true }))
    setError("")
    reader.onload = () => {
      if (readers.current[kind] !== reader) return
      if (typeof reader.result === "string")
        setDrafts((current) => ({
          ...current,
          [kind]: reader.result as string,
        }))
      setReading((current) => ({ ...current, [kind]: false }))
    }
    reader.onerror = () => {
      if (readers.current[kind] !== reader) return
      setError(labels[kind] + " could not be read. Choose another image.")
      setReading((current) => ({ ...current, [kind]: false }))
    }
    reader.readAsDataURL(file)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy || Object.values(reading).some(Boolean)) return
    setBusy(true)
    onUploadingChange(true)
    setError("")
    const saved: string[] = []
    try {
      for (const kind of ["avatar", "banner"] as const) {
        const dataUrl = drafts[kind]
        if (!dataUrl) continue
        try {
          const result = await uploadProfileImage(kind, dataUrl)
          if (result.profile) onApplied(result.profile)
          setDrafts((current) => {
            const next = { ...current }
            delete next[kind]
            return next
          })
          saved.push(labels[kind])
        } catch (reason) {
          const detail =
            reason instanceof Error ? reason.message : "Please try again."
          setError(
            (saved.length ? saved.join(" and ") + " saved. " : "") +
              labels[kind] +
              " was not saved. " +
              detail,
          )
          return
        }
      }
      onClose()
    } finally {
      setBusy(false)
      onUploadingChange(false)
    }
  }
  const hasDraft = Boolean(drafts.avatar || drafts.banner)
  return (
    <section className="p-5 sm:p-6">
      <header className="mb-6">
        <h2 className="m-0 text-base font-semibold text-[#182235]">
          Profile photo & banner
        </h2>
        <p className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
          Choose your images, review the previews, then save your changes.
        </p>
      </header>
      <form onSubmit={save} className="grid gap-5">
        <fieldset
          disabled={busy}
          className="m-0 grid min-w-0 gap-5 border-0 p-0"
        >
          {(["avatar", "banner"] as const).map((kind) => {
            const preview =
              drafts[kind] ||
              (kind === "avatar" ? profile.imageUrl : profile.bannerUrl)
            return (
              <div
                key={kind}
                className="grid min-w-0 gap-3 rounded-xl border border-[#dce3ee] bg-[#f8faff] p-4"
              >
                <p className="m-0 text-xs font-semibold text-[#182235]">
                  {labels[kind]}
                </p>
                {preview && failedPreview[kind] !== preview ? (
                  <img
                    src={preview}
                    alt={labels[kind] + " preview"}
                    onError={() =>
                      setFailedPreview((current) => ({
                        ...current,
                        [kind]: preview,
                      }))
                    }
                    className={
                      kind === "avatar"
                        ? "size-24 rounded-full object-cover"
                        : "aspect-[3/1] w-full rounded-lg object-cover"
                    }
                  />
                ) : (
                  <div
                    className={
                      kind === "avatar"
                        ? "grid size-24 place-items-center rounded-full bg-[#e8eef8] text-[#667b9e]"
                        : "grid aspect-[3/1] w-full place-items-center rounded-lg bg-[#e8eef8] text-[#667b9e]"
                    }
                  >
                    {kind === "avatar" ? (
                      <UserRound size={28} aria-hidden="true" />
                    ) : (
                      <ImagePlus size={28} aria-hidden="true" />
                    )}
                  </div>
                )}
                <input
                  ref={(element) => {
                    inputs.current[kind] = element
                  }}
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={"Choose " + labels[kind].toLowerCase()}
                  onChange={(event) => {
                    choose(kind, event.currentTarget.files?.[0])
                    event.currentTarget.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-self-start text-xs"
                  aria-label={"Change " + labels[kind].toLowerCase()}
                  onClick={() => inputs.current[kind]?.click()}
                >
                  <ImagePlus size={15} aria-hidden="true" />
                  Change image
                </Button>
                <p className="m-0 text-[11px] leading-5 text-[#738096]">
                  JPEG, PNG, or WebP · Up to 2 MB ·{" "}
                  {kind === "avatar"
                    ? "A square image works best."
                    : "A wide image works best."}
                </p>
                {reading[kind] && (
                  <p role="status" className="m-0 text-xs text-[#52627a]">
                    Preparing preview…
                  </p>
                )}
              </div>
            )
          })}
        </fieldset>
        {error && (
          <p role="alert" className="m-0 text-xs leading-5 text-[#bc3649]">
            {error}
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t border-[#eceef1] pt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 text-xs"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="min-h-11 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
            disabled={busy || !hasDraft || Object.values(reading).some(Boolean)}
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </footer>
      </form>
    </section>
  )
}
