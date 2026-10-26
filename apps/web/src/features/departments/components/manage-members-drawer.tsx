import { useEffect, useRef, useState } from "react"
import {
  CloseIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { cn } from "@/lib/utils"
import { EditMemberDialog } from "./edit-member-dialog"
import {
  panelAssignButton,
  panelDangerButton,
  panelEmpty,
  panelField,
  panelIconButton,
  panelInput,
  panelMuted,
  panelSecondaryButton,
  panelSelectTrigger,
} from "../styles/member-panel-styles"
import {
  assignDepartmentMembers,
  createTeam,
  deleteTeam,
  getDepartment,
  listEmployees,
  removeDepartmentMember,
  updateDepartmentMember,
  type DepartmentDetail,
  type DepartmentMember,
} from "../api/departments-api"

function MemberIdentity({
  member,
}: {
  member: Pick<DepartmentMember, "fullName" | "email" | "user">
}) {
  const email = member.email || member.user?.email || null
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] text-xs font-medium text-[#65718a]"
        aria-hidden="true"
      >
        {(member.fullName?.[0] || email?.[0] || "E").toUpperCase()}
      </span>
      <div className="min-w-0">
        <p
          className="m-0 truncate text-xs font-medium"
          title={member.fullName || email || "Employee"}
        >
          {member.fullName || email || "Employee"}
        </p>
        <p
          className={`${panelMuted} mt-0.5 mb-0 truncate`}
          title={email || undefined}
        >
          {email || "No account linked"}
        </p>
      </div>
    </div>
  )
}

