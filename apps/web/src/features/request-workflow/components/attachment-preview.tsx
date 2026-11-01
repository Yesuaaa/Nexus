"use client"

import { useEffect, useState } from "react"
import { FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export const attachmentAccept = ".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"

export function AttachmentPreview({
  file,
  onRemove,
  disabled = false,
}: {
  file: File
  onRemove: () => void
  disabled?: boolean
}) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  )
  const url = preview?.file === file ? preview.url : ""
  useEffect(() => {
    if (file.size > 5 * 1024 * 1024 || !/\.(png|jpe?g|pdf)$/i.test(file.name))
      return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string")
        setPreview({ file, url: reader.result })
    }
    reader.readAsDataURL(file)
    return () => {
      reader.onload = null
      if (reader.readyState === FileReader.LOADING) reader.abort()
    }
  }, [file])
  return (
    <div className="space-y-2 rounded-xl border border-[#d8e1ef] bg-[#f6f8fc] p-3">
      <div className="flex items-center gap-3">
        <FileText size={18} className="shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="m-0 break-all text-xs font-medium">{file.name}</p>
          <p className="m-0 text-[11px] text-[#52627a]">
            {file.name.split(".").at(-1)?.toUpperCase()} ·{" "}
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="size-11 shrink-0 p-0"
          aria-label={`Remove ${file.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <X size={16} />
        </Button>
      </div>
      {url && /\.(png|jpe?g)$/i.test(file.name) && (
        <img
          src={url}
          alt={`Preview of ${file.name}`}
          className="max-h-56 w-full rounded-lg object-contain"
        />
      )}
      {url && /\.pdf$/i.test(file.name) && (
        <iframe
          src={url}
          title={`Preview of ${file.name}`}
          className="h-56 w-full rounded-lg border-0"
          sandbox=""
        />
      )}
    </div>
  )
}
