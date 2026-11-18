"use client"

import { FormInput, FormTextarea } from "@/components/ui/form-input"

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  ArrowUpRight,
  Check,
  Download,
  Eye,
  FileText,
  Pencil,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { sileo } from "@/lib/toast"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { SearchField } from "@/components/ui/search-field"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { cn } from "@/lib/utils"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { ProjectDeliverableSubmissionDialog } from "./project-deliverable-submission-dialog"
import {
  approveProjectDeliverable,
  downloadProjectDeliverableAttachment,
  downloadProjectDeliverableSubmissionAttachment,
  escalateProjectDeliverable,
  getProjectWorkspace,
  rejectProjectDeliverable,
  removeProjectDeliverableAttachment,
  sendProjectDeliverableToClient,
  updateProjectDeliverable,
  type ProjectDeliverable,
  type ProjectWorkspaceDetail,
  type ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"
import {
  deliverableStatusClass,
  deliverableStatusLabel,
  deliverableStatusTone,
} from "./deliverable-status"
import { errorMessage } from "@/lib/error-message"

type DeliverableRow = {
  workspaceId: string
  stream: ProjectWorkspaceWorkstream
  deliverable: ProjectDeliverable
}

const deliverableGrid =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,.9fr)_minmax(95px,.65fr)_minmax(100px,1fr)] items-center gap-3 @max-[730px]:grid-cols-[minmax(0,1fr)_auto]"
const deliverableRowClass = cn(
  deliverableGrid,
  "min-h-[58px] px-4 py-3 text-xs hover:bg-[#f8fafd]",
)
const deliverableCells = [
  "min-w-0 @max-[730px]:col-span-2",
  "min-w-0 @max-[730px]:col-span-2",
  "min-w-0 @max-[730px]:col-span-2",
  "min-w-0 @max-[730px]:col-span-2",
  "min-w-0 justify-self-end @max-[730px]:col-span-2",
]

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ActionIcon({
  label,
  onClick,
  children,
  variant = "outline",
  disabled = false,
  id,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  variant?: "outline" | "brand" | "danger"
  disabled?: boolean
  id?: string
}) {
  return (
    <Button
      type="button"
      id={id}
      aria-label={label}
      title={label}
      disabled={disabled}
      variant={variant}
      size="sm"
      className="size-8 p-0 max-[560px]:size-10"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function submissionStatusLabel(
  status: NonNullable<ProjectDeliverable["submissions"]>[number]["status"],
) {
  switch (status) {
    case "IN_REVIEW":
      return "In review"
    case "ESCALATED":
      return "Head review"
    case "REJECTED":
      return "Rejected"
    case "APPROVED":
      return "Approved"
    case "SENT_TO_CLIENT":
      return "Shared with client"
    case "WITHDRAWN":
      return "Withdrawn"
  }
}

function submissionStatusTone(
  status: NonNullable<ProjectDeliverable["submissions"]>[number]["status"],
) {
  switch (status) {
    case "IN_REVIEW":
    case "ESCALATED":
      return "warning" as const
    case "REJECTED":
      return "danger" as const
    case "APPROVED":
      return "success" as const
    case "SENT_TO_CLIENT":
      return "info" as const
    case "WITHDRAWN":
      return "neutral" as const
  }
}

function EditDeliverableDialog({
  row,
  busy,
  onClose,
  onSave,
}: {
  row: DeliverableRow | null
  busy: boolean
  onClose: () => void
  onSave: (input: {
    title: string
    description: string
    expectedFileType: string
  }) => void
}) {
  const [title, setTitle] = useState(row?.deliverable.title ?? "")
  const [description, setDescription] = useState(
    row?.deliverable.description ?? "",
  )
  const [expectedFileType, setExpectedFileType] = useState(
    row?.deliverable.expectedFileType ?? "",
  )
  const [error, setError] = useState("")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!row) return
    if (!title.trim()) {
      setError("Enter a deliverable name.")
      return
    }
    setError("")
    onSave({ title: title.trim(), description, expectedFileType })
  }

  return (
    <Modal open={!!row} size="md" busy={busy} onClose={onClose}>
      <ModalHeader
        title="Edit deliverable"
        description="Update the expected result and submission requirements."
        closeLabel="Close edit deliverable"
        closeDisabled={busy}
      />
      <form onSubmit={submit}>
        <ModalBody>
          <label className="grid gap-1.5 text-xs font-medium">
            Deliverable name
            <FormInput
              value={title}
              maxLength={300}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Description
            <FormTextarea
              value={description}
              maxLength={4000}
              rows={4}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder="Describe what the staff member should prepare."
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Expected attachment
            <Select
              value={expectedFileType || "any"}
              onValueChange={(value) =>
                setExpectedFileType(value === "any" ? "" : value)
              }
            >
              <SelectTrigger className="h-10 bg-[#f8fafc] text-xs">
                <SelectValue placeholder="Any supported file" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any supported file</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Word document">Word document</SelectItem>
                <SelectItem value="Image">Image</SelectItem>
                <SelectItem value="Plain text">Plain text</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {error && <Alert variant="text">{error}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

function RejectDeliverableDialog({
  row,
  busy,
  onClose,
  onReject,
}: {
  row: DeliverableRow | null
  busy: boolean
  onClose: () => void
  onReject: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!row) return
    if (reason.trim().length < 3) {
      setError("Add a reason so staff know what to address.")
      return
    }
    if (reason.trim().length > 2000) {
      setError("Keep the reason under 2,000 characters.")
      return
    }
    setError("")
    onReject(reason.trim())
  }

  return (
    <Modal open={!!row} size="sm" busy={busy} onClose={onClose}>
      <ModalHeader
        title="Reject deliverable"
        description={row?.deliverable.title}
        closeLabel="Close reject deliverable"
        closeDisabled={busy}
      />
      <form onSubmit={submit}>
        <ModalBody className="gap-2">
          <label
            htmlFor="deliverable-rejection-reason"
            className="text-xs font-medium"
          >
            Reason for rejection <span className="text-red-600">*</span>
          </label>
          <p className="m-0 text-xs leading-5 text-[#52627a]">
            Staff will see this note and can submit a revised attachment.
          </p>
          <FormTextarea
            id="deliverable-rejection-reason"
            value={reason}
            maxLength={2000}
            rows={4}
            required
            onChange={(event) => setReason(event.currentTarget.value)}
            placeholder="Describe what needs to change..."
          />
          {error && <Alert variant="text">{error}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={busy || reason.trim().length < 3}
          >
            {busy ? "Rejecting…" : "Reject deliverable"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

function DeliverableDetailsPanel({
  row,
  busy,
  administrativeReadOnly,
  onClose,
  onUpload,
  onRemove,
  onDownload,
  onDownloadVersion,
  onApprove,
  onReject,
  onEscalate,
  onSend,
}: {
  row: DeliverableRow
  busy: boolean
  administrativeReadOnly: boolean
  onClose: () => void
  onUpload: () => void
  onRemove: () => void
  onDownload: () => void
  onDownloadVersion: (submissionId: string, fileName: string) => void
  onApprove: () => void
  onReject: () => void
  onEscalate: () => void
  onSend: () => void
}) {
  const panel = useSidePanel(onClose)
  const account = usePortalAccount()
  const { formatDate } = useDatePreferences()
  const submissions = row.deliverable.submissions ?? []
  const currentSubmission = submissions.find(
    ({ workflowFile }) => workflowFile.id === row.deliverable.workflowFile?.id,
  )
  const canReview =
    !administrativeReadOnly &&
    currentSubmission?.submittedById !== account.id &&
    ((row.stream.isTeamLead && currentSubmission?.status === "IN_REVIEW") ||
      (row.stream.isDepartmentHead &&
        (currentSubmission?.status === "ESCALATED" ||
          (!row.stream.hasTeamLead &&
            currentSubmission?.status === "IN_REVIEW"))))
  const canEscalate =
    !administrativeReadOnly &&
    row.stream.isTeamLead &&
    currentSubmission?.status === "IN_REVIEW"

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(
          `project-deliverable-view-${row.deliverable.id}`,
        )
      }
    >
      <SidePanelHeader
        title="Deliverable details"
        description={row.stream.serviceName}
        closeLabel="Close deliverable details"
      />
      <SidePanelBody>
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold break-words">
            {row.deliverable.title}
          </h2>
          <span
            className={cn(
              "mt-3 inline-flex rounded-md px-2.5 py-1 text-[11px] font-medium",
              deliverableStatusClass(row.deliverable.deliveryStatus),
            )}
          >
            {deliverableStatusLabel(row.deliverable.deliveryStatus)}
          </span>
        </div>
        <DetailList layout="stacked">
          <DetailItem label="Service">{row.stream.serviceName}</DetailItem>
          <DetailItem label="Expected attachment">
            {row.deliverable.expectedFileType || "Any supported file"}
          </DetailItem>
        </DetailList>
        <SidePanelSection title="Description">
          <p className="m-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
            {row.deliverable.description ||
              "No description has been added yet."}
          </p>
        </SidePanelSection>
        {row.deliverable.rejectionReason && (
          <section className="rounded-lg border border-[#f3c8cb] bg-[#fff5f5] p-3">
            <h3 className="m-0 text-xs font-semibold text-[#9f2d35]">
              Reason for rejection
            </h3>
            <p className="mt-2 mb-0 text-xs leading-5 whitespace-pre-wrap text-[#80313a]">
              {row.deliverable.rejectionReason}
            </p>
          </section>
        )}
        <SidePanelSection title="Attachment">
          {administrativeReadOnly ? (
            <p className="m-0 text-xs text-[#65718a]">
              Attachment details are not included in organization-wide project
              inspection.
            </p>
          ) : row.deliverable.workflowFile &&
            (row.stream.canAssign || row.stream.canUploadDeliverables) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onDownload}
              className="h-auto w-full justify-start gap-3 rounded-lg border-[#dfe4ec] bg-[#f8fafd] px-3 py-3 text-left text-[#182235] hover:bg-[#f1f5fa]"
            >
              <FileText
                size={18}
                className="shrink-0 text-[#294c96]"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-[#203f8c]">
                  {row.deliverable.workflowFile.name}
                </span>
                <span className="mt-1 block text-[11px] text-[#65718a]">
                  {formatBytes(row.deliverable.workflowFile.size)}
                </span>
              </span>
              <Download
                size={15}
                className="shrink-0 text-[#52627a]"
                aria-hidden="true"
              />
            </Button>
          ) : row.deliverable.workflowFile ? (
            <p className="m-0 rounded-lg border border-[#dfe4ec] bg-[#f8fafd] px-3 py-3 text-xs text-[#52627a]">
              {row.deliverable.workflowFile.name} ·{" "}
              {formatBytes(row.deliverable.workflowFile.size)}
            </p>
          ) : (
            <EmptyState size="sm" description="No file attached" />
          )}
        </SidePanelSection>
        <SidePanelSection title="Submission history">
          {administrativeReadOnly ? (
            <p className="m-0 text-xs text-[#65718a]">
              Submission versions and approval history are not included in
              organization-wide project inspection.
            </p>
          ) : submissions.length ? (
            <ol className="m-0 list-none space-y-3 p-0">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="min-w-0 rounded-lg border border-[#e6eaf0] bg-[#fbfcfe] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="neutral">Version {submission.version}</Pill>
                      <Pill tone={submissionStatusTone(submission.status)}>
                        {submissionStatusLabel(submission.status)}
                      </Pill>
                    </div>
                    <span className="text-[11px] text-[#738096]">
                      {submission.submittedBy.fullName || "Project staff"} ·{" "}
                      {formatDate(submission.submittedAt)}
                    </span>
                  </div>
                  {submission.note && (
                    <p className="mt-2 mb-0 whitespace-pre-wrap text-xs leading-5 text-[#52627a]">
                      {submission.note}
                    </p>
                  )}
                  {submission.reviewedBy && (
                    <p className="mt-2 mb-0 text-[11px] text-[#738096]">
                      Reviewed by {submission.reviewedBy.fullName || "reviewer"}
                      {submission.reviewedAt &&
                        ` · ${formatDate(submission.reviewedAt)}`}
                    </p>
                  )}
                  {submission.feedback && (
                    <p className="mt-2 mb-0 whitespace-pre-wrap rounded-md bg-white p-2 text-xs leading-5 text-[#52627a]">
                      {submission.feedback}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    className="mt-2 h-auto max-w-full justify-start p-0 text-left text-[#203f8c] hover:bg-transparent hover:underline"
                    onClick={() =>
                      onDownloadVersion(
                        submission.id,
                        submission.workflowFile.name,
                      )
                    }
                  >
                    <Download size={14} aria-hidden="true" />
                    <span className="truncate">
                      {submission.workflowFile.name} ·{" "}
                      {formatBytes(submission.workflowFile.size)}
                    </span>
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState size="sm" description="No submissions recorded" />
          )}
        </SidePanelSection>
      </SidePanelBody>
      <SidePanelFooter className="flex-wrap justify-between gap-3">
        {administrativeReadOnly ? (
          <span className="mr-auto text-[11px] text-[#65718a]">
            Read-only project inspection.
          </span>
        ) : canReview ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            {canEscalate && (
              <Button variant="outline" disabled={busy} onClick={onEscalate}>
                Escalate to Department Head
              </Button>
            )}
            <Button variant="danger" disabled={busy} onClick={onReject}>
              <X size={14} aria-hidden="true" />
              Reject
            </Button>
            <Button variant="brand" disabled={busy} onClick={onApprove}>
              <Check size={14} aria-hidden="true" />
              Approve
            </Button>
          </div>
        ) : row.stream.canAssign &&
          row.deliverable.deliveryStatus === "APPROVED" ? (
          <div className="flex w-full justify-end">
            <Button variant="brand" disabled={busy} onClick={onSend}>
              <Send size={14} aria-hidden="true" />
              Send to client
            </Button>
          </div>
        ) : row.stream.canUploadDeliverables &&
          ["NOT_SUBMITTED", "REJECTED", "IN_REVIEW"].includes(
            row.deliverable.deliveryStatus,
          ) ? (
          <div className="flex w-full justify-end gap-2">
            {row.deliverable.workflowFile && (
              <Button variant="danger" disabled={busy} onClick={onRemove}>
                <Trash2 size={14} aria-hidden="true" />
                Remove attachment
              </Button>
            )}
            {["NOT_SUBMITTED", "REJECTED"].includes(
              row.deliverable.deliveryStatus,
            ) && (
              <Button variant="brand" disabled={busy} onClick={onUpload}>
                <Upload size={14} aria-hidden="true" />
                {row.deliverable.workflowFile
                  ? "Replace attachment"
                  : "Upload attachment"}
              </Button>
            )}
          </div>
        ) : (
          <span className="mr-auto text-[11px] text-[#65718a]">
            {row.deliverable.deliveryStatus === "SENT_TO_CLIENT"
              ? "Shared with the client"
              : "Review the details and attachment above."}
          </span>
        )}
      </SidePanelFooter>
    </SidePanel>
  )
}

const deliverableRowKey = (row: DeliverableRow) =>
  `${row.stream.id}-${row.deliverable.id}`

export function WorkspaceDeliverables({
  workspace,
  onUpdated,
  administrativeReadOnly = false,
}: {
  workspace: ProjectWorkspaceDetail
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
  administrativeReadOnly?: boolean
}) {
  const account = usePortalAccount()
  const [query, setQuery] = useState("")
  const [settledQuery, setSettledQuery] = useState("")
  const searchPending = query.trim() !== settledQuery
  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => {
      setSettledQuery(query.trim())
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, searchPending])
  const [serviceFilter, setServiceFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<{
    projectId: string
    deliverableId: string
  } | null>(null)
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null)
  const [editingIds, setEditingIds] = useState<{
    projectId: string
    deliverableId: string
  } | null>(null)
  const [rejectingIds, setRejectingIds] = useState<{
    projectId: string
    deliverableId: string
  } | null>(null)
  const [removingIds, setRemovingIds] = useState<{
    projectId: string
    deliverableId: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = useMemo<DeliverableRow[]>(
    () =>
      workspace.workstreams.flatMap((stream) =>
        (stream.milestones ?? []).map((deliverable) => ({
          workspaceId: workspace.id,
          stream,
          deliverable,
        })),
      ),
    [workspace.id, workspace.workstreams],
  )
  const serviceOptions = [
    { value: "all", label: "All services" },
    ...[...new Set(rows.map(({ stream }) => stream.serviceName))].map(
      (service) => ({ value: service, label: service }),
    ),
  ]
  const filteredRows = useMemo(
    () =>
      rows.filter(({ stream, deliverable }) => {
        if (serviceFilter !== "all" && stream.serviceName !== serviceFilter)
          return false
        const needle = settledQuery.toLocaleLowerCase()
        return (
          !needle ||
          [
            deliverable.title,
            deliverable.description ?? "",
            deliverable.workflowFile?.name ?? "",
            stream.serviceName,
          ].some((value) => value.toLocaleLowerCase().includes(needle))
        )
      }),
    [rows, settledQuery, serviceFilter],
  )
  const getRow = (ids: { projectId: string; deliverableId: string } | null) =>
    ids
      ? (rows.find(
          ({ stream, deliverable }) =>
            stream.id === ids.projectId && deliverable.id === ids.deliverableId,
        ) ?? null)
      : null
  const selected = getRow(selectedIds)
  const editing = getRow(editingIds)
  const rejecting = getRow(rejectingIds)
  const removing = getRow(removingIds)

  async function saveResult(
    request: Promise<ProjectWorkspaceDetail>,
    success: string,
  ) {
    setBusy(true)
    try {
      onUpdated(await request)
      sileo.success({ title: success })
      return true
    } catch (reason) {
      sileo.error({
        title: errorMessage(reason, "Could not update deliverable."),
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  function startUpload(row: DeliverableRow) {
    setUploadProjectId(row.stream.id)
  }

  async function refreshAfterSubmission() {
    setBusy(true)
    try {
      onUpdated(await getProjectWorkspace(workspace.id))
    } catch (reason) {
      sileo.error({
        title: errorMessage(
          reason,
          "The submission was saved, but the list could not refresh.",
        ),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDownload(row: DeliverableRow | null) {
    if (!row?.deliverable.workflowFile) return
    setBusy(true)
    try {
      await downloadProjectDeliverableAttachment(
        workspace.id,
        row.stream.id,
        row.deliverable.id,
        row.deliverable.workflowFile.name,
      )
    } catch (reason) {
      sileo.error({
        title: errorMessage(reason, "Could not download attachment."),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadVersion(
    row: DeliverableRow,
    submissionId: string,
    fileName: string,
  ) {
    setBusy(true)
    try {
      await downloadProjectDeliverableSubmissionAttachment(
        workspace.id,
        row.stream.id,
        row.deliverable.id,
        submissionId,
        fileName,
      )
    } catch (reason) {
      sileo.error({
        title: errorMessage(reason, "Could not download this submission."),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleEdit(input: {
    title: string
    description: string
    expectedFileType: string
  }) {
    if (!editing) return
    const saved = await saveResult(
      updateProjectDeliverable(
        workspace.id,
        editing.stream.id,
        editing.deliverable.id,
        input,
      ),
      "Deliverable details updated",
    )
    if (saved) setEditingIds(null)
  }

  async function handleReject(reason: string) {
    if (!rejecting) return
    const saved = await saveResult(
      rejectProjectDeliverable(
        workspace.id,
        rejecting.stream.id,
        rejecting.deliverable.id,
        reason,
      ),
      "Deliverable rejected",
    )
    if (saved) setRejectingIds(null)
  }

  async function handleRemove() {
    if (!removing) return
    const saved = await saveResult(
      removeProjectDeliverableAttachment(
        workspace.id,
        removing.stream.id,
        removing.deliverable.id,
      ),
      "Attachment removed",
    )
    if (saved) setRemovingIds(null)
  }

  async function handleApprove(row: DeliverableRow | null) {
    if (!row) return
    await saveResult(
      approveProjectDeliverable(
        workspace.id,
        row.stream.id,
        row.deliverable.id,
      ),
      "Deliverable approved",
    )
  }

  async function handleEscalate(row: DeliverableRow | null) {
    if (!row) return
    await saveResult(
      escalateProjectDeliverable(
        workspace.id,
        row.stream.id,
        row.deliverable.id,
      ),
      "Deliverable escalated to the Department Head",
    )
  }

  async function handleSend(row: DeliverableRow | null) {
    if (!row) return
    await saveResult(
      sendProjectDeliverableToClient(
        workspace.id,
        row.stream.id,
        row.deliverable.id,
      ),
      "Deliverable shared with client",
    )
  }

  return (
    <section aria-label="Project deliverables" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold">
          Project deliverables{" "}
          <span className="font-normal text-[#65718a]">
            {rows.length} deliverables
          </span>
        </h2>
      </header>
      {rows.length > 0 && (
        <div className={filterBarClass}>
          <SearchField
            label="Search deliverables"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search deliverables..."
          />
          <FilterSelect
            label="Filter deliverables by service"
            value={serviceFilter}
            options={serviceOptions}
            triggerClassName="w-[190px]"
            onChange={setServiceFilter}
          />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No deliverables yet"
          description="Expected deliverables from the project plan will appear here."
        />
      ) : (
        <ResponsiveDataTable
          label="Project deliverables"
          aria-busy={searchPending}
        >
          <ResponsiveDataTableHeader
            className="@max-[730px]:sr-only"
            rowClassName={deliverableGrid}
          >
            {[
              ["Deliverable", ""],
              ["Attachment", ""],
              ["Service", ""],
              ["Status", ""],
              ["Actions", "text-right"],
            ].map(([label, className]) => (
              <ResponsiveDataTableColumnHeader
                key={label}
                className={className}
              >
                {label}
              </ResponsiveDataTableColumnHeader>
            ))}
          </ResponsiveDataTableHeader>
          {searchPending ? (
            <ResponsiveDataTableBody>
              <DataTableSkeletonRows
                label="deliverables"
                rows={5}
                rowClassName={deliverableRowClass}
                cellClassNames={deliverableCells}
                cellSkeletonClassNames={[
                  "h-3 w-3/4",
                  "h-3 w-2/3",
                  "h-5 w-24 rounded",
                  "h-5 w-16 rounded",
                  "h-8 w-24",
                ]}
              />
            </ResponsiveDataTableBody>
          ) : (
            <AnimatedSlotGridBody
              items={filteredRows}
              viewKey={JSON.stringify([settledQuery, serviceFilter])}
              quickKey={settledQuery}
              animateRows={false}
              autoRowHeight
              getKey={deliverableRowKey}
              rowClassName={(_row, _index, isLast) =>
                cn(deliverableRowClass, !isLast && "border-b border-[#eceef1]")
              }
              emptyContent="No deliverables match those filters."
              className="relative overflow-x-clip"
              renderRow={({ workspaceId, stream, deliverable }) => {
                const row = { workspaceId, stream, deliverable }
                const currentSubmission = deliverable.submissions?.find(
                  ({ workflowFile }) =>
                    workflowFile.id === deliverable.workflowFile?.id,
                )
                const canReview =
                  !administrativeReadOnly &&
                  currentSubmission?.submittedById !== account.id &&
                  ((stream.isTeamLead &&
                    currentSubmission?.status === "IN_REVIEW") ||
                    (stream.isDepartmentHead &&
                      (currentSubmission?.status === "ESCALATED" ||
                        (!stream.hasTeamLead &&
                          currentSubmission?.status === "IN_REVIEW"))))
                const canEscalate =
                  !administrativeReadOnly &&
                  stream.isTeamLead &&
                  currentSubmission?.status === "IN_REVIEW"
                const canUpload =
                  !administrativeReadOnly && stream.canUploadDeliverables
                const canEdit =
                  !administrativeReadOnly &&
                  stream.canAssign &&
                  deliverable.deliveryStatus !== "SENT_TO_CLIENT"
                const actions = (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ActionIcon
                      id={`project-deliverable-view-${deliverable.id}`}
                      label={`View details for ${deliverable.title}`}
                      onClick={() => {
                        setSelectedIds({
                          projectId: stream.id,
                          deliverableId: deliverable.id,
                        })
                      }}
                    >
                      <Eye size={16} aria-hidden="true" />
                    </ActionIcon>
                    {canReview && canEdit && (
                      <ActionIcon
                        label={`Edit ${deliverable.title}`}
                        variant="brand"
                        onClick={() =>
                          setEditingIds({
                            projectId: stream.id,
                            deliverableId: deliverable.id,
                          })
                        }
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </ActionIcon>
                    )}
                    {canReview &&
                      deliverable.deliveryStatus === "IN_REVIEW" && (
                        <>
                          <ActionIcon
                            label={`Approve ${deliverable.title}`}
                            variant="brand"
                            disabled={busy}
                            onClick={() => void handleApprove(row)}
                          >
                            <Check size={16} aria-hidden="true" />
                          </ActionIcon>
                          <ActionIcon
                            label={`Reject ${deliverable.title}`}
                            variant="danger"
                            disabled={busy}
                            onClick={() =>
                              setRejectingIds({
                                projectId: stream.id,
                                deliverableId: deliverable.id,
                              })
                            }
                          >
                            <X size={16} aria-hidden="true" />
                          </ActionIcon>
                        </>
                      )}
                    {canEscalate && (
                      <ActionIcon
                        label={`Escalate ${deliverable.title} to the Department Head`}
                        disabled={busy}
                        onClick={() => void handleEscalate(row)}
                      >
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </ActionIcon>
                    )}
                    {stream.canAssign &&
                      deliverable.deliveryStatus === "APPROVED" && (
                        <ActionIcon
                          label={`Send ${deliverable.title} to client`}
                          variant="brand"
                          disabled={busy}
                          onClick={() => void handleSend(row)}
                        >
                          <Send size={15} aria-hidden="true" />
                        </ActionIcon>
                      )}
                  </div>
                )
                return (
                  <>
                    <ResponsiveDataTableCell className={deliverableCells[0]}>
                      <span
                        className="block truncate font-medium"
                        title={deliverable.title}
                      >
                        {deliverable.title}
                      </span>
                      {deliverable.description && (
                        <span
                          className="mt-1 block truncate text-[11px] text-[#738096]"
                          title={deliverable.description}
                        >
                          {deliverable.description}
                        </span>
                      )}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell
                      className={cn(deliverableCells[1], "min-w-0 break-words")}
                    >
                      <span className="hidden font-medium text-[#65718a] @max-[730px]:inline">
                        Attachment:{" "}
                      </span>
                      {deliverable.workflowFile && (canReview || canUpload) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          className="h-auto max-w-full justify-start p-0 text-left text-[#294c96] hover:bg-transparent hover:underline"
                          onClick={() => void handleDownload(row)}
                        >
                          <span className="truncate">
                            {deliverable.workflowFile.name}
                          </span>
                        </Button>
                      ) : administrativeReadOnly ? (
                        <span className="text-[#738096]">
                          Not included in project inspection
                        </span>
                      ) : (
                        <span className="text-[#738096]">
                          {deliverable.workflowFile?.name ?? "No attachment"}
                        </span>
                      )}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className={deliverableCells[2]}>
                      <span className="mr-1 hidden font-medium text-[#65718a] @max-[730px]:inline">
                        Service:
                      </span>
                      <Pill
                        tone="neutral"
                        className="align-middle"
                        title={stream.serviceName}
                      >
                        {stream.serviceName}
                      </Pill>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className={deliverableCells[3]}>
                      <span className="mr-1 hidden font-medium text-[#65718a] @max-[730px]:inline">
                        Status:
                      </span>
                      <Pill
                        tone={deliverableStatusTone(deliverable.deliveryStatus)}
                        className="align-middle"
                      >
                        {deliverableStatusLabel(deliverable.deliveryStatus)}
                      </Pill>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className={deliverableCells[4]}>
                      {actions}
                    </ResponsiveDataTableCell>
                  </>
                )
              }}
            />
          )}
        </ResponsiveDataTable>
      )}
      {selected && (
        <DeliverableDetailsPanel
          key={deliverableRowKey(selected)}
          row={selected}
          busy={busy}
          administrativeReadOnly={administrativeReadOnly}
          onClose={() => setSelectedIds(null)}
          onUpload={() => startUpload(selected)}
          onDownload={() => void handleDownload(selected)}
          onDownloadVersion={(submissionId, fileName) =>
            void handleDownloadVersion(selected, submissionId, fileName)
          }
          onRemove={() =>
            setRemovingIds({
              projectId: selected.stream.id,
              deliverableId: selected.deliverable.id,
            })
          }
          onApprove={() => void handleApprove(selected)}
          onEscalate={() => void handleEscalate(selected)}
          onReject={() =>
            setRejectingIds({
              projectId: selected.stream.id,
              deliverableId: selected.deliverable.id,
            })
          }
          onSend={() => void handleSend(selected)}
        />
      )}
      <EditDeliverableDialog
        key={editing?.deliverable.id ?? "edit-closed"}
        row={editing}
        busy={busy}
        onClose={() => setEditingIds(null)}
        onSave={(input) => void handleEdit(input)}
      />
      <RejectDeliverableDialog
        key={rejecting?.deliverable.id ?? "reject-closed"}
        row={rejecting}
        busy={busy}
        onClose={() => setRejectingIds(null)}
        onReject={(reason) => void handleReject(reason)}
      />
      <ConfirmationDialog
        open={!!removing}
        title="Remove attachment?"
        subject={removing?.deliverable.title}
        description="The file will be removed from this deliverable."
        confirmLabel="Remove attachment"
        pendingLabel="Removing…"
        pending={busy}
        onClose={() => setRemovingIds(null)}
        onConfirm={() => void handleRemove()}
      />
      {uploadProjectId && (
        <ProjectDeliverableSubmissionDialog
          workspaceId={workspace.id}
          projectId={uploadProjectId}
          deliverables={rows
            .filter(({ stream }) => stream.id === uploadProjectId)
            .map(({ deliverable }) => deliverable)}
          onClose={() => setUploadProjectId(null)}
          onSubmitted={() => void refreshAfterSubmission()}
        />
      )}
    </section>
  )
}
