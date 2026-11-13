"use client"

import { useState } from "react"
import Link from "next/link"
import { FolderOpen, Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectDeliverableSubmissionDialog } from "@/features/project-workspace/components/project-deliverable-submission-dialog"
import type { InternalConversationHistory } from "../api/internal-conversations-api"

export function ProjectConversationTools({
  history,
  isClient,
  onSubmitted,
}: {
  history: InternalConversationHistory
  isClient: boolean
  onSubmitted: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  if (!history.project || !history.canSend || history.archived) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            aria-label="Open project tools"
            variant="brand"
            className="size-10 shrink-0 rounded-full p-0"
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[280px] rounded-xl border-[#dce3ee] bg-white p-2 text-[#203047] shadow-[0_12px_30px_rgb(18_36_73_/_16%)]"
        >
          <DropdownMenuLabel className="px-2.5 py-2 text-[10px] text-[#52627a]">
            Conversation tools
          </DropdownMenuLabel>
          <DropdownMenuItem
            asChild
            className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
          >
            <Link
              href={
                isClient
                  ? `/projects/${history.project.id}`
                  : `/project-workspace/${history.project.workspaceId}`
              }
            >
              <FolderOpen aria-hidden="true" />
              Open project
            </Link>
          </DropdownMenuItem>
          {history.canSubmitDeliverables && (
            <DropdownMenuItem
              onSelect={() => setSubmitting(true)}
              className="min-h-9 cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium focus:bg-[#f1f4fa] focus:text-[#203f8c]"
            >
              <Upload aria-hidden="true" />
              Submit deliverable
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {submitting && history.canSubmitDeliverables && (
        <ProjectDeliverableSubmissionDialog
          workspaceId={history.project.workspaceId}
          projectId={history.project.id}
          deliverables={history.deliverables ?? []}
          onClose={() => setSubmitting(false)}
          onSubmitted={onSubmitted}
        />
      )}
    </>
  )
}
