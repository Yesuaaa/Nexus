"use client"

import { useState } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { PlusIcon } from "@/components/layout/icons"
import { PageHeaderButton } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { Pill } from "@/components/ui/pill"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import {
  ResponsiveDataTable,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
} from "@/components/ui/responsive-data-table"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { useLocalTable } from "@/components/ui/use-local-table"
import { useAsyncResource } from "@/lib/use-async-resource"
import { AttendanceShell } from "../components/attendance-shell"
import { ResourceStatus } from "../components/attendance-shared"
import { AttendancePolicyDetailsPanel } from "../components/attendance-policy-details-panel"
import { AttendancePolicyPanel } from "../components/attendance-policy-panel"
import {
  RowActionLabel,
  RowActionsMenu,
  type RowActionMenuItem,
} from "@/components/ui/row-actions-menu"
import {
  Archive,
  ArchiveRestore,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  CircleCheck,
} from "lucide-react"
import {
  attendancePolicies,
  archiveAttendancePolicy,
  deleteAttendancePolicy,
  type AttendancePolicy,
} from "../api/attendance-api"

const policyGrid =
  "grid grid-cols-[minmax(180px,1.4fr)_minmax(140px,1fr)_minmax(110px,.8fr)_minmax(120px,.8fr)_56px] items-center gap-3.5 @max-[820px]:grid-cols-[minmax(0,1fr)_auto]"

function policyRowClass(
  _policy: AttendancePolicy,
  _index: number,
  isLast: boolean,
) {
  return cn(
    policyGrid,
    "h-[58px] border-b border-[#eceef1] bg-background px-4 py-[7px] text-xs text-foreground hover:bg-[#e8eef2] @max-[820px]:h-auto @max-[820px]:min-h-[132px] @max-[820px]:gap-x-4 @max-[820px]:gap-y-2 @max-[820px]:py-[14px] @max-[820px]:hover:bg-[#e8eef2]",
    isLast && "rounded-b-[7px] border-b-0",
  )
}

type PolicyAction =
  "view" | "assign" | "edit" | "archive" | "restore" | "delete"

const policyActionItems: RowActionMenuItem<PolicyAction>[] = [
  {
    action: "view",
    label: <RowActionLabel icon={Eye}>View policy details</RowActionLabel>,
  },
  {
    action: "assign",
    label: <RowActionLabel icon={UserPlus}>Assign</RowActionLabel>,
  },
  {
    action: "edit",
    label: <RowActionLabel icon={Pencil}>Edit</RowActionLabel>,
  },
]

