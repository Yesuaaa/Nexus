"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { PlanEditor, emptyPlan } from "../components/plan-editor"
import type { ProjectWorkPlan } from "../api/project-workspace-api"
import {
  createProjectWorkspaces,
  listApprovedProjectBookings,
  listProjectWorkspaceTemplates,
  type ProjectWorkspaceBooking,
  type ProjectWorkspaceTemplate,
} from "../api/project-workspace-api"

export function NewWorkspacePage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<ProjectWorkspaceBooking[]>([])
  const [templates, setTemplates] = useState<ProjectWorkspaceTemplate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [customPlans, setCustomPlans] = useState<
    Record<string, ProjectWorkPlan>
  >({})
  const [structure, setStructure] = useState<"SEPARATE" | "MULTI_WORKSTREAM">(
    "SEPARATE",
  )
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      listApprovedProjectBookings(controller.signal),
      listProjectWorkspaceTemplates(controller.signal),
    ])
      .then(([rows, catalog]) => {
        if (!controller.signal.aborted) {
          setBookings(rows)
          setTemplates(catalog)
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Couldn't load bookings",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])
  async function create() {
    setBusy(true)
    try {
      const result = await createProjectWorkspaces({
        requestIds: selected,
        structure,
        name,
        templateKeys: keys,
        customPlans,
      })
      router.push(`/project-workspace/${result.workspaces[0].id}`)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't create workspace",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className={`${contentClass} p-8`}>
      <h1 className="text-2xl font-semibold tracking-tight">
        Start project from approved booking
      </h1>
      <p className="text-xs text-[#738096]">
        Choose bookings for one client, then select a delivery template for each
        service.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading approved bookings…</p>
      ) : (
        <>
          <h2 className="mt-7 text-sm font-semibold">1. Approved bookings</h2>
          {!bookings.length && (
            <p className="text-xs text-[#738096]">
              No bookings are ready for workspace setup. A client must first
              formally accept the quotation.
            </p>
          )}
          <div className="grid gap-2">
            {bookings.map((booking) => (
              <label
                key={booking.requestId}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 text-xs transition-colors ${selected.includes(booking.requestId) ? "border-[#203f80] bg-[#294c96] text-white [&_span]:text-white/85 [&_strong]:text-white" : "border-[#dfe4ec]"}`}
              >
                <input
                  type="checkbox"
                  className="accent-[#294c96]"
                  checked={selected.includes(booking.requestId)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, booking.requestId]
                        : current.filter((id) => id !== booking.requestId),
                    )
                  }
                />
                <span>
                  <strong>{booking.name}</strong>
                  <span className="mt-1 block text-[#738096]">
                    {booking.serviceName} · {booking.client.fullName} ·{" "}
                    {booking.referenceNumber}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <h2 className="mt-7 text-sm font-semibold">2. Structure</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["SEPARATE", "MULTI_WORKSTREAM"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={structure === value}
                onClick={() => setStructure(value)}
                className={`rounded-lg border p-4 text-left text-xs transition-colors ${structure === value ? "border-[#203f80] bg-[#294c96] text-white [&_span]:text-white/85" : "border-[#dfe4ec]"}`}
              >
                <strong>
                  {value === "SEPARATE"
                    ? "Separate projects"
                    : "One project, multiple workstreams"}
                </strong>
                <span className="mt-1 block text-[#738096]">
                  {value === "SEPARATE"
                    ? "A separate plan and team for each service."
                    : "Related services share one workspace, with their own plans and teams."}
                </span>
              </button>
            ))}
          </div>
          {structure === "MULTI_WORKSTREAM" && (
            <label className="mt-4 block text-xs">
              Project name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={120}
                className="mt-2 block w-full rounded-lg border border-[#dfe4ec] bg-transparent p-3"
              />
            </label>
          )}
          {bookings
            .filter((booking) => selected.includes(booking.requestId))
            .map((booking) => (
              <section key={booking.requestId} className="mt-7">
                <h2 className="text-sm font-semibold">
                  Template for {booking.serviceName}
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                  {templates.map((template) => (
                    <button
                      key={template.key}
                      aria-pressed={keys[booking.requestId] === template.key}
                      onClick={() => {
                        if (
                          template.key === "blank-custom" &&
                          !customPlans[booking.requestId]
                        )
                          setCustomPlans((current) => ({
                            ...current,
                            [booking.requestId]: emptyPlan(),
                          }))
                        setKeys((current) => ({
                          ...current,
                          [booking.requestId]: template.key,
                        }))
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${keys[booking.requestId] === template.key ? "border-[#203f80] bg-[#294c96] text-white [&_p]:text-white/85 [&_span]:text-white/85" : "border-[#dfe4ec] bg-background"}`}
                    >
                      <strong className="text-xs">{template.name}</strong>
                      <p className="text-xs leading-5 text-[#738096]">
                        {template.description}
                      </p>
                      <span className="text-[10px] text-[#536b91]">
                        {template.type} · {template.phases.length} phases
                      </span>
                    </button>
                  ))}
                </div>
                {keys[booking.requestId] === "blank-custom" &&
                  customPlans[booking.requestId] && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold">
                        Build your custom plan
                      </h3>
                      <PlanEditor
                        plan={customPlans[booking.requestId]}
                        onChange={(plan) =>
                          setCustomPlans((current) => ({
                            ...current,
                            [booking.requestId]: plan,
                          }))
                        }
                        disabled={busy}
                      />
                    </div>
                  )}
              </section>
            ))}
          <footer className="mt-8 flex justify-end gap-2 border-t border-[#eceef1] pt-5">
            <Button
              variant="outline"
              onClick={() => router.push("/project-workspace")}
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </Button>
            <Button
              className="bg-[#294c96] text-white hover:bg-[#203f80]"
              disabled={
                busy || !selected.length || selected.some((id) => !keys[id])
              }
              onClick={() => void create()}
            >
              {busy ? "Creating…" : "Create workspace"}
            </Button>
          </footer>
        </>
      )}
    </main>
  )
}
