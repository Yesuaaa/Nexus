import type { ReactNode } from "react"
import {
  DetailItem,
  DetailList,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { RequestMessagesLink } from "@/features/request-conversations/components/request-messages-link"

/**
 * Body of a service request side panel (bookings, request inbox, client
 * request history): title and status, the stacked detail list, the project
 * brief sections, an availability note and the request workspace link.
 */
export function RequestDetailsBody({
  title,
  status,
  statusNote,
  fields,
  sections,
  note,
  messagesRequestId,
}: {
  title: string
  /** Status pill. */
  status: ReactNode
  /** Optional line under the status pill. */
  statusNote?: ReactNode
  fields: [label: string, value: ReactNode][]
  /** Long-form answers; an empty value shows "Not provided". */
  sections: [title: string, value: string | null | undefined][]
  note: ReactNode
  /** Shows the "Open request workspace" link for this request when set. */
  messagesRequestId?: string | null
}) {
  return (
    <>
      <div>
        <h2 className="m-0 text-base font-semibold break-words">{title}</h2>
        <div className="mt-3">{status}</div>
        {statusNote && (
          <p className="mt-2 mb-0 text-xs leading-5 text-[#52627a]">
            {statusNote}
          </p>
        )}
      </div>
      <DetailList layout="stacked">
        {fields.map(([label, value]) => (
          <DetailItem key={label} label={label}>
            {value}
          </DetailItem>
        ))}
      </DetailList>
      {sections.map(([sectionTitle, value]) => (
        <SidePanelSection key={sectionTitle} title={sectionTitle}>
          <p className="m-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
            {value || "Not provided"}
          </p>
        </SidePanelSection>
      ))}
      <div>
        <p className="m-0 rounded-lg bg-[#f8fafd] p-3 text-[11px] leading-relaxed text-[#52627a]">
          {note}
        </p>
        {messagesRequestId && (
          <RequestMessagesLink requestId={messagesRequestId} />
        )}
      </div>
    </>
  )
}
