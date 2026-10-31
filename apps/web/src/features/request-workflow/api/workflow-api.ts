import { apiRequest, apiStreamRequest } from "@/features/auth/api/auth-api"
import type { Workflow, WorkflowAction, WorkflowFile } from "../model/workflow"

const path = (id: string) => `/api/request-workflows/${encodeURIComponent(id)}`

export function getWorkflow(id: string, signal?: AbortSignal) {
  return apiRequest<Workflow>(path(id), { signal })
}

export function performWorkflowAction(
  id: string,
  action: WorkflowAction & { actionId: string; expectedVersion: number },
) {
  return apiRequest<Workflow>(`${path(id)}/actions`, {
    method: "POST",
    body: JSON.stringify(action),
  })
}

export async function uploadWorkflowFile(
  id: string,
  file: File,
  uploadId: string,
) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a file smaller than 5 MB.")
  const types: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    txt: "text/plain",
  }
  const mimeType =
    file.type || types[file.name.split(".").at(-1)?.toLowerCase() || ""]
  if (!mimeType || !Object.values(types).includes(mimeType))
    throw new Error("Choose a PDF, PNG, JPEG, or plain text file.")
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Couldn't read this file."))
    reader.onload = () => {
      const value = reader.result
      if (typeof value !== "string")
        return reject(new Error("Couldn't read this file."))
      resolve(value.slice(value.indexOf(",") + 1))
    }
    reader.readAsDataURL(file)
  })
  const result = await apiRequest<{ file: WorkflowFile }>(`${path(id)}/files`, {
    method: "POST",
    body: JSON.stringify({
      uploadId,
      name: file.name,
      mimeType,
      content,
    }),
  })
  return result.file
}

export async function downloadWorkflowFile(
  requestId: string,
  file: WorkflowFile,
) {
  const response = await apiStreamRequest(
    `${path(requestId)}/files/${encodeURIComponent(file.id)}`,
  )
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
