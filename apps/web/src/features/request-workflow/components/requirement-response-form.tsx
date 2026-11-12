"use client"

import { Form } from "@/components/ui/form"

import { useRef, useState } from "react"
import { Upload } from "lucide-react"
import { sileo } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { WorkflowRequirement } from "../model/workflow"
import { AttachmentPreview, attachmentAccept } from "./attachment-preview"
import {
  WorkflowField,
  workflowButton,
  workflowInput,
} from "./workflow-primitives"

export function RequirementResponseForm({
  requirement,
  controls,
}: {
  requirement: WorkflowRequirement
  controls: WorkflowControls
}) {
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploads = useRef(new Map<File, string>())
  const inFlight = useRef(false)
  const busy = submitting || controls.busy

  return (
    <Form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (inFlight.current || controls.busy) return
        const form = event.currentTarget
        const submission = String(new FormData(form).get("submission") || "")
        if (!submission.trim() && !files.length) {
          sileo.error({ title: "Enter a response or attach 1–5 files" })
          return
        }
        inFlight.current = true
        setSubmitting(true)
        try {
          const fileIds: string[] = []
          for (const file of files) {
            let id = uploads.current.get(file)
            if (!id) {
              const uploaded = await controls.attach(file, true)
              if (!uploaded) return
              id = uploaded.id
              uploads.current.set(file, id)
            }
            fileIds.push(id)
          }
          if (
            await controls.act({
              type: "SUBMIT_REQUIREMENT",
              requirementId: requirement.id,
              submission,
              ...(fileIds.length ? { fileIds } : {}),
            })
          ) {
            form.reset()
            setFiles([])
            uploads.current.clear()
          }
        } finally {
          inFlight.current = false
          setSubmitting(false)
        }
      }}
    >
      <WorkflowField label="Your response">
        <textarea
          name="submission"
          rows={2}
          maxLength={4000}
          defaultValue={requirement.submission || ""}
          className={workflowInput}
          disabled={busy}
        />
      </WorkflowField>
      <WorkflowField label="Supporting documents (1–5 files)" asGroup>
        <div className="grid gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            aria-label="Upload documents"
            accept={attachmentAccept}
            disabled={busy || files.length === 5}
            className="sr-only"
            onChange={(event) => {
              const selected = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ""
              const additions = selected.filter(
                (file) =>
                  !files.some(
                    (existing) =>
                      existing.name === file.name &&
                      existing.size === file.size &&
                      existing.lastModified === file.lastModified,
                  ),
              )
              if (files.length + additions.length > 5) {
                sileo.error({ title: "Attach up to 5 files per response" })
                return
              }
              if (
                additions.some(
                  (file) =>
                    !file.size ||
                    file.size > 5 * 1024 * 1024 ||
                    !attachmentAccept
                      .split(",")
                      .some((extension) =>
                        file.name.toLowerCase().endsWith(extension),
                      ),
                )
              ) {
                sileo.error({
                  title: "Choose supported documents",
                  description:
                    "Select nonempty PDF, Word, PNG, JPEG or text files up to 5 MB each.",
                })
                return
              }
              setFiles([...files, ...additions])
            }}
          />
          {files.map((file, index) => (
            <AttachmentPreview
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              file={file}
              disabled={busy}
              onRemove={() => {
                uploads.current.delete(file)
                setFiles(files.filter((item) => item !== file))
              }}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={busy || files.length === 5}
            className="h-11 w-fit gap-2 border-[#d8e1ef] px-4 text-xs text-[#203f8c]"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            {files.length ? "Add documents" : "Upload documents"}
          </Button>
          <span
            role="status"
            className="text-[11px] font-normal text-[#52627a]"
          >
            {busy
              ? "Uploading or saving…"
              : files.length
                ? `${files.length}/5 files · Ready to submit. Up to 5 MB each.`
                : "PDF, Word, PNG, JPEG or text. Up to 5 files, 5 MB each. Enter a response or attach files."}
          </span>
        </div>
      </WorkflowField>
      <Button variant="brand" className={workflowButton} disabled={busy}>
        Submit requirement
      </Button>
    </Form>
  )
}