export function ManageMembersDrawer({
  departmentId,
  canManage,
  onClose,
  onChanged,
}: {
  departmentId: string
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [detail, setDetail] = useState<DepartmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")

  // Available employees (for dropdown assignment)
  const [quickAssignEmployeeId, setQuickAssignEmployeeId] = useState("")
  const [quickAssignRetry, setQuickAssignRetry] = useState(0)
  const [quickAssignResult, setQuickAssignResult] = useState<{
    key: string
    employees: DepartmentMember[]
    error: string
  } | null>(null)

  // Member search state
  const [assignSearch, setAssignSearch] = useState("")
  const [debouncedAssignSearch, setDebouncedAssignSearch] = useState("")
  const [candidatePage, setCandidatePage] = useState(1)
  const [candidateRetry, setCandidateRetry] = useState(0)
  const [candidateResult, setCandidateResult] = useState<{
    key: string
    candidates: DepartmentMember[]
    total: number
    pageSize: number
    error: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<
    | { type: "member"; id: string; name: string }
    | { type: "team"; id: string; name: string }
    | { type: "team-member"; id: string; name: string; teamName: string }
    | null
  >(null)
  const [confirmationError, setConfirmationError] = useState("")

  // Team creation state
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamDesc, setNewTeamDesc] = useState("")
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Team member assignment state: mapping teamId -> selected employeeId
  const [teamAddSelection, setTeamAddSelection] = useState<
    Record<string, string>
  >({})

  // Member editing modal/dialog state
  const [editingMember, setEditingMember] = useState<DepartmentMember | null>(
    null,
  )
  const [memberPosition, setMemberPosition] = useState("")
  const [memberTeamId, setMemberTeamId] = useState("")
  const [editMemberError, setEditMemberError] = useState("")

  const [revision, setRevision] = useState(0)
  const quickAssignRequestKey = `${departmentId}\u0000${revision}\u0000${quickAssignRetry}`
  const candidateRequestKey = `${debouncedAssignSearch}\u0000${candidatePage}\u0000${candidateRetry}\u0000${revision}`
  const quickAssignResultIsCurrent =
    quickAssignResult?.key === quickAssignRequestKey
  const candidateResultIsCurrent = candidateResult?.key === candidateRequestKey
  const allEmployees = quickAssignResultIsCurrent
    ? quickAssignResult.employees
    : []
  const quickAssignLoading = canManage && !quickAssignResultIsCurrent
  const quickAssignError = quickAssignResultIsCurrent
    ? quickAssignResult.error
    : ""
  const searchCandidates = candidateResultIsCurrent
    ? candidateResult.candidates
    : []
  const candidateTotal = candidateResultIsCurrent ? candidateResult.total : 0
  const candidatePageSize = candidateResultIsCurrent
    ? candidateResult.pageSize
    : 20
  const candidateLoading = Boolean(
    canManage && debouncedAssignSearch && !candidateResultIsCurrent,
  )
  const candidateError = candidateResultIsCurrent ? candidateResult.error : ""
  const candidateResultsKey = candidateResultIsCurrent
    ? `${debouncedAssignSearch}\u0000${candidatePage}`
    : ""

  // 1. Fetch department details
  useEffect(() => {
    let active = true
    getDepartment(departmentId)
      .then((data) => {
        if (active) {
          setDetail(data)
          setLoadError("")
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Couldn't load this department.",
          )
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [departmentId, revision])

  // 2. Load the first employee page for quick assignment
  useEffect(() => {
    if (!canManage) return
    let active = true
    listEmployees("", undefined, 1)
      .then((res) => {
        if (active) {
          setQuickAssignResult({
            key: quickAssignRequestKey,
            employees: res.employees,
            error: "",
          })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setQuickAssignResult({
            key: quickAssignRequestKey,
            employees: [],
            error:
              error instanceof Error
                ? error.message
                : "Couldn't load employees to assign.",
          })
        }
      })
    return () => {
      active = false
    }
  }, [canManage, quickAssignRequestKey])

  // 3. Debounced search for assignable employees
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssignSearch(assignSearch.trim())
      setCandidatePage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [assignSearch])

  useEffect(() => {
    if (!canManage || !debouncedAssignSearch) return
    let active = true
    listEmployees(debouncedAssignSearch, undefined, candidatePage)
      .then((res) => {
        if (active) {
          setCandidateResult({
            key: candidateRequestKey,
            candidates: res.employees.filter(
              (employee) => employee.departmentId !== departmentId,
            ),
            total: res.total,
            pageSize: res.pageSize,
            error: "",
          })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCandidateResult({
            key: candidateRequestKey,
            candidates: [],
            total: 0,
            pageSize: 20,
            error:
              error instanceof Error
                ? error.message
                : "Couldn't search employees.",
          })
        }
      })
    return () => {
      active = false
    }
  }, [
    canManage,
    candidateRequestKey,
    candidatePage,
    debouncedAssignSearch,
    departmentId,
  ])

  const isSearching = Boolean(
    assignSearch.trim() &&
    (assignSearch.trim() !== debouncedAssignSearch || candidateLoading),
  )
  const expectedCandidateResultsKey = `${debouncedAssignSearch}\u0000${candidatePage}`
  const displayedCandidates =
    assignSearch.trim() &&
    assignSearch.trim() === debouncedAssignSearch &&
    candidateResultsKey === expectedCandidateResultsKey
      ? searchCandidates
      : []

  const currentMemberIds = new Set(detail?.members.map((m) => m.id) || [])
  const departmentHeadId = detail?.headId ?? null
  const availableEmployeesForQuickAssign = allEmployees.filter(
    (employee) =>
      employee.departmentId !== departmentId &&
      !currentMemberIds.has(employee.id),
  )
  const selectedQuickAssignEmployee = availableEmployeesForQuickAssign.find(
    (employee) => employee.id === quickAssignEmployeeId,
  )

  async function handleAddMember(employeeId: string) {
    if (
      !availableEmployeesForQuickAssign.some(
        (employee) => employee.id === employeeId,
      )
    )
      return
    try {
      setActionError("")
      setSubmitting(true)
      await assignDepartmentMembers(departmentId, [employeeId])
      setAssignSearch("")
      setQuickAssignEmployeeId("")
      setCandidatePage(1)
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Couldn't assign this employee.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleRemoveMember(userId: string) {
    const member = detail?.members.find((candidate) => candidate.id === userId)
    setConfirmationError("")
    setConfirmation({
      type: "member",
      id: userId,
      name: member?.fullName || member?.email || "this employee",
    })
  }

  async function confirmRemoval() {
    if (!confirmation || submitting) return
    try {
      setActionError("")
      setConfirmationError("")
      setSubmitting(true)
      if (confirmation.type === "member") {
        await removeDepartmentMember(departmentId, confirmation.id)
      } else if (confirmation.type === "team") {
        await deleteTeam(departmentId, confirmation.id)
      } else {
        await updateDepartmentMember(departmentId, confirmation.id, {
          teamId: null,
        })
      }
      setConfirmation(null)
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setConfirmationError(
        error instanceof Error
          ? error.message
          : confirmation.type === "team"
            ? "Couldn't delete this team."
            : confirmation.type === "team-member"
              ? "Couldn't remove this team assignment."
              : "Couldn't remove this member.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    try {
      setActionError("")
      setSubmitting(true)
      await createTeam(departmentId, {
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
      })
      setNewTeamName("")
      setNewTeamDesc("")
      setCreatingTeam(false)
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't create this team.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleDeleteTeam(teamId: string, teamName: string) {
    setConfirmationError("")
    setConfirmation({ type: "team", id: teamId, name: teamName })
  }

  async function handleAssignMemberToTeam(teamId: string, userId: string) {
    if (!userId) return
    try {
      setActionError("")
      setSubmitting(true)
      await updateDepartmentMember(departmentId, userId, { teamId })
      setTeamAddSelection((prev) => ({ ...prev, [teamId]: "" }))
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Couldn't update this team assignment.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleRemoveMemberFromTeam(userId: string) {
    const member = detail?.members.find((candidate) => candidate.id === userId)
    const teamId = detail?.members.find((entry) => entry.id === userId)?.teamId
    const team = detail?.teams.find((candidate) => candidate.id === teamId)
    setConfirmationError("")
    setConfirmation({
      type: "team-member",
      id: userId,
      name: member?.fullName || member?.email || "this employee",
      teamName: team?.name || "this team",
    })
  }

  async function handleSaveMemberDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!editingMember) return

    const lowerPos = memberPosition.trim().toLowerCase()
    if (lowerPos === "dept head" || lowerPos === "department head") {
      setEditMemberError(
        "Only the assigned Department Head can have the title 'Department Head'. For regular members, please specify their job title (e.g. Specialist, Analyst, Coordinator).",
      )
      return
    }

    try {
      setSubmitting(true)
      setEditMemberError("")
      await updateDepartmentMember(departmentId, editingMember.id, {
        position: memberPosition.trim() || null,
        teamId: memberTeamId || null,
      })
      setEditingMember(null)
      setRevision((r) => r + 1)
      onChanged()
    } catch (err: unknown) {
      setEditMemberError(
        err instanceof Error ? err.message : "Failed to save details",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function startEditMember(member: DepartmentMember) {
    // Prevent editing the department head as a regular team member
    if (detail && detail.headId !== null && detail.headId === member.userId)
      return
    setEditingMember(member)
    setEditMemberError("")
    setMemberPosition(
      member.position?.toLowerCase() === "dept head" ||
        member.position?.toLowerCase() === "department head"
        ? ""
        : member.position || "",
    )
    setMemberTeamId(member.teamId || "")
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose()
      }}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_40%)]"
        className="inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (submitting) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected) {
            opener.focus()
          } else {
            const heading = document.querySelector<HTMLElement>("main h1")
            if (heading) {
              if (!heading.hasAttribute("tabindex"))
                heading.setAttribute("tabindex", "-1")
              heading.focus()
            }
          }
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Members &amp; teams
            </SheetTitle>
            <SheetDescription className="sr-only">
              Manage department employees and team assignments.
            </SheetDescription>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs">
              <span className="truncate font-medium">
                {detail?.name || "Department"}
              </span>
              {detail?.code && <Pill>{detail.code}</Pill>}
            </div>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              className={panelIconButton}
              aria-label="Close drawer"
              disabled={submitting}
            >
              <CloseIcon width="16" height="16" />
            </button>
          </SheetClose>
        </header>

        <Tabs defaultValue="members" className="flex min-h-0 flex-1 flex-col">
          <TabsList
            className="flex h-auto flex-none justify-start gap-5 rounded-none border-b border-[#eceef1] bg-transparent px-6 py-0 max-[560px]:px-5"
            aria-label="Department sections"
          >
            {(["members", "teams"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "flex min-h-[46px] cursor-pointer items-center gap-2 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 text-xs font-medium text-[#738096] shadow-none hover:text-foreground data-[state=active]:border-b-[#0b0b0c] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  focusRing,
                )}
              >
                {tab === "members" ? "Employees" : "Teams"}
                <Pill className="tabular-nums">
                  {tab === "members"
                    ? (detail?.members.length ?? 0)
                    : (detail?.teams.length ?? 0)}
                </Pill>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5">
            {loading ? (
              <div className={panelEmpty} role="status">
                Loading department...
              </div>
            ) : loadError ? (
              <div className={panelEmpty} role="alert">
                <p className="m-0">{loadError}</p>
                <button
                  type="button"
                  className={cn(
                    "cursor-pointer rounded border-0 bg-transparent p-1 font-semibold text-foreground underline underline-offset-4",
                    focusRing,
                  )}
                  onClick={() => {
                    setLoading(true)
                    setRevision((r) => r + 1)
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                {actionError && (
                  <p
                    className="mt-0 mb-4 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]"
                    role="alert"
                  >
                    {actionError}
                  </p>
                )}
                <TabsContent value="members" className="mt-0 space-y-5">
                  {canManage && (
                    <section
                      className="grid min-w-0 gap-3 rounded-lg border border-[#e8ebef] p-4"
                      aria-label="Assign employees"
                    >
                      <div>
                        <h3 className="m-0 text-xs font-semibold">
                          Add members
                        </h3>
                        <p className={`${panelMuted} mt-1 mb-0`}>
                          Assign an existing employee to this department.
                        </p>
                      </div>
                      <div className="flex min-w-0 items-start gap-2">
                        <Select
                          value={selectedQuickAssignEmployee?.id ?? ""}
                          onValueChange={setQuickAssignEmployeeId}
                          disabled={
                            submitting ||
                            quickAssignLoading ||
                            Boolean(quickAssignError)
                          }
                        >
                          <SelectTrigger
                            className={cn(panelSelectTrigger, "flex-1")}
                            aria-label="Employee to assign"
                          >
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent collisionPadding={24}>
                            {quickAssignLoading ? (
                              <p
                                className="m-0 p-3 text-xs text-muted-foreground"
                                role="status"
                              >
                                Loading employees...
                              </p>
                            ) : quickAssignError ? (
                              <p
                                className="m-0 p-3 text-xs text-destructive"
                                role="alert"
                              >
                                Employee list unavailable.
                              </p>
                            ) : availableEmployeesForQuickAssign.length ===
                              0 ? (
                              <p className="m-0 p-3 text-xs text-muted-foreground">
                                No employees available to assign.
                              </p>
                            ) : (
                              availableEmployeesForQuickAssign.map(
                                (employee) => (
                                  <SelectItem
                                    key={employee.id}
                                    value={employee.id}
                                  >
                                    {employee.fullName ||
                                      employee.email ||
                                      "Employee"}
                                    {employee.user?.role
                                      ? ` (${employee.user.role})`
                                      : " (No account)"}
                                  </SelectItem>
                                ),
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          className={panelAssignButton}
                          disabled={
                            !selectedQuickAssignEmployee ||
                            submitting ||
                            quickAssignLoading ||
                            Boolean(quickAssignError)
                          }
                          onClick={() =>
                            void handleAddMember(quickAssignEmployeeId)
                          }
                        >
                          <PlusIcon width="14" height="14" /> Assign
                        </Button>
                      </div>
                      {quickAssignError && (
                        <div
                          className="flex items-center justify-between gap-3 text-xs"
                          role="alert"
                        >
                          <span className="text-[#bc3649]">
                            {quickAssignError}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className={panelSecondaryButton}
                            disabled={submitting || quickAssignLoading}
                            onClick={() =>
                              setQuickAssignRetry((count) => count + 1)
                            }
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                      <div className="border-t border-[#eceef1] pt-3">
                        <label className="flex h-[34px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#7b8ca7] focus-within:bg-[#f8fafd]">
                          <SearchIcon
                            width="16"
                            height="16"
                            className="flex-none"
                          />
                          <span className="sr-only">
                            Search employees to assign
                          </span>
                          <input
                            id="member-assign-search"
                            className="w-full min-w-0 border-0 bg-transparent text-xs text-foreground outline-none placeholder:text-[#8a9ab1]"
                            placeholder="Search name or email"
                            value={assignSearch}
                            onChange={(event) =>
                              setAssignSearch(event.target.value)
                            }
                            disabled={submitting}
                          />
                        </label>
                      </div>
                      {isSearching && (
                        <p className={`${panelMuted} m-0`} role="status">
                          Searching employees...
                        </p>
                      )}
                      {candidateError && !isSearching && (
                        <div
                          className="flex items-center justify-between gap-3 text-xs"
                          role="alert"
                        >
                          <span className="text-[#bc3649]">
                            {candidateError}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className={panelSecondaryButton}
                            disabled={candidateLoading || submitting}
                            onClick={() =>
                              setCandidateRetry((count) => count + 1)
                            }
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                      {displayedCandidates.length > 0 && !isSearching && (
                        <ul
                          className="m-0 grid list-none gap-2 p-0"
                          aria-label="Employee search results"
                        >
                          {displayedCandidates.map((employee) => (
                            <li
                              key={employee.id}
                              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e8ebef] p-2.5"
                            >
                              <MemberIdentity member={employee} />
                              <Button
                                type="button"
                                variant="outline"
                                className={panelSecondaryButton}
                                aria-label={`Assign ${employee.fullName || employee.email || "employee"}`}
                                onClick={() =>
                                  void handleAddMember(employee.id)
                                }
                                disabled={submitting}
                              >
                                Assign
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {debouncedAssignSearch &&
                        assignSearch.trim() === debouncedAssignSearch &&
                        !isSearching &&
                        !candidateError &&
                        displayedCandidates.length === 0 && (
                          <p className={`${panelMuted} m-0`}>
                            No unassigned employees match your search.
                          </p>
                        )}
                      {debouncedAssignSearch &&
                        assignSearch.trim() === debouncedAssignSearch &&
                        !isSearching &&
                        !candidateError &&
                        candidateTotal > candidatePageSize && (
                          <div className="flex items-center justify-between text-[11px] text-[#65718a]">
                            <span>
                              Page {candidatePage} of{" "}
                              {Math.max(
                                1,
                                Math.ceil(candidateTotal / candidatePageSize),
                              )}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className={cn(
                                  "cursor-pointer rounded border border-[#e1e4ea] bg-white px-2 py-1",
                                  focusRing,
                                )}
                                disabled={candidatePage <= 1 || submitting}
                                onClick={() =>
                                  setCandidatePage((page) => page - 1)
                                }
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "cursor-pointer rounded border border-[#e1e4ea] bg-white px-2 py-1",
                                  focusRing,
                                )}
                                disabled={
                                  candidatePage >=
                                    Math.ceil(
                                      candidateTotal / candidatePageSize,
                                    ) || submitting
                                }
                                onClick={() =>
                                  setCandidatePage((page) => page + 1)
                                }
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                    </section>
                  )}

                  <section aria-label="Current members">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="m-0 text-xs font-semibold">
                        Current members
                      </h3>
                      <span className={panelMuted}>
                        {detail?.members.length ?? 0} members
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-[#e8ebef]">
                      {detail?.members.length === 0 ? (
                        <p className={`${panelEmpty} m-0`}>
                          No members assigned to this department yet.
                        </p>
                      ) : (
                        <ul className="m-0 list-none divide-y divide-[#eceef1] p-0">
                          {[...(detail?.members || [])]
                            .sort((a, b) => {
                              if (
                                departmentHeadId !== null &&
                                departmentHeadId === a.userId
                              )
                                return -1
                              if (
                                departmentHeadId !== null &&
                                departmentHeadId === b.userId
                              )
                                return 1
                              const aTeam = a.team?.name || ""
                              const bTeam = b.team?.name || ""
                              if (aTeam && !bTeam) return -1
                              if (!aTeam && bTeam) return 1
                              return (
                                aTeam.localeCompare(bTeam) ||
                                (
                                  a.fullName ||
                                  a.email ||
                                  a.user?.email ||
                                  ""
                                ).localeCompare(
                                  b.fullName || b.email || b.user?.email || "",
                                )
                              )
                            })
                            .map((member) => {
                              const isHead =
                                departmentHeadId !== null &&
                                departmentHeadId === member.userId
                              const position =
                                member.position &&
                                !["dept head", "department head"].includes(
                                  member.position.toLowerCase(),
                                )
                                  ? member.position
                                  : null
                              return (
                                <li
                                  key={member.id}
                                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#fafbfc]"
                                >
                                  <div className="min-w-0 flex-1 basis-[180px]">
                                    <MemberIdentity member={member} />
                                    <div className="mt-2 ml-[42px] flex flex-wrap items-center gap-1.5">
                                      {isHead ? (
                                        <Pill>Department head</Pill>
                                      ) : (
                                        <>
                                          {position && (
                                            <span className="text-[11px] break-words text-[#738096]">
                                              {position}
                                            </span>
                                          )}
                                          {member.team && (
                                            <Pill title={member.team.name}>
                                              {member.team.name}
                                            </Pill>
                                          )}
                                        </>
                                      )}
                                      <span className="text-[10px] text-[#8a9ab1]">
                                        {member.user?.role || "No account"}
                                      </span>
                                    </div>
                                  </div>
                                  {canManage && !isHead && (
                                    <div className="flex flex-none items-center gap-2">
                                      <Button
                                        type="button"
                                        className={panelAssignButton}
                                        aria-label={`Edit ${member.fullName || member.email || member.user?.email || "employee"}`}
                                        onClick={() => startEditMember(member)}
                                        disabled={submitting}
                                      >
                                        Edit info
                                      </Button>
                                      <button
                                        type="button"
                                        className={panelDangerButton}
                                        aria-label={`Remove ${member.fullName || member.email || member.user?.email || "employee"} from department`}
                                        title="Remove from department"
                                        disabled={submitting}
                                        onClick={() =>
                                          void handleRemoveMember(member.id)
                                        }
                                      >
                                        <TrashIcon width="15" height="15" />
                                      </button>
                                    </div>
                                  )}
                                </li>
                              )
                            })}
                        </ul>
                      )}
                    </div>
                  </section>
                </TabsContent>
                <TabsContent value="teams" className="mt-0">
                  <section className="grid gap-4" aria-label="Department teams">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-xs font-semibold">
                          Department teams
                        </h3>
                        <p className={`${panelMuted} mt-1 mb-0`}>
                          Organize employees into focused teams.
                        </p>
                      </div>
                      {canManage && !creatingTeam && (
                        <Button
                          type="button"
                          className={panelAssignButton}
                          onClick={() => setCreatingTeam(true)}
                        >
                          <PlusIcon width="14" height="14" /> Create team
                        </Button>
                      )}
                    </div>
                    {canManage && creatingTeam && (
                      <form
                        onSubmit={(event) => void handleCreateTeam(event)}
                        className="grid gap-4 rounded-lg border border-[#e8ebef] p-4"
                      >
                        <h4 className="m-0 text-xs font-semibold">New team</h4>
                        <label className={panelField} htmlFor="team-name">
                          Team name{" "}
                          <Input
                            id="team-name"
                            className={panelInput}
                            placeholder="e.g. Software engineering"
                            value={newTeamName}
                            onChange={(event) =>
                              setNewTeamName(event.target.value)
                            }
                            required
                            autoFocus
                            disabled={submitting}
                          />
                        </label>
                        <label className={panelField} htmlFor="team-desc">
                          Description{" "}
                          <span className="sr-only">(optional)</span>
                          <Input
                            id="team-desc"
                            className={panelInput}
                            placeholder="What does this team do? (optional)"
                            value={newTeamDesc}
                            onChange={(event) =>
                              setNewTeamDesc(event.target.value)
                            }
                            disabled={submitting}
                          />
                        </label>
                        <div className="flex justify-end gap-2 border-t border-[#eceef1] pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            className={panelSecondaryButton}
                            onClick={() => setCreatingTeam(false)}
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className={panelAssignButton}
                            disabled={submitting}
                          >
                            {submitting ? "Saving..." : "Save team"}
                          </Button>
                        </div>
                      </form>
                    )}
                    {detail?.teams.length === 0 ? (
                      <div className="rounded-lg border border-[#e8ebef]">
                        <p className={`${panelEmpty} m-0`}>
                          No teams created in this department yet.
                        </p>
                      </div>
                    ) : (
                      detail?.teams.map((team) => {
                        const teamMembers = detail.members.filter(
                          (member) => member.teamId === team.id,
                        )
                        const eligibleEmployees = detail.members.filter(
                          (member) =>
                            (departmentHeadId === null ||
                              member.userId !== departmentHeadId) &&
                            member.teamId !== team.id,
                        )
                        const selectedUserId = teamAddSelection[team.id] || ""
                        return (
                          <section
                            key={team.id}
                            className="min-w-0 overflow-visible rounded-lg border border-[#e8ebef]"
                            aria-label={`${team.name} team`}
                          >
                            <header className="flex items-start justify-between gap-3 rounded-t-lg border-b border-[#eceef1] bg-[#f7f7f8] px-4 py-3">
                              <div className="min-w-0">
                                <h4 className="m-0 text-xs font-semibold break-words">
                                  {team.name}
                                </h4>
                                {team.description && (
                                  <p
                                    className={`${panelMuted} mt-1 mb-0 break-words`}
                                  >
                                    {team.description}
                                  </p>
                                )}
                                <p className={`${panelMuted} mt-1 mb-0`}>
                                  {teamMembers.length}{" "}
                                  {teamMembers.length === 1
                                    ? "member"
                                    : "members"}
                                </p>
                              </div>
                              {canManage && (
                                <button
                                  type="button"
                                  className={panelDangerButton}
                                  aria-label={`Delete ${team.name} team`}
                                  title="Delete team"
                                  disabled={submitting}
                                  onClick={() =>
                                    void handleDeleteTeam(team.id, team.name)
                                  }
                                >
                                  <TrashIcon width="15" height="15" />
                                </button>
                              )}
                            </header>
                            {teamMembers.length === 0 ? (
                              <p className="m-0 px-4 py-5 text-xs text-[#738096]">
                                No members assigned to this team yet.
                              </p>
                            ) : (
                              <ul
                                className="m-0 list-none divide-y divide-[#eceef1] p-0"
                                aria-label={`${team.name} members`}
                              >
                                {teamMembers.map((member) => (
                                  <li
                                    key={member.id}
                                    className="flex min-w-0 items-center justify-between gap-3 px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <MemberIdentity member={member} />
                                      {member.position &&
                                        ![
                                          "dept head",
                                          "department head",
                                        ].includes(
                                          member.position.toLowerCase(),
                                        ) && (
                                          <p
                                            className={`${panelMuted} mt-1 mb-0 ml-[42px] break-words`}
                                          >
                                            {member.position}
                                          </p>
                                        )}
                                    </div>
                                    {canManage && (
                                      <button
                                        type="button"
                                        className={panelIconButton}
                                        aria-label={`Remove ${member.fullName || member.email || member.user?.email || "employee"} from ${team.name}`}
                                        title="Remove from team"
                                        disabled={submitting}
                                        onClick={() =>
                                          void handleRemoveMemberFromTeam(
                                            member.id,
                                          )
                                        }
                                      >
                                        <CloseIcon width="14" height="14" />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {canManage && (
                              <div className="border-t border-[#eceef1] p-3">
                                {eligibleEmployees.length > 0 ? (
                                  <div className="flex min-w-0 items-start gap-2">
                                    <Select
                                      value={selectedUserId}
                                      onValueChange={(value) =>
                                        setTeamAddSelection((previous) => ({
                                          ...previous,
                                          [team.id]: value,
                                        }))
                                      }
                                      disabled={submitting}
                                    >
                                      <SelectTrigger
                                        className={cn(
                                          panelSelectTrigger,
                                          "flex-1",
                                        )}
                                        aria-label={`Add employee to ${team.name}`}
                                      >
                                        <SelectValue placeholder="Select department member" />
                                      </SelectTrigger>
                                      <SelectContent collisionPadding={24}>
                                        {eligibleEmployees.map((member) => (
                                          <SelectItem
                                            key={member.id}
                                            value={member.id}
                                          >
                                            {member.fullName ||
                                              member.email ||
                                              member.user?.email ||
                                              "Employee"}
                                            {member.position
                                              ? ` (${member.position})`
                                              : ""}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      className={panelAssignButton}
                                      aria-label={`Add selected employee to ${team.name}`}
                                      disabled={!selectedUserId || submitting}
                                      onClick={() =>
                                        void handleAssignMemberToTeam(
                                          team.id,
                                          selectedUserId,
                                        )
                                      }
                                    >
                                      <PlusIcon width="14" height="14" /> Add
                                    </Button>
                                  </div>
                                ) : (
                                  <p className={`${panelMuted} m-0`}>
                                    {detail.members.filter(
                                      (member) =>
                                        departmentHeadId === null ||
                                        member.userId !== departmentHeadId,
                                    ).length === 0
                                      ? "Assign employees in the Employees tab first to add them here."
                                      : "All department employees are already in this team."}
                                  </p>
                                )}
                              </div>
                            )}
                          </section>
                        )
                      })
                    )}
                  </section>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
        <footer className="flex flex-none justify-end border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
          <SheetClose asChild>
            <Button
              type="button"
              className={panelAssignButton}
              disabled={submitting}
            >
              Done
            </Button>
          </SheetClose>
        </footer>
        {editingMember && (
          <EditMemberDialog
            member={editingMember}
            teams={detail?.teams || []}
            position={memberPosition}
            teamId={memberTeamId}
            error={editMemberError}
            submitting={submitting}
            onPositionChange={setMemberPosition}
            onTeamChange={setMemberTeamId}
            onClose={() => setEditingMember(null)}
            onSubmit={(event) => void handleSaveMemberDetails(event)}
          />
        )}
        {confirmation && (
          <ConfirmationDialog
            title={
              confirmation.type === "team"
                ? "Delete team?"
                : confirmation.type === "member"
                  ? "Remove employee from department?"
                  : "Remove employee from team?"
            }
            subject={
              confirmation.type === "team"
                ? confirmation.name
                : confirmation.type === "team-member"
                  ? `${confirmation.name} · ${confirmation.teamName}`
                  : confirmation.name
            }
            description={
              confirmation.type === "team"
                ? "Team membership will be cleared. Employees will remain in the department."
                : confirmation.type === "member"
                  ? "The employee record and any linked account will remain."
                  : "The employee will remain in the department."
            }
            confirmLabel={
              confirmation.type === "team" ? "Delete team" : "Remove"
            }
            pendingLabel={
              confirmation.type === "team" ? "Deleting…" : "Removing…"
            }
            pending={submitting}
            error={confirmationError}
            onClose={() => {
              if (!submitting) {
                setConfirmation(null)
                setConfirmationError("")
              }
            }}
            onConfirm={() => void confirmRemoval()}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
