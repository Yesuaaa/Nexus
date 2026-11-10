import { Form } from "@/components/ui/form"
import { useEffect, useRef, useState } from "react"
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { EdgeSheetContent } from "@/components/ui/edge-sheet"
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { MemberIdentity } from "@/components/ui/member-identity"
import { SearchField } from "@/components/ui/search-field"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import { EditMemberForm } from "./edit-member-form"
import { PanelSubview } from "./panel-subview"
import {
  panelAssignButton,
  panelDangerButton,
  panelEmpty,
  panelField,
  panelIconButton,
  panelInput,
  panelMuted,
  panelSecondaryButton,
} from "../styles/member-panel-styles"
import {
  assignDepartmentMembers,
  createTeam,
  deleteTeam,
  getDepartment,
  listAssignableStaff,
  removeDepartmentMember,
  updateDepartmentMember,
  type DepartmentDetail,
  type DepartmentMember,
  type DepartmentStaffOption,
} from "../api/departments-api"

const nameBadge =
  "flex-none rounded bg-[#e8eef8] px-1.5 py-px text-[10px] leading-4 font-semibold text-[#294a9b]"

const roleLabels = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "Client",
} as const

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
  const { open, handleOpenChange } = useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [detail, setDetail] = useState<DepartmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")

  // Available staff search state
  const [assignSearch, setAssignSearch] = useState("")
  const [debouncedAssignSearch, setDebouncedAssignSearch] = useState("")
  const [candidatePage, setCandidatePage] = useState(1)
  const [candidateRetry, setCandidateRetry] = useState(0)
  const [candidateResult, setCandidateResult] = useState<{
    key: string
    candidates: DepartmentStaffOption[]
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
  const [newTeamMemberSearch, setNewTeamMemberSearch] = useState("")
  const [newTeamMemberIds, setNewTeamMemberIds] = useState<string[]>([])
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [assignMembersOpen, setAssignMembersOpen] = useState(false)
  const [assignTeamId, setAssignTeamId] = useState<string | null>(null)
  const [teamAssignSearch, setTeamAssignSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"members" | "teams">("members")
  const assignTriggerRef = useRef<HTMLButtonElement>(null)

  function closeAssignMembers() {
    if (submitting) return
    setAssignMembersOpen(false)
    // Wait for the members view to drop `inert` before restoring focus.
    requestAnimationFrame(() => assignTriggerRef.current?.focus())
  }

  const createTeamTriggerRef = useRef<HTMLButtonElement>(null)

  function closeCreateTeam() {
    if (submitting) return
    setCreatingTeam(false)
    requestAnimationFrame(() => createTeamTriggerRef.current?.focus())
  }

  // Button that opened the per-row screens (assign to team, edit member).
  const subviewOpenerRef = useRef<HTMLElement | null>(null)

  function restoreSubviewOpenerFocus() {
    requestAnimationFrame(() => {
      const opener = subviewOpenerRef.current
      if (opener?.isConnected) opener.focus()
    })
  }

  function closeAssignTeam() {
    if (submitting) return
    setAssignTeamId(null)
    restoreSubviewOpenerFocus()
  }

  function closeEditMember() {
    if (submitting) return
    setEditingMember(null)
    restoreSubviewOpenerFocus()
  }

  // Member editing modal/dialog state
  const [memberSearch, setMemberSearch] = useState("")
  const memberQuery = memberSearch.trim().toLowerCase()
  const visibleMembers = (detail?.members ?? []).filter(
    (member) =>
      !memberQuery ||
      [
        member.fullName,
        member.email,
        member.user?.fullName,
        member.user?.email,
        member.position,
        member.team?.name,
      ].some((value) => value?.toLowerCase().includes(memberQuery)),
  )
  const [editingMember, setEditingMember] = useState<DepartmentMember | null>(
    null,
  )
  const [memberPosition, setMemberPosition] = useState("")
  const [memberTeamId, setMemberTeamId] = useState("")
  const [editMemberError, setEditMemberError] = useState("")

  const [revision, setRevision] = useState(0)
  const candidateRequestKey = `${debouncedAssignSearch}\u0000${candidatePage}\u0000${candidateRetry}\u0000${revision}`
  const candidateResultIsCurrent = candidateResult?.key === candidateRequestKey
  const searchCandidates = candidateResultIsCurrent
    ? candidateResult.candidates
    : []
  const candidateTotal = candidateResultIsCurrent ? candidateResult.total : 0
  const candidatePageSize = candidateResultIsCurrent
    ? candidateResult.pageSize
    : 10
  const candidateLoading = Boolean(canManage && !candidateResultIsCurrent)
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

  // 2. Debounced search for available staff
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssignSearch(assignSearch.trim())
      setCandidatePage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [assignSearch])

  useEffect(() => {
    if (!canManage) return
    let active = true
    listAssignableStaff(debouncedAssignSearch, candidatePage)
      .then((res) => {
        if (active) {
          setCandidateResult({
            key: candidateRequestKey,
            candidates: res.employees,
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
            pageSize: 10,
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
    assignSearch.trim() === debouncedAssignSearch &&
    candidateResultsKey === expectedCandidateResultsKey
      ? searchCandidates
      : []

  const currentMemberAccountIds = new Set(
    detail?.members.flatMap((member) =>
      member.userId ? [member.userId] : [],
    ) || [],
  )
  const departmentHeadId = detail?.headId ?? null
  const availableStaffToAssign = displayedCandidates.filter(
    (employee) => !currentMemberAccountIds.has(employee.id),
  )
  const newTeamMemberQuery = newTeamMemberSearch.trim().toLowerCase()
  const newTeamMemberCandidates = (detail?.members ?? []).filter(
    (member) =>
      member.status === "ACTIVE" &&
      member.user?.role === "STAFF" &&
      member.user.isActive &&
      member.user.accountDeletedAt === null &&
      (departmentHeadId === null || member.userId !== departmentHeadId),
  )
  const filteredNewTeamMembers = newTeamMemberCandidates.filter((member) =>
    [
      member.fullName,
      member.email,
      member.user?.fullName,
      member.user?.email,
      member.position,
    ].some((value) => value?.toLowerCase().includes(newTeamMemberQuery)),
  )

  const assignTeam =
    detail?.teams.find((team) => team.id === assignTeamId) ?? null
  const assignTeamCandidates = newTeamMemberCandidates.filter(
    (member) => member.teamId !== assignTeamId,
  )
  const teamAssignQuery = teamAssignSearch.trim().toLowerCase()
  const filteredAssignTeamCandidates = assignTeamCandidates.filter((member) =>
    [
      member.fullName,
      member.email,
      member.user?.fullName,
      member.user?.email,
      member.position,
    ].some((value) => value?.toLowerCase().includes(teamAssignQuery)),
  )
  const subviewOpen =
    assignMembersOpen ||
    creatingTeam ||
    assignTeam !== null ||
    editingMember !== null

  function toggleNewTeamMember(memberId: string) {
    setNewTeamMemberIds((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId],
    )
  }

  async function handleAddMember(userId: string) {
    const isAvailable = availableStaffToAssign.some(
      (employee) => employee.id === userId,
    )
    if (!isAvailable || submitting) return
    try {
      setActionError("")
      setSubmitting(true)
      await assignDepartmentMembers(departmentId, [userId])
      setAssignSearch("")
      setCandidatePage(1)
      setAssignMembersOpen(false)
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
    if (newTeamMemberIds.length === 0) {
      setActionError("Select at least one member before creating the team.")
      return
    }
    try {
      setActionError("")
      setSubmitting(true)
      await createTeam(departmentId, {
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
        memberIds: newTeamMemberIds,
      })
      setNewTeamName("")
      setNewTeamDesc("")
      setNewTeamMemberSearch("")
      setNewTeamMemberIds([])
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
      setAssignTeamId(null)
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
      open={open}
      onOpenChange={(open) => {
        if (!open && !submitting) handleOpenChange(false)
      }}
    >
      <EdgeSheetContent
        open={open}
        overlayClassName="bg-[rgb(13_28_57_/_18%)]"
        className="overflow-hidden"
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault()
          else if (assignMembersOpen) {
            event.preventDefault()
            closeAssignMembers()
          } else if (creatingTeam) {
            event.preventDefault()
            closeCreateTeam()
          } else if (assignTeamId !== null) {
            event.preventDefault()
            closeAssignTeam()
          } else if (editingMember !== null) {
            event.preventDefault()
            closeEditMember()
          }
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
        <header
          inert={subviewOpen}
          className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5"
        >
          <div className="min-w-0">
            <p className="m-0 text-xs font-medium text-[#738096]">
              You&apos;re viewing
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <SheetTitle className="m-0 truncate text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
                {detail?.name || "Department"}
              </SheetTitle>
              {detail?.code && <Pill>{detail.code}</Pill>}
            </div>
            <SheetDescription className="sr-only">
              Manage department employees and team assignments.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              className={cn(panelIconButton, "border-0")}
              aria-label="Close drawer"
              disabled={submitting}
            >
              <CloseIcon width="16" height="16" />
            </button>
          </SheetClose>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "members" || value === "teams") setActiveTab(value)
          }}
          inert={subviewOpen}
          className="flex min-h-0 flex-1 flex-col"
        >
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
                {actionError && !subviewOpen && (
                  <p
                    className="mt-0 mb-4 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]"
                    role="alert"
                  >
                    {actionError}
                  </p>
                )}
                <TabsContent value="members" className="mt-0 space-y-5">
                  <section aria-label="Current members">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-xs font-semibold">
                          Current Members
                        </h3>
                        <p className={`${panelMuted} mt-1 mb-0`}>
                          {detail?.members.length ?? 0} Members
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          type="button"
                          ref={assignTriggerRef}
                          className={panelAssignButton}
                          onClick={() => setAssignMembersOpen(true)}
                          disabled={submitting}
                        >
                          <PlusIcon width="14" height="14" /> Assign
                        </Button>
                      )}
                    </div>
                    {(detail?.members.length ?? 0) > 0 && (
                      <SearchField
                        id="department-member-search"
                        label="Search members"
                        placeholder="Search name, email, position, or team"
                        value={memberSearch}
                        onChange={(event) =>
                          setMemberSearch(event.target.value)
                        }
                        containerClassName="mb-3 w-full max-[1050px]:w-full max-[1050px]:flex-none"
                      />
                    )}
                    <div className="overflow-hidden rounded-lg border border-[#e8ebef]">
                      {detail?.members.length === 0 ? (
                        <p className={`${panelEmpty} m-0`}>
                          No members assigned to this department yet.
                        </p>
                      ) : visibleMembers.length === 0 ? (
                        <p className={`${panelEmpty} m-0`} role="status">
                          No members match your search.
                        </p>
                      ) : (
                        <ul className="m-0 list-none divide-y divide-[#eceef1] p-0">
                          {[...visibleMembers]
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
                                    <MemberIdentity
                                      member={member}
                                      secondaryText={[
                                        member.user
                                          ? roleLabels[member.user.role]
                                          : "No account",
                                        position,
                                      ]
                                        .filter(Boolean)
                                        .join(" • ")}
                                      nameAdornment={
                                        (isHead || member.team) && (
                                          <>
                                            {isHead && (
                                              <span className={nameBadge}>
                                                Head
                                              </span>
                                            )}
                                            {member.team && (
                                              <span
                                                className={cn(
                                                  nameBadge,
                                                  "min-w-0 flex-initial truncate",
                                                )}
                                              >
                                                {member.team.name}
                                              </span>
                                            )}
                                          </>
                                        )
                                      }
                                    />
                                  </div>
                                  {canManage && !isHead && (
                                    <div className="flex flex-none items-center gap-2">
                                      <Button
                                        type="button"
                                        className={panelAssignButton}
                                        aria-label={`Edit ${member.fullName || member.email || member.user?.email || "employee"}`}
                                        onClick={(event) => {
                                          subviewOpenerRef.current =
                                            event.currentTarget
                                          startEditMember(member)
                                        }}
                                        disabled={submitting}
                                      >
                                        Edit info
                                      </Button>
                                      <button
                                        type="button"
                                        className={panelDangerButton}
                                        aria-label={`Remove ${member.fullName || member.email || member.user?.email || "employee"} from department`}
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
                          Department Teams
                        </h3>
                        <p className={`${panelMuted} mt-1 mb-0`}>
                          Organize employees into focused teams.
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          ref={createTeamTriggerRef}
                          type="button"
                          className={panelAssignButton}
                          onClick={() => {
                            setActionError("")
                            setNewTeamMemberSearch("")
                            setNewTeamMemberIds([])
                            setCreatingTeam(true)
                          }}
                          disabled={submitting}
                        >
                          <PlusIcon width="14" height="14" /> Create Team
                        </Button>
                      )}
                    </div>
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
                        const hasEligibleEmployees =
                          newTeamMemberCandidates.some(
                            (member) => member.teamId !== team.id,
                          )
                        return (
                          <section
                            key={team.id}
                            className="min-w-0 overflow-visible rounded-lg border border-[#e8ebef]"
                            aria-label={`${team.name} team`}
                          >
                            <header className="flex items-start justify-between gap-3 rounded-t-lg border-b border-[#eceef1] bg-[#e8eef2] px-4 py-3">
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
                                <div className="flex flex-none items-center gap-2">
                                  <Button
                                    type="button"
                                    className={panelAssignButton}
                                    aria-label={`Assign member to ${team.name}`}
                                    disabled={
                                      submitting || !hasEligibleEmployees
                                    }
                                    onClick={(event) => {
                                      subviewOpenerRef.current =
                                        event.currentTarget
                                      setTeamAssignSearch("")
                                      setAssignTeamId(team.id)
                                    }}
                                  >
                                    <PlusIcon width="14" height="14" /> Assign
                                  </Button>
                                  <button
                                    type="button"
                                    className={panelDangerButton}
                                    aria-label={`Delete ${team.name} team`}
                                    disabled={submitting}
                                    onClick={() =>
                                      void handleDeleteTeam(team.id, team.name)
                                    }
                                  >
                                    <TrashIcon width="15" height="15" />
                                  </button>
                                </div>
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
        <footer
          inert={subviewOpen}
          className="flex flex-none justify-end border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5"
        >
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
        <PanelSubview
          open={editingMember !== null}
          id="edit-member"
          title="Edit member details"
          description="Update position and team assignment."
          backLabel="Back to members"
          disabled={submitting}
          initialFocusId="mem-pos"
          onBack={closeEditMember}
        >
          {editingMember && (
            <EditMemberForm
              member={editingMember}
              teams={detail?.teams || []}
              position={memberPosition}
              teamId={memberTeamId}
              error={editMemberError}
              submitting={submitting}
              onPositionChange={setMemberPosition}
              onTeamChange={setMemberTeamId}
              onCancel={closeEditMember}
              onSubmit={(event) => void handleSaveMemberDetails(event)}
            />
          )}
        </PanelSubview>
        <PanelSubview
          open={canManage && assignTeam !== null}
          id="assign-team-member"
          title="Assign team member"
          description={`Add an employee to ${assignTeam?.name ?? "this team"}.`}
          backLabel="Back to teams"
          disabled={submitting}
          initialFocusId="team-member-search"
          onBack={closeAssignTeam}
        >
          {assignTeam && (
            <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5">
              {actionError && (
                <p
                  className="m-0 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]"
                  role="alert"
                >
                  {actionError}
                </p>
              )}
              {assignTeamCandidates.length > 0 ? (
                <>
                  <SearchField
                    id="team-member-search"
                    label={`Search members for ${assignTeam.name}`}
                    placeholder="Search name, email, or position"
                    value={teamAssignSearch}
                    onChange={(event) =>
                      setTeamAssignSearch(event.target.value)
                    }
                    disabled={submitting}
                    containerClassName="w-full max-[1050px]:w-full max-[1050px]:flex-none"
                  />
                  {filteredAssignTeamCandidates.length > 0 ? (
                    <ul
                      className="m-0 grid list-none gap-2 p-0"
                      aria-label={`Available members for ${assignTeam.name}`}
                    >
                      {filteredAssignTeamCandidates.map((member) => (
                        <li
                          key={member.id}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e8ebef] p-2.5"
                        >
                          <MemberIdentity member={member} />
                          <Button
                            type="button"
                            className={panelAssignButton}
                            aria-label={`Assign ${member.fullName || member.email || member.user?.email || "employee"} to ${assignTeam.name}`}
                            disabled={submitting}
                            onClick={() =>
                              void handleAssignMemberToTeam(
                                assignTeam.id,
                                member.id,
                              )
                            }
                          >
                            Assign
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={`${panelMuted} m-0`}>
                      No department members match your search.
                    </p>
                  )}
                </>
              ) : (
                <p className={`${panelMuted} m-0`}>
                  All active department staff are already in this team.
                </p>
              )}
            </div>
          )}
        </PanelSubview>
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
        <PanelSubview
          open={canManage && assignMembersOpen}
          id="assign-employees"
          title="Assign employees"
          description={`Assign an existing employee to ${detail?.name || "this department"}.`}
          backLabel="Back to members"
          disabled={submitting}
          initialFocusId="member-assign-search"
          onBack={closeAssignMembers}
        >
          <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5">
            <SearchField
              id="member-assign-search"
              label="Search employees to assign"
              placeholder="Search name or email"
              value={assignSearch}
              onChange={(event) => setAssignSearch(event.target.value)}
              disabled={submitting}
              containerClassName="w-full max-[1050px]:w-full max-[1050px]:flex-none"
            />
            {candidateLoading && (
              <p className={`${panelMuted} m-0`} role="status">
                {assignSearch.trim()
                  ? "Searching employees..."
                  : "Loading available staff..."}
              </p>
            )}
            {candidateError && !isSearching && (
              <div
                className="flex items-center justify-between gap-3 text-xs"
                role="alert"
              >
                <span className="text-[#bc3649]">{candidateError}</span>
                <Button
                  type="button"
                  variant="outline"
                  className={panelSecondaryButton}
                  disabled={candidateLoading || submitting}
                  onClick={() => setCandidateRetry((count) => count + 1)}
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
                      className={panelAssignButton}
                      aria-label={`Assign ${employee.fullName || employee.email || "employee"}`}
                      onClick={() => void handleAddMember(employee.id)}
                      disabled={submitting}
                    >
                      Assign
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {assignSearch.trim() === debouncedAssignSearch &&
              !candidateLoading &&
              !isSearching &&
              !candidateError &&
              displayedCandidates.length === 0 && (
                <p className={`${panelMuted} m-0`}>
                  {assignSearch.trim()
                    ? "No unassigned staff accounts match your search."
                    : "No unassigned staff accounts available."}
                </p>
              )}
            {assignSearch.trim() === debouncedAssignSearch &&
              !candidateLoading &&
              !isSearching &&
              !candidateError &&
              candidateTotal > candidatePageSize && (
                <div className="flex items-center justify-between text-[11px] text-[#65718a]">
                  <span>
                    Page {candidatePage} of{" "}
                    {Math.max(1, Math.ceil(candidateTotal / candidatePageSize))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        "cursor-pointer rounded border border-[#e1e4ea] bg-white px-2 py-1",
                        focusRing,
                      )}
                      disabled={candidatePage <= 1 || submitting}
                      onClick={() => setCandidatePage((page) => page - 1)}
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
                          Math.ceil(candidateTotal / candidatePageSize) ||
                        submitting
                      }
                      onClick={() => setCandidatePage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
          </div>
        </PanelSubview>
        <PanelSubview
          open={canManage && creatingTeam}
          id="create-team"
          title="Create team"
          description="Organize department employees into a focused team."
          backLabel="Back to teams"
          disabled={submitting}
          initialFocusId="team-name"
          onBack={closeCreateTeam}
        >
          <Form
            onSubmit={(event) => void handleCreateTeam(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5">
              {actionError && (
                <p
                  className="m-0 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]"
                  role="alert"
                >
                  {actionError}
                </p>
              )}
              <label className={panelField} htmlFor="team-name">
                Team name{" "}
                <Input
                  id="team-name"
                  className={panelInput}
                  placeholder="e.g. Software engineering"
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  required
                  disabled={submitting}
                />
              </label>
              <label className={panelField} htmlFor="team-desc">
                Description <span className="sr-only">(optional)</span>
                <Input
                  id="team-desc"
                  className={panelInput}
                  placeholder="What does this team do? (optional)"
                  value={newTeamDesc}
                  onChange={(event) => setNewTeamDesc(event.target.value)}
                  disabled={submitting}
                />
              </label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="m-0 text-xs font-medium text-foreground">
                    Team members{" "}
                    <span className="font-normal text-[#bc3649]">
                      (required)
                    </span>
                  </p>
                  <span className={panelMuted}>
                    {newTeamMemberIds.length} selected
                  </span>
                </div>
                <SearchField
                  id="new-team-member-search"
                  label="Search team members"
                  placeholder="Search name, email, or position"
                  value={newTeamMemberSearch}
                  onChange={(event) =>
                    setNewTeamMemberSearch(event.target.value)
                  }
                  disabled={submitting}
                  containerClassName="w-full max-[1050px]:w-full max-[1050px]:flex-none"
                />
                {filteredNewTeamMembers.length > 0 ? (
                  <ul
                    className="m-0 grid list-none gap-2 p-0"
                    aria-label="Available team members"
                  >
                    {filteredNewTeamMembers.map((member) => {
                      const selected = newTeamMemberIds.includes(member.id)
                      return (
                        <li
                          key={member.id}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e8ebef] p-2.5"
                        >
                          <MemberIdentity member={member} />
                          <Button
                            type="button"
                            variant={selected ? "default" : "outline"}
                            className={
                              selected
                                ? panelAssignButton
                                : panelSecondaryButton
                            }
                            aria-pressed={selected}
                            onClick={() => toggleNewTeamMember(member.id)}
                            disabled={submitting}
                          >
                            {selected ? "Added" : "Add"}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className={`${panelMuted} m-0`}>
                    {newTeamMemberCandidates.length > 0
                      ? "No department members match your search."
                      : "No eligible department members are available."}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-none justify-end gap-2 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
              <Button
                type="button"
                variant="outline"
                className={panelSecondaryButton}
                disabled={submitting}
                onClick={closeCreateTeam}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={panelAssignButton}
                disabled={submitting || newTeamMemberIds.length === 0}
              >
                {submitting ? "Saving..." : "Save team"}
              </Button>
            </div>
          </Form>
        </PanelSubview>
      </EdgeSheetContent>
    </Sheet>
  )
}
