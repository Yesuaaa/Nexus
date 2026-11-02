import { apiRequest, apiStreamRequest } from "@/features/auth/api/auth-api"
import type { ServiceRequestStatus } from "@/features/services/api/services-api"
import type { WorkflowState } from "@/features/request-workflow/model/workflow"

export type RequestMessage = {
  id: string
  body: string | null
  clientMessageId: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  purgeAt: string | null
  sender: { id: string; fullName: string | null }
  booking?: {
    id: string
    title: string
    referenceNumber: string | null
    serviceName: string
  } | null
}

export type ConversationBooking = {
  id: string
  title: string
  referenceNumber: string | null
  status: ServiceRequestStatus
  packageName: string | null
  serviceName: string
  workflowState: WorkflowState
  previousWorkflowState: WorkflowState | null
  createdAt: string
  updatedAt: string
}

export function visibleConversationBookings(
  bookings: readonly ConversationBooking[] | undefined,
) {
  return (bookings ?? []).filter(
    (booking) => booking.status !== "CLOSED" && booking.status !== "CANCELLED",
  )
}

export type ConversationSummary = {
  id: string
  status: ServiceRequestStatus | "ACTIVE" | "ARCHIVED"
  title: string
  referenceNumber: string | null
  updatedAt: string
  service: { id?: string; name: string }
  client: { id: string; fullName: string | null; imageUrl?: string | null }
  acceptedDepartment: {
    id: string
    name: string
    head?: {
      id: string
      fullName: string | null
      imageUrl?: string | null
    } | null
  } | null
  bookings?: ConversationBooking[]
  lastMessage: RequestMessage | null
  unreadCount?: number
}

export type ConversationList = {
  conversations: ConversationSummary[]
  nextCursor: string | null
  unreadCount?: number
}

export function listConversations(before?: string, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (before) query.set("before", before)
  return apiRequest<ConversationList>(
    `/api/request-conversations${query.size ? `?${query}` : ""}`,
    { signal },
  )
}

export function markConversationRead(id: string) {
  return apiRequest<{
    ok: true
    unreadCount: number
    conversationUnreadCount: number
  }>(`/api/request-conversations/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  })
}

export type ConversationHistory = {
  meetings?: ConversationMeeting[]
  selectedBookingId: string | null
  conversation: {
    id: string
    status: "ACTIVE"
    department: { id: string; name: string }
    head: {
      id: string
      fullName: string | null
      specialistId?: string | null
      imageUrl?: string | null
    } | null
    client?: {
      id: string
      fullName: string | null
      email: string
      contactNumber: string | null
      imageUrl?: string | null
    }
    bookings: ConversationBooking[]
    bookingCount: number
  } | null
  canSend: boolean
  messages: RequestMessage[]
  nextCursor: string | null
}

const path = (id: string) =>
  `/api/request-conversations/${encodeURIComponent(id)}`

export type ConversationMeeting = {
  id: string
  conversationId: string
  startsAt: string
  endsAt: string
  location: string
  notes: string
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
  version: number
  proposedStartsAt: string | null
  rescheduleNote: string | null
  createdAt: string
  updatedAt: string
  bookings: {
    booking: {
      id: string
      referenceNumber: string | null
      service: { name: string }
    }
  }[]
}

export type MeetingSchedule = {
  startsAt: string
  endsAt: string
  location: string
}
export type MeetingAction =
  | { type: "REQUEST_RESCHEDULE"; startsAt: string; note: string }
  | ({ type: "RESCHEDULE" } & MeetingSchedule)
  | { type: "COMPLETE" | "CANCEL" | "KEEP_SCHEDULE" }

export function scheduleMeeting(
  id: string,
  input: MeetingSchedule & {
    notes: string
    bookingIds: string[]
    clientActionId: string
  },
) {
  return apiRequest<{ meeting: ConversationMeeting }>(`${path(id)}/meetings`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateMeeting(
  id: string,
  meetingId: string,
  expectedVersion: number,
  action: MeetingAction,
) {
  return apiRequest<{ meeting: ConversationMeeting }>(
    `${path(id)}/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ ...action, expectedVersion }),
    },
  )
}

export function getConversation(
  id: string,
  before?: string,
  signal?: AbortSignal,
  bookingId?: string,
): Promise<ConversationHistory> {
  const query = new URLSearchParams()
  if (before) query.set("before", before)
  if (bookingId) query.set("booking", bookingId)
  return apiRequest(`${path(id)}${query.size ? `?${query}` : ""}`, { signal })
}

export async function sendMessage(
  id: string,
  body: string,
  clientMessageId: string,
) {
  const result = await apiRequest<{ message: RequestMessage }>(
    `${path(id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body, clientMessageId }),
    },
  )
  return result.message
}

export async function editMessage(id: string, messageId: string, body: string) {
  const result = await apiRequest<{ message: RequestMessage }>(
    `${path(id)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ body }),
    },
  )
  return result.message
}

export async function deleteMessage(id: string, messageId: string) {
  const result = await apiRequest<{ message: RequestMessage }>(
    `${path(id)}/messages/${encodeURIComponent(messageId)}`,
    { method: "DELETE" },
  )
  return result.message
}

export function openConversationEvents(id: string, signal: AbortSignal) {
  return apiStreamRequest(`${path(id)}/events`, {
    signal,
    headers: { Accept: "text/event-stream" },
  })
}
