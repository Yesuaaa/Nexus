"use client"

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEventHandler,
  type ReactNode,
} from "react"
import {
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { SearchField } from "@/components/ui/search-field"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import {
  approveProjectDeliverable,
  downloadProjectDeliverableAttachment,
  rejectProjectDeliverable,
  removeProjectDeliverableAttachment,
  sendProjectDeliverableToClient,
  updateProjectDeliverable,
  uploadProjectDeliverable,
  type ProjectDeliverable,
  type ProjectWorkspaceDetail,
  type ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"
import {
  deliverableStatusClass,
  deliverableStatusLabel,
} from "./deliverable-status"

type DeliverableRow = {
  workspaceId: string
  stream: ProjectWorkspaceWorkstream
  deliverable: ProjectDeliverable
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ActionIcon({
  label,
  onClick,
  children,
  className,
  disabled = false,
  id,
}: {
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  children: ReactNode
  className?: string
  disabled?: boolean
  id?: string
}) {
  return (
    <button
      type="button"
      id={id}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(rowActionButton, "max-[560px]:size-10", className)}
      onClick={onClick}
    >
      {children}
    </button>
  )
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
    <Dialog open={!!row} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#14213d]/40"
        className="max-w-[520px] gap-0 overflow-hidden rounded-[13px] border-[#dedede] p-0 text-[#182235] shadow-[0_16px_60px_rgb(18_36_73_/_18%)]"
      >
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-[#eceef1] px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-[20px] leading-tight font-[650] tracking-[-0.03em]">
                  Edit deliverable
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-[#52627a]">
                  Update the expected result and submission requirements.
                </DialogDescription>
              </div>
              <button
                type="button"
                aria-label="Close edit deliverable"
                disabled={busy}
                className={cn(rowActionButton, "max-[560px]:size-10")}
                onClick={onClose}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5">
            <label className="grid gap-1.5 text-xs font-medium">
              Deliverable name
              <input
                value={title}
                maxLength={300}
                onChange={(event) => setTitle(event.currentTarget.value)}
                className="h-10 rounded-lg border border-[#d7dfe8] bg-[#f8fafc] px-3 text-xs font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#294c96]"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              Description
              <textarea
                value={description}
                maxLength={4000}
                rows={4}
                onChange={(event) => setDescription(event.currentTarget.value)}
                placeholder="Describe what the staff member should prepare."
                className="min-h-24 resize-y rounded-lg border border-[#d7dfe8] bg-[#f8fafc] px-3 py-2 text-xs leading-5 font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#294c96]"
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
            {error && (
              <p role="alert" className="m-0 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-[#eceef1] px-6 py-4">
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
              disabled={busy}
              className="bg-[#203f8c] text-white hover:bg-[#172f70]"
            >
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    <Dialog open={!!row} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#14213d]/40"
        className="max-w-[440px] gap-0 overflow-hidden rounded-[13px] border-[#dedede] p-0 text-[#182235] shadow-[0_16px_60px_rgb(18_36_73_/_18%)]"
      >
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-[#eceef1] px-6 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-[20px] leading-tight font-[650] tracking-[-0.03em]">
                  Reject deliverable
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-[#52627a]">
                  {row?.deliverable.title}
                </DialogDescription>
              </div>
              <button
                type="button"
                aria-label="Close reject deliverable"
                disabled={busy}
                className={cn(rowActionButton, "max-[560px]:size-10")}
                onClick={onClose}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </DialogHeader>
          <div className="grid gap-2 px-6 py-5">
            <label
              htmlFor="deliverable-rejection-reason"
              className="text-xs font-medium"
            >
              Reason for rejection <span className="text-red-600">*</span>
            </label>
            <p className="m-0 text-xs leading-5 text-[#52627a]">
              Staff will see this note and can submit a revised attachment.
            </p>
            <textarea
              id="deliverable-rejection-reason"
              value={reason}
              maxLength={2000}
              rows={4}
              required
              onChange={(event) => setReason(event.currentTarget.value)}
              placeholder="Describe what needs to change..."
              className="min-h-24 resize-y rounded-lg border border-[#d7dfe8] bg-[#f8fafc] px-3 py-2 text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-[#294c96]"
            />
            {error && (
              <p role="alert" className="m-0 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-[#eceef1] px-6 py-4">
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
              disabled={busy || reason.trim().length < 3}
              className="bg-[#b3343b] text-white hover:bg-[#962b32]"
            >
              {busy ? "Rejecting…" : "Reject deliverable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RemoveAttachmentDialog({
  row,
  busy,
  onClose,
  onRemove,
}: {
  row: DeliverableRow | null
  busy: boolean
  onClose: () => void
  onRemove: () => void
}) {
  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#14213d]/40"
        className="max-w-[420px] gap-0 overflow-hidden rounded-[13px] border-[#dedede] p-0 text-[#182235]"
      >
        <DialogHeader className="border-b border-[#eceef1] px-6 py-5 text-left">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-[20px] leading-tight font-[650] tracking-[-0.03em]">
                Remove attachment?
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-[#52627a]">
                Remove the file from “{row?.deliverable.title}”?
              </DialogDescription>
            </div>
            <button
              type="button"
              aria-label="Close remove attachment confirmation"
              disabled={busy}
              className={rowActionButton}
              onClick={onClose}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </DialogHeader>
        <DialogFooter className="px-6 py-4">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            className="bg-[#b3343b] text-white hover:bg-[#962b32]"
            onClick={onRemove}
          >
            {busy ? "Removing…" : "Remove attachment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeliverableDetailsPanel({
  row,
  opener,
  busy,
  onClose,
  onUpload,
  onRemove,
  onDownload,
  onApprove,
  onReject,
  onSend,
}: {
  row: DeliverableRow | null
  opener: HTMLElement | null
  busy: boolean
  onClose: () => void
  onUpload: () => void
  onRemove: () => void
  onDownload: () => void
  onApprove: () => void
  onReject: () => void
  onSend: () => void
}) {
  const { open, handleOpenChange } = useAnimatedPanelClose(onClose)

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay bg-[rgb(13_28_57_/_40%)]"
        className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (opener?.isConnected) opener.focus()
          else if (row) {
            const fallback = document.getElementById(
              `project-deliverable-view-${row.deliverable.id}`,
            )
            if (fallback instanceof HTMLElement) fallback.focus()
          }
        }}
      >
        {row && (
          <>
            <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
              <div className="min-w-0">
                <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
                  Deliverable details
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs text-[#52627a]">
                  {row.stream.serviceName}
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  aria-label="Close deliverable details"
                  className={cn(rowActionButton, "max-[560px]:size-11")}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </SheetClose>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
              <h2 className="m-0 break-words text-base font-semibold">
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
              <dl className="mt-5 grid grid-cols-2 gap-x-5 max-[450px]:grid-cols-1">
                {[
                  ["Service", row.stream.serviceName],
                  [
                    "Expected attachment",
                    row.deliverable.expectedFileType || "Any supported file",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-0 border-b border-[#eceef1] py-3"
                  >
                    <dt className="text-[11px] text-[#52627a]">{label}</dt>
                    <dd className="mt-1.5 ml-0 text-xs font-medium [overflow-wrap:anywhere]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <section className="mt-6">
                <h3 className="m-0 text-xs font-semibold">Description</h3>
                <p className="mt-2 mb-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
                  {row.deliverable.description ||
                    "No description has been added yet."}
                </p>
              </section>
              {row.deliverable.rejectionReason && (
                <section className="mt-5 rounded-lg border border-[#f3c8cb] bg-[#fff5f5] p-3">
                  <h3 className="m-0 text-xs font-semibold text-[#9f2d35]">
                    Reason for rejection
                  </h3>
                  <p className="mt-2 mb-0 text-xs leading-5 whitespace-pre-wrap text-[#80313a]">
                    {row.deliverable.rejectionReason}
                  </p>
                </section>
              )}
              <section className="mt-6">
                <h3 className="m-0 text-xs font-semibold">Attachment</h3>
                {row.deliverable.workflowFile &&
                (row.stream.canAssign || row.stream.canUploadDeliverables) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onDownload}
                    className="mt-2 flex w-full items-center gap-3 rounded-lg border border-[#dfe4ec] bg-[#f8fafd] px-3 py-3 text-left hover:bg-[#f1f5fa] disabled:opacity-60"
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
                      <span className="mt-1 block text-[11px] text-[#738096]">
                        {formatBytes(row.deliverable.workflowFile.size)}
                      </span>
                    </span>
                    <Download
                      size={15}
                      className="shrink-0 text-[#52627a]"
                      aria-hidden="true"
                    />
                  </button>
                ) : row.deliverable.workflowFile ? (
                  <p className="mt-2 mb-0 rounded-lg border border-[#dfe4ec] bg-[#f8fafd] px-3 py-3 text-xs text-[#52627a]">
                    {row.deliverable.workflowFile.name} ·{" "}
                    {formatBytes(row.deliverable.workflowFile.size)}
                  </p>
                ) : (
                  <p className="mt-2 mb-0 rounded-lg border border-dashed border-[#d7dfe8] px-4 py-5 text-center text-xs text-[#738096]">
                    No file attached
                  </p>
                )}
              </section>
            </div>
            <footer className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
              {row.stream.canAssign &&
              row.deliverable.deliveryStatus === "IN_REVIEW" ? (
                <div className="flex w-full justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    className="text-[#b3343b] hover:bg-[#fff5f5]"
                    onClick={onReject}
                  >
                    <X size={14} aria-hidden="true" />
                    Reject
                  </Button>
                  <Button
                    disabled={busy}
                    className="bg-[#13743b] text-white hover:bg-[#0e6030]"
                    onClick={onApprove}
                  >
                    <Check size={14} aria-hidden="true" />
                    Approve
                  </Button>
                </div>
              ) : row.stream.canAssign &&
                row.deliverable.deliveryStatus === "APPROVED" ? (
                <div className="flex w-full justify-end">
                  <Button
                    disabled={busy}
                    className="bg-[#203f8c] text-white hover:bg-[#172f70]"
                    onClick={onSend}
                  >
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
                    <Button
                      variant="outline"
                      disabled={busy}
                      className="text-[#b3343b] hover:bg-[#fff5f5]"
                      onClick={onRemove}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Remove attachment
                    </Button>
                  )}
                  {["NOT_SUBMITTED", "REJECTED"].includes(
                    row.deliverable.deliveryStatus,
                  ) && (
                    <Button
                      disabled={busy}
                      className="bg-[#203f8c] text-white hover:bg-[#172f70]"
                      onClick={onUpload}
                    >
                      <Upload size={14} aria-hidden="true" />
                      {row.deliverable.workflowFile
                        ? "Replace attachment"
                        : "Upload attachment"}
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] text-[#738096]">
                  {row.deliverable.deliveryStatus === "SENT_TO_CLIENT"
                    ? "Shared with the client"
                    : "Review the details and attachment above."}
                </span>
              )}
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const deliverableRowKey = (row: DeliverableRow) =>
  `${row.stream.id}-${row.deliverable.id}`

export function WorkspaceDeliverables({
  workspace,
  onUpdated,
}: {
  workspace: ProjectWorkspaceDetail
  onUpdated: (workspace: ProjectWorkspaceDetail) => void
}) {
  const [query, setQuery] = useState("")
  const [serviceFilter, setServiceFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<{
    projectId: string
    deliverableId: string
  } | null>(null)
  const [detailOpener, setDetailOpener] = useState<HTMLElement | null>(null)
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
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<{
    projectId: string
    deliverableId: string
  } | null>(null)
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
  const services = [...new Set(rows.map(({ stream }) => stream.serviceName))]
  const filteredRows = useMemo(
    () =>
      rows.filter(({ stream, deliverable }) => {
        if (serviceFilter !== "all" && stream.serviceName !== serviceFilter)
          return false
        const needle = query.trim().toLocaleLowerCase()
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
    [rows, query, serviceFilter],
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
        title:
          reason instanceof Error
            ? reason.message
            : "Could not update deliverable.",
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  function startUpload(row: DeliverableRow) {
    uploadTarget.current = {
      projectId: row.stream.id,
      deliverableId: row.deliverable.id,
    }
    fileInput.current?.click()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    const target = uploadTarget.current
    uploadTarget.current = null
    if (!file || !target) return
    await saveResult(
      uploadProjectDeliverable(
        workspace.id,
        target.projectId,
        target.deliverableId,
        file,
      ),
      "Attachment sent for review",
    )
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
        title:
          reason instanceof Error
            ? reason.message
            : "Could not download attachment.",
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
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
        onChange={(event) => void handleFileChange(event)}
      />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold">
          Project deliverables{" "}
          <span className="font-normal text-[#738096]">
            {rows.length} deliverables
          </span>
        </h2>
      </header>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            label="Search deliverables"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search deliverables..."
            containerClassName="w-full max-w-[300px] border-[#dfe4ec] bg-transparent px-3 text-[#738096] focus-within:ring-2 focus-within:ring-[#294c96] max-[1050px]:w-full max-[1050px]:max-w-[300px] max-[1050px]:flex-none"
            className="text-[#182235] placeholder:text-[#8090a8]"
          />
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="h-[34px] w-[190px] bg-transparent text-xs">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {services.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#dfe4ec] px-5 py-12 text-center">
          <FileText
            size={22}
            className="mx-auto text-[#738096]"
            aria-hidden="true"
          />
          <h3 className="mt-3 mb-1 text-sm font-semibold">
            No deliverables yet
          </h3>
          <p className="m-0 text-xs text-[#738096]">
            Expected deliverables from the project plan will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#dfe4ec]">
          <div
            className="min-w-[900px]"
            role="table"
            aria-label="Project deliverables"
          >
            <div
              role="row"
              className="grid grid-cols-[minmax(190px,1.2fr)_minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(135px,.8fr)_160px] items-center bg-[#e9eef3] text-[11px] font-semibold text-[#182235]"
            >
              {[
                ["Deliverable", "pl-4"],
                ["Attachment", ""],
                ["Service", ""],
                ["Status", "text-center"],
                ["Actions", "pr-4 text-right"],
              ].map(([label, className]) => (
                <div
                  key={label}
                  role="columnheader"
                  className={cn("px-3 py-3", className)}
                >
                  {label}
                </div>
              ))}
            </div>
            <AnimatedSlotGridBody
              items={filteredRows}
              viewKey={JSON.stringify([query, serviceFilter])}
              quickKey={query}
              animateRows
              getKey={deliverableRowKey}
              rowClassName={() =>
                "grid grid-cols-[minmax(190px,1.2fr)_minmax(190px,1.2fr)_minmax(160px,1fr)_minmax(135px,.8fr)_160px] items-center border-t border-[#e5e9ef] text-xs text-[#182235]"
              }
              emptyContent="No deliverables match those filters."
              className="relative overflow-x-clip"
              renderRow={({ workspaceId, stream, deliverable }) => {
                const row = { workspaceId, stream, deliverable }
                const canReview = stream.canAssign
                const canUpload = stream.canUploadDeliverables
                const canEdit =
                  canReview && deliverable.deliveryStatus !== "SENT_TO_CLIENT"
                const actions = (
                  <div className="flex items-center justify-end gap-2 pr-4">
                    <ActionIcon
                      id={`project-deliverable-view-${deliverable.id}`}
                      label={`View details for ${deliverable.title}`}
                      onClick={(event) => {
                        setDetailOpener(event.currentTarget)
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
                        className="border-[#203f8c] bg-[#203f8c] text-white hover:bg-[#172f70]"
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
                            className="text-[#13743b]"
                            disabled={busy}
                            onClick={() => void handleApprove(row)}
                          >
                            <Check size={16} aria-hidden="true" />
                          </ActionIcon>
                          <ActionIcon
                            label={`Reject ${deliverable.title}`}
                            className="text-[#b3343b]"
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
                    {canReview && deliverable.deliveryStatus === "APPROVED" && (
                      <ActionIcon
                        label={`Send ${deliverable.title} to client`}
                        className="border-[#203f8c] bg-[#203f8c] text-white hover:bg-[#172f70]"
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
                    {" "}
                    <div role="cell" className="min-w-0 px-4 py-3.5">
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
                    </div>
                    <div role="cell" className="min-w-0 px-3 py-3.5">
                      {deliverable.workflowFile && (canReview || canUpload) ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="max-w-full truncate text-left text-[#294c96] hover:underline disabled:opacity-60"
                          onClick={() => void handleDownload(row)}
                        >
                          {deliverable.workflowFile.name}
                        </button>
                      ) : (
                        <span className="text-[#738096]">
                          {deliverable.workflowFile?.name ?? "No attachment"}
                        </span>
                      )}
                    </div>
                    <div role="cell" className="min-w-0 px-3 py-3.5">
                      <span className="inline-flex max-w-full truncate rounded-md bg-[#edf1f6] px-2 py-1 text-[10px] text-[#52627a]">
                        {stream.serviceName}
                      </span>
                    </div>
                    <div role="cell" className="px-3 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2.5 py-1 text-[10px] font-medium",
                          deliverableStatusClass(deliverable.deliveryStatus),
                        )}
                      >
                        {deliverableStatusLabel(deliverable.deliveryStatus)}
                      </span>
                    </div>
                    <div role="cell" className="py-3.5">
                      {actions}
                    </div>
                  </>
                )
              }}
            />
          </div>
        </div>
      )}
      {selected && (
        <DeliverableDetailsPanel
          row={selected}
          opener={detailOpener}
          busy={busy}
          onClose={() => setSelectedIds(null)}
          onUpload={() => startUpload(selected)}
          onDownload={() => void handleDownload(selected)}
          onRemove={() =>
            setRemovingIds({
              projectId: selected.stream.id,
              deliverableId: selected.deliverable.id,
            })
          }
          onApprove={() => void handleApprove(selected)}
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
      <RemoveAttachmentDialog
        row={removing}
        busy={busy}
        onClose={() => setRemovingIds(null)}
        onRemove={() => void handleRemove()}
      />
    </section>
  )
}
