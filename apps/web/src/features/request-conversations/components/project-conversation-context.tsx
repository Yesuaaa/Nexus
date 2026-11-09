"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import type { ProjectConversationDetails } from "../model/project-conversation"
import { ConversationAvatar } from "./conversation-avatar"

type ProjectConversationParticipant = {
  id: string
  fullName: string | null
}

export function ProjectConversationContext({
  project,
  participants,
  accountId,
  isClient,
}: {
  project: ProjectConversationDetails
  participants: ProjectConversationParticipant[]
  accountId: string
  isClient: boolean
}) {
  const { formatDate } = useDatePreferences()
  const projectStatus = project.status.toLowerCase().replaceAll("_", " ")

  return (
    <>
      <section className="border-b border-[#e8ebef] py-3">
        <h3 className="m-0 text-xs font-semibold text-[#182235]">
          Conversation details
        </h3>
        <div className="mt-3 flex items-center gap-3">
          <ConversationAvatar name={project.name} className="size-10" />
          <div className="min-w-0">
            <p className="m-0 truncate text-xs font-semibold text-[#182235]">
              {project.name}
            </p>
            <p className="mt-0.5 mb-0 text-[10px] text-[#8791a2]">
              Project team
            </p>
          </div>
        </div>
        <dl className="mt-3 mb-0 grid gap-2 text-[11px]">
          {[
            ["Status", projectStatus],
            ["Service", project.serviceName || "Not linked to a service"],
            ["Reference", project.referenceNumber || "Not provided"],
            [
              "Started",
              project.startDate ? formatDate(project.startDate) : "Not started",
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <dt className="text-[#8791a2]">{label}</dt>
              <dd className="m-0 text-right font-medium text-[#182235] capitalize [overflow-wrap:anywhere]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="border-b border-[#e8ebef] py-3">
        <h3 className="m-0 text-xs font-semibold text-[#182235]">
          Project brief
        </h3>
        <p className="mt-2 mb-0 text-[11px] leading-5 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
          {project.description || "No project brief provided."}
        </p>
      </section>
      <section className="border-b border-[#e8ebef] py-3">
        <h3 className="m-0 text-xs font-semibold text-[#182235]">
          Participants
        </h3>
        <ul className="m-0 mt-3 list-none space-y-2 p-0">
          {participants.map((person) => (
            <li key={person.id} className="flex items-center gap-3">
              <ConversationAvatar
                name={person.fullName || "Participant"}
                className="size-8"
              />
              <span className="min-w-0 truncate text-[11px] font-medium text-[#182235]">
                {person.fullName || "Participant"}
                {person.id === accountId && (
                  <span className="ml-1 font-normal text-[#52627a]">(you)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="py-3">
        <Button
          asChild
          className="w-full bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
        >
          <Link
            href={
              isClient
                ? `/projects/${encodeURIComponent(project.id)}`
                : `/project-workspace/${encodeURIComponent(project.workspaceId)}`
            }
          >
            Open project
          </Link>
        </Button>
      </div>
    </>
  )
}