export function AttendanceSettingsPage() {
  const policies = useAsyncResource(attendancePolicies, [], {
    fallbackError: "Couldn't load attendance policies.",
  })
  const [search, setSearch] = useState("")
  const [archivedView, setArchivedView] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    policy: AttendancePolicy
    action: "archive" | "restore" | "delete"
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [panel, setPanel] = useState<{
    mode: "create" | "assign"
    template?: AttendancePolicy
  } | null>(null)
  const [detailsPolicy, setDetailsPolicy] = useState<AttendancePolicy | null>(
    null,
  )
  const query = search.trim().toLowerCase()
  const rows = (policies.data?.policies ?? []).filter(
    (policy) =>
      Boolean(policy.archivedAt) === archivedView &&
      `${policy.name} ${policy.timeZone}`.toLowerCase().includes(query),
  )
  const table = useLocalTable(rows, {
    view: [query, archivedView],
    loading: policies.loading,
  })
  function switchView(nextArchivedView: boolean) {
    if (nextArchivedView === archivedView) return
    setArchivedView(nextArchivedView)
    setSearch("")
  }
  async function confirmAction() {
    if (!confirmation || pending) return
    setPending(true)
    setError("")
    try {
      const { policy, action } = confirmation
      if (action === "delete") await deleteAttendancePolicy(policy.id)
      else await archiveAttendancePolicy(policy.id, action === "archive")
      sileo.success({
        title:
          action === "delete"
            ? "Attendance policy deleted"
            : action === "archive"
              ? "Attendance policy archived"
              : "Attendance policy restored",
      })
      setConfirmation(null)
      policies.retry()
    } catch (failure) {
      setError(errorMessage(failure, "Couldn't update the attendance policy."))
    } finally {
      setPending(false)
    }
  }
  return (
    <AttendanceShell
      tab="settings"
      actions={
        <>
          <Button
            variant="brandOutline"
            size="header"
            onClick={() => setPanel({ mode: "assign" })}
          >
            Assign policy to employee
          </Button>
          <PageHeaderButton onClick={() => setPanel({ mode: "create" })}>
            <PlusIcon width="14" height="14" />
            Create policy
          </PageHeaderButton>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <SearchField
          label="Search attendance policies"
          placeholder="Search policies or timezone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ManagementViewToggle
          active={archivedView}
          ariaLabel="Policy view"
          views={[
            { value: false, label: "Active policies", icon: CircleCheck },
            { value: true, label: "Archived policies", icon: Archive },
          ]}
          className="order-last max-[560px]:w-full"
          onChange={switchView}
        />
      </div>
      <p className="mb-4 text-[11px] text-[#738096]">
        Recorded workdays keep their original rules. Archive a policy before
        permanently deleting it; policies with assignments are retained for
        attendance history.
      </p>
      <ResourceStatus
        loading={policies.loading && !policies.data}
        error={policies.error}
        retry={policies.retry}
      />
      <ResponsiveDataTable
        label="Attendance policies"
        aria-busy={policies.loading}
      >
        <ResponsiveDataTableHeader
          className="@max-[820px]:sr-only"
          rowClassName={policyGrid}
        >
          <ResponsiveDataTableColumnHeader>
            Policy
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Timezone
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Required hours
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Assignments
          </ResponsiveDataTableColumnHeader>
          <ResponsiveDataTableColumnHeader>
            Actions
          </ResponsiveDataTableColumnHeader>
        </ResponsiveDataTableHeader>
        <AnimatedSlotGridBody
          items={table.visible}
          viewKey={table.viewKey}
          quickKey={search}
          animateRows
          getKey={(policy) => policy.id}
          onRowsSettled={table.onRowsSettled}
          rowClassName={policyRowClass}
          ariaBusy={policies.loading && Boolean(policies.data)}
          className="relative min-w-0 overflow-x-clip"
          emptyContent={
            policies.loading ? (
              "Loading policies…"
            ) : query ? (
              <SearchEmptyState query={search} />
            ) : archivedView ? (
              "No archived policies."
            ) : (
              "No attendance policies. Create a policy and assign it to an employee to enable clock-in."
            )
          }
          renderRow={(policy) => (
            <>
              <div
                role="cell"
                className="min-w-0 truncate font-medium @max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-1"
              >
                {policy.name}
              </div>
              <div
                role="cell"
                className="min-w-0 break-words text-[#738096] @max-[820px]:col-span-2 @max-[820px]:col-start-1 @max-[820px]:row-start-2"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                  Timezone
                </span>
                {policy.timeZone}
              </div>
              <div
                role="cell"
                className="@max-[820px]:col-start-1 @max-[820px]:row-start-3"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                  Required hours
                </span>
                {policy.days.reduce(
                  (sum, day) => sum + day.requiredMinutes,
                  0,
                ) / 60}{" "}
                hrs/week
              </div>
              <div
                role="cell"
                className="@max-[820px]:col-start-2 @max-[820px]:row-start-3 @max-[820px]:justify-self-end"
              >
                <span className="mr-1.5 hidden text-[#738096] @max-[820px]:inline">
                  Assignments
                </span>
                <Pill tone="neutral">
                  {policy._count?.assignments ?? 0} assignments
                </Pill>
              </div>
              <div
                role="cell"
                className="flex justify-start @max-[820px]:col-start-2 @max-[820px]:row-start-1 @max-[820px]:justify-self-end"
              >
                <RowActionsMenu
                  triggerId={`attendance-policy-actions-${policy.id}`}
                  triggerLabel={`More actions for ${policy.name}`}
                  menuLabel={`Actions for ${policy.name}`}
                  items={
                    policy.archivedAt
                      ? [
                          policyActionItems[0],
                          {
                            action: "restore",
                            label: (
                              <RowActionLabel icon={ArchiveRestore}>
                                Restore
                              </RowActionLabel>
                            ),
                          },
                          {
                            action: "delete",
                            label: (
                              <RowActionLabel icon={Trash2}>
                                Delete permanently
                              </RowActionLabel>
                            ),
                            separatorBefore: true,
                            className: "text-destructive",
                          },
                        ]
                      : [
                          ...policyActionItems,
                          {
                            action: "archive",
                            label: (
                              <RowActionLabel icon={Archive}>
                                Archive
                              </RowActionLabel>
                            ),
                            separatorBefore: true,
                          },
                        ]
                  }
                  onAction={(action) => {
                    setError("")
                    if (action === "view") setDetailsPolicy(policy)
                    else if (action === "assign")
                      setPanel({ mode: "assign", template: policy })
                    else if (action === "edit")
                      setPanel({ mode: "create", template: policy })
                    else setConfirmation({ policy, action })
                  }}
                />
              </div>
            </>
          )}
        />
      </ResponsiveDataTable>
      <TablePaginationFooter
        {...table.footer}
        label="Attendance policy pages"
        onPageChange={table.setPage}
      />
      {panel && (
        <AttendancePolicyPanel
          {...panel}
          policies={(policies.data?.policies ?? []).filter(
            (policy) => !policy.archivedAt,
          )}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null)
            policies.retry()
          }}
        />
      )}
      {detailsPolicy && (
        <AttendancePolicyDetailsPanel
          policy={detailsPolicy}
          onClose={() => setDetailsPolicy(null)}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          title={
            confirmation.action === "delete"
              ? "Delete attendance policy permanently?"
              : confirmation.action === "archive"
                ? "Archive attendance policy?"
                : "Restore attendance policy?"
          }
          subject={confirmation.policy.name}
          description={
            confirmation.action === "delete"
              ? "This permanently removes the policy. Policies with assignments must be retained for attendance history and cannot be deleted."
              : confirmation.action === "archive"
                ? "This removes the policy from active choices. Existing assignments and recorded attendance are preserved."
                : "This makes the policy available for editing and new assignments."
          }
          confirmLabel={
            confirmation.action === "delete"
              ? "Delete permanently"
              : confirmation.action === "archive"
                ? "Archive policy"
                : "Restore policy"
          }
          pendingLabel="Saving…"
          destructive={confirmation.action !== "restore"}
          pending={pending}
          error={error}
          onClose={() => setConfirmation(null)}
          onConfirm={confirmAction}
        />
      )}
    </AttendanceShell>
  )
}
