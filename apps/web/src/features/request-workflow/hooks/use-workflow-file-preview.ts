"use client"

import { useEffect, useState } from "react"
import { createWorkflowFilePreviewUrl } from "../api/workflow-api"

export function useWorkflowFilePreview(
  requestId: string,
  fileId: string,
  enabled: boolean,
) {
  const [preview, setPreview] = useState<{
    requestId: string
    fileId: string
    url: string
  } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let active = true
    let objectUrl: string | undefined

    void createWorkflowFilePreviewUrl(requestId, fileId)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setPreview({ requestId, fileId, url })
      })
      .catch(() => undefined)

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [enabled, fileId, requestId])

  return enabled &&
    preview?.requestId === requestId &&
    preview.fileId === fileId
    ? preview.url
    : undefined
}
