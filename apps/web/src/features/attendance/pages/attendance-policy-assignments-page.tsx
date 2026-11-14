"use client"
import { useState } from "react"
import { UsersRound } from "lucide-react"
import { FilterSelect } from "@/components/ui/filter-select"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeaderButton } from "@/components/layout/page-header"
import { useAsyncResource } from "@/lib/use-async-resource"
import { attendancePolicies } from "../api/attendance-api"
import { AttendanceShell } from "../components/attendance-shell"
import { ResourceStatus } from "../components/attendance-shared"
import { AttendancePolicyAssignments } from "../components/attendance-policy-details-panel"
import { AttendancePolicyPanel } from "../components/attendance-policy-panel"

export function AttendancePolicyAssignmentsPage() {
  const result = useAsyncResource(attendancePolicies, [], {
    fallbackError: "Couldn't load policies.",
  })
  const [policyId, setPolicyId] = useState("")
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const policies =
    result.error || result.loading ? [] : (result.data?.policies ?? [])
  const selected = policies.find((policy) => policy.id === policyId)
  const active = policies.filter((policy) => !policy.archivedAt)
  return (
    <AttendanceShell
      tab="assignments"
      actions={
        <PageHeaderButton
          disabled={
            result.loading ||
            Boolean(result.error) ||
            !active.length ||
            Boolean(selected?.archivedAt)
          }
          onClick={() => setOpen(true)}
        >
          Assign policy to employee
        </PageHeaderButton>
      }
    >
      <ResourceStatus
        loading={result.loading}
        error={result.error}
        retry={result.retry}
      />
      {!result.loading && !result.error && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FilterSelect
              label="Assignment policy"
              value={policyId}
              onChange={setPolicyId}
              triggerClassName="w-[min(100%,320px)]"
              options={[
                { value: "", label: "Select an attendance policy" },
                ...policies.map((policy) => ({
                  value: policy.id,
                  label: policy.name + (policy.archivedAt ? " (Archived)" : ""),
                })),
              ]}
            />
          </div>
          <p className="mb-4 text-xs text-[#738096]">
            Choose from the latest 200 policies. Archived policies retain
            assignment history; restore them in Management before assigning them
            again.
          </p>
          {selected ? (
            <AttendancePolicyAssignments
              key={selected.id + ":" + revision}
              policyId={selected.id}
            />
          ) : (
            <EmptyState
              icon={UsersRound}
              title={
                policies.length ? "Select a policy" : "No attendance policies"
              }
              description={
                policies.length
                  ? "Choose a policy to inspect current, scheduled, and ended assignments."
                  : "Create an attendance policy in Management before assigning employees."
              }
            />
          )}
        </>
      )}
      {open && (
        <AttendancePolicyPanel
          mode="assign"
          policies={active}
          template={selected}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            setRevision((value) => value + 1)
            result.retry()
          }}
        />
      )}
    </AttendanceShell>
  )
}
