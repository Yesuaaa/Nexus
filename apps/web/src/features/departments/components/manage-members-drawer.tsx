import { Form } from "@/components/ui/form"
import { useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  Pencil,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react"
import { PlusIcon, TrashIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import {
  SidePanel,
  SidePanelAlert,
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { Skeleton } from "@/components/ui/skeleton"
import { RowActionsMenu } from "@/components/ui/row-actions-menu"
import { SheetClose } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import { MemberIdentity } from "@/components/ui/member-identity"
import { SearchField } from "@/components/ui/search-field"
import { cn } from "@/lib/utils"
import { EditMemberForm } from "./edit-member-form"
import { ConfirmSwap, InlineConfirm } from "@/components/ui/inline-confirm"
import { InfoTip } from "@/components/ui/info-tip"
import { PanelSubview } from "@/components/ui/panel-subview"
import {
  panelAssignButton,
  panelEmpty,
  panelField,
  panelIconButton,
  panelInput,
  panelMuted,
  panelSecondaryButton,
} from "@/components/ui/panel-styles"
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

const panelDangerIcon = cn(
  panelIconButton,
  "border-0 bg-transparent text-[#bc3649] hover:bg-[#fff0f1] hover:text-[#a72d3f]",
)

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
  const panel = useSidePanel(onClose)
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

  // "Remove members" selector opened from a team's Manage team menu.
  const [removeTeamId, setRemoveTeamId] = useState<string | null>(null)
  const [removeSelection, setRemoveSelection] = useState<string[]>([])
  const [removeSearch, setRemoveSearch] = useState("")

  function openRemoveTeamMembers(teamId: string) {
    subviewOpenerRef.current = document.getElementById(`team-manage-${teamId}`)
    setActionError("")
    setRemoveSelection([])
    setRemoveSearch("")
    setRemoveTeamId(teamId)
  }

  function closeRemoveTeamMembers() {
    if (submitting) return
    setRemoveTeamId(null)
    restoreSubviewOpenerFocus()
  }

  function toggleRemoveSelection(memberId: string) {
    setRemoveSelection((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId],
    )
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
  const removeTeam =
    detail?.teams.find((team) => team.id === removeTeamId) ?? null
  const removeTeamMembers = (detail?.members ?? []).filter(
    (member) => removeTeamId !== null && member.teamId === removeTeamId,
  )
  const removeQuery = removeSearch.trim().toLowerCase()
  const filteredRemoveMembers = removeTeamMembers.filter((member) =>
    [
      member.fullName,
      member.email,
      member.user?.fullName,
      member.user?.email,
      member.position,
    ].some((value) => value?.toLowerCase().includes(removeQuery)),
  )
  const allVisibleSelected =
    filteredRemoveMembers.length > 0 &&
    filteredRemoveMembers.every((member) => removeSelection.includes(member.id))
  const subviewOpen =
    assignMembersOpen ||
    creatingTeam ||
    assignTeam !== null ||
    removeTeam !== null ||
    editingMember !== null

  /** "Staff • Position" line used for member rows. */
  function memberSummary(member: DepartmentMember) {
    const position =
      member.position &&
      !["dept head", "department head"].includes(member.position.toLowerCase())
        ? member.position
        : null
    return [member.user ? roleLabels[member.user.role] : "No account", position]
      .filter(Boolean)
      .join(" • ")
  }

  async function handleRemoveTeamMembers() {
    if (!removeTeam || removeSelection.length === 0 || submitting) return
    try {
      setActionError("")
      setSubmitting(true)
      for (const memberId of removeSelection) {
        await updateDepartmentMember(departmentId, memberId, { teamId: null })
      }
      setRemoveTeamId(null)
      restoreSubviewOpenerFocus()
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      // Some removals may have succeeded; refresh so the list is accurate.
      setRevision((r) => r + 1)
      onChanged()
      setActionError(
        error instanceof Error
          ? error.message
          : "Couldn't remove the selected members.",
      )
    } finally {
      setSubmitting(false)
    }
  }

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

  // Id of the control that opened the inline confirmation. The control is
  // swapped out while confirming, so it is refocused by id once it returns.
  const confirmOpenerIdRef = useRef<string | null>(null)

  function rememberConfirmOpener(openerId: string) {
    confirmOpenerIdRef.current = openerId
    setConfirmationError("")
  }

  function cancelConfirmation() {
    if (submitting) return
    setConfirmation(null)
    setConfirmationError("")
    const openerId = confirmOpenerIdRef.current
    if (!openerId) return
    // Retry until the row's swap-back animation has remounted the control.
    let attempts = 0
    const focusOpener = () => {
      const opener = document.getElementById(openerId)
      if (opener) opener.focus()
      else if (++attempts < 20) window.setTimeout(focusOpener, 25)
    }
    focusOpener()
  }

  function handleRemoveMember(userId: string) {
    const member = detail?.members.find((candidate) => candidate.id === userId)
    rememberConfirmOpener(`member-remove-${userId}`)
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
      } else {
        await deleteTeam(departmentId, confirmation.id)
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
    rememberConfirmOpener(`team-manage-${teamId}`)
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
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={submitting}
      // Escape first closes any open inline confirm or slide-over screen.
      onEscapeKeyDown={(event) => {
        const closeInner = confirmation
          ? cancelConfirmation
          : assignMembersOpen
            ? closeAssignMembers
            : creatingTeam
              ? closeCreateTeam
              : removeTeamId !== null
                ? closeRemoveTeamMembers
                : assignTeamId !== null
                  ? closeAssignTeam
                  : editingMember !== null
                    ? closeEditMember
                    : null
        if (closeInner) {
          event.preventDefault()
          closeInner()
        }
      }}
      fallbackFocus={() => {
        const heading = document.querySelector<HTMLElement>("main h1")
        if (heading && !heading.hasAttribute("tabindex"))
          heading.setAttribute("tabindex", "-1")
        return heading
      }}
    >
      <SidePanelHeader
        inert={subviewOpen}
        eyebrow="You're viewing"
        title={detail?.name || (loading ? "Loading department" : "Department")}
        titleClassName={cn(
          "text-[22px] leading-[1.25]",
          !detail && loading && "sr-only",
        )}
        meta={
          !detail && loading ? (
            <>
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </>
          ) : (
            detail?.code && <Pill>{detail.code}</Pill>
          )
        }
        description="Manage department employees and team assignments."
        hideDescription
        closeLabel="Close drawer"
        closeDisabled={submitting}
      />

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
            <div className="grid gap-3" aria-busy="true">
              <span role="status" className="sr-only">
                Loading department…
              </span>
              {activeTab === "members" ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-[34px] w-20 rounded-lg" />
                  </div>
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef]">
                    {Array.from({ length: 5 }, (_, index) => (
                      <MemberRowSkeleton
                        key={index}
                        trailing={canManage ? 2 : 0}
                        className="px-4 py-3"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-[34px] w-28 rounded-lg" />
                  </div>
                  {Array.from({ length: 2 }, (_, index) => (
                    <div
                      key={index}
                      className="overflow-hidden rounded-lg border border-[#e8ebef]"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-[#eceef1] bg-[#f3f6f8] px-4 py-3">
                        <div className="grid gap-1.5">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                        <Skeleton className="h-8 w-28 rounded-[7px]" />
                      </div>
                      <div className="divide-y divide-[#eceef1]">
                        {Array.from({ length: 2 }, (_, row) => (
                          <MemberRowSkeleton key={row} className="px-4 py-3" />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : loadError ? (
            <SidePanelError
              message={loadError}
              onRetry={() => {
                setLoading(true)
                setRevision((r) => r + 1)
              }}
            />
          ) : (
            <>
              {actionError && !subviewOpen && (
                <div className="mb-4">
                  <SidePanelAlert>{actionError}</SidePanelAlert>
                </div>
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
                      onChange={(event) => setMemberSearch(event.target.value)}
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
                            const memberName =
                              member.fullName ||
                              member.email ||
                              member.user?.email ||
                              "this employee"
                            return (
                              <li key={member.id} className="min-w-0">
                                <ConfirmSwap
                                  confirming={
                                    confirmation?.type === "member" &&
                                    confirmation.id === member.id
                                  }
                                  confirm={
                                    <InlineConfirm
                                      message={`Remove ${memberName} from ${detail?.name || "this department"}?`}
                                      detail="Their employee record and account are kept."
                                      confirmLabel="Remove"
                                      pendingLabel="Removing…"
                                      pending={submitting}
                                      error={confirmationError}
                                      onCancel={cancelConfirmation}
                                      onConfirm={() => void confirmRemoval()}
                                    />
                                  }
                                >
                                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#fafbfc]">
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
                                        <button
                                          type="button"
                                          className={cn(
                                            panelIconButton,
                                            "border-0 bg-transparent",
                                          )}
                                          aria-label={`Edit ${member.fullName || member.email || member.user?.email || "employee"}`}
                                          onClick={(event) => {
                                            subviewOpenerRef.current =
                                              event.currentTarget
                                            startEditMember(member)
                                          }}
                                          disabled={submitting}
                                        >
                                          <Pencil
                                            size={15}
                                            aria-hidden="true"
                                          />
                                        </button>
                                        <button
                                          id={`member-remove-${member.id}`}
                                          type="button"
                                          className={panelDangerIcon}
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
                                  </div>
                                </ConfirmSwap>
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
                    <h3 className="m-0 text-[17px] leading-tight font-[650] tracking-[-0.02em]">
                      Department Teams
                    </h3>
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
                      const hasEligibleEmployees = newTeamMemberCandidates.some(
                        (member) => member.teamId !== team.id,
                      )
                      return (
                        <section
                          key={team.id}
                          className="min-w-0 overflow-visible rounded-lg border border-[#e8ebef]"
                          aria-label={`${team.name} team`}
                        >
                          <ConfirmSwap
                            confirming={
                              confirmation?.type === "team" &&
                              confirmation.id === team.id
                            }
                            confirm={
                              <div className="overflow-hidden rounded-t-lg border-b border-[#eceef1]">
                                <InlineConfirm
                                  message={`Delete the ${team.name} team?`}
                                  detail="Members stay in the department; only the team is removed."
                                  confirmLabel="Delete team"
                                  pendingLabel="Deleting…"
                                  pending={submitting}
                                  error={confirmationError}
                                  onCancel={cancelConfirmation}
                                  onConfirm={() => void confirmRemoval()}
                                />
                              </div>
                            }
                          >
                            <header className="flex items-start justify-between gap-3 rounded-t-lg border-b border-[#eceef1] bg-[#e8eef2] px-4 py-3">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-1">
                                  <h4 className="m-0 min-w-0 text-[15px] leading-tight font-[650] tracking-[-0.01em] break-words">
                                    {team.name}
                                  </h4>
                                  {team.description && (
                                    <InfoTip label={`About ${team.name}`}>
                                      {team.description}
                                    </InfoTip>
                                  )}
                                </div>
                                <p className={`${panelMuted} mt-1 mb-0`}>
                                  {teamMembers.length}{" "}
                                  {teamMembers.length === 1
                                    ? "member"
                                    : "members"}
                                </p>
                              </div>
                              {canManage && (
                                <RowActionsMenu
                                  triggerId={`team-manage-${team.id}`}
                                  triggerLabel={`Manage ${team.name} team`}
                                  menuLabel={`Manage ${team.name} team`}
                                  disabled={submitting}
                                  triggerClassName="flex w-auto! gap-1 px-2.5 text-xs font-semibold whitespace-nowrap text-foreground"
                                  triggerContent={
                                    <>
                                      Manage team
                                      <ChevronDown
                                        size={14}
                                        aria-hidden="true"
                                      />
                                    </>
                                  }
                                  items={[
                                    {
                                      action: "assign",
                                      label: (
                                        <span className="flex items-center gap-2">
                                          <UserPlus
                                            size={14}
                                            aria-hidden="true"
                                          />
                                          Assign members
                                        </span>
                                      ),
                                      disabled: !hasEligibleEmployees,
                                    },
                                    {
                                      action: "remove",
                                      label: (
                                        <span className="flex items-center gap-2">
                                          <UserMinus
                                            size={14}
                                            aria-hidden="true"
                                          />
                                          Remove members
                                        </span>
                                      ),
                                      disabled: teamMembers.length === 0,
                                    },
                                    {
                                      action: "delete",
                                      label: (
                                        <span className="flex items-center gap-2">
                                          <Trash2
                                            size={14}
                                            aria-hidden="true"
                                          />
                                          Delete team
                                        </span>
                                      ),
                                      className:
                                        "text-[#c33945] hover:bg-[#fff0f1] focus:bg-[#fff0f1] focus:text-[#c33945] focus-visible:bg-[#fff0f1]",
                                    },
                                  ]}
                                  onAction={(action) => {
                                    if (action === "assign") {
                                      subviewOpenerRef.current =
                                        document.getElementById(
                                          `team-manage-${team.id}`,
                                        )
                                      setTeamAssignSearch("")
                                      setAssignTeamId(team.id)
                                    } else if (action === "remove") {
                                      openRemoveTeamMembers(team.id)
                                    } else {
                                      handleDeleteTeam(team.id, team.name)
                                    }
                                  }}
                                />
                              )}
                            </header>
                          </ConfirmSwap>
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
                                  className="min-w-0 px-4 py-3"
                                >
                                  <MemberIdentity
                                    member={member}
                                    secondaryText={memberSummary(member)}
                                  />
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
      <SidePanelFooter inert={subviewOpen}>
        <SheetClose asChild>
          <SidePanelButton disabled={submitting}>Done</SidePanelButton>
        </SheetClose>
      </SidePanelFooter>
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
        open={canManage && removeTeam !== null}
        id="remove-team-members"
        title="Remove members"
        description={`Choose who to remove from ${removeTeam?.name ?? "this team"}. They stay in the department.`}
        backLabel="Back to teams"
        disabled={submitting}
        initialFocusId="remove-team-member-search"
        onBack={closeRemoveTeamMembers}
      >
        {removeTeam && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-none flex-col gap-3 border-b border-[#eceef1] px-6 py-4 max-[560px]:px-5">
              <SearchField
                id="remove-team-member-search"
                label={`Search ${removeTeam.name} members`}
                placeholder="Search name, email, or position"
                value={removeSearch}
                onChange={(event) => setRemoveSearch(event.target.value)}
                disabled={submitting}
                containerClassName="w-full max-[1050px]:w-full max-[1050px]:flex-none"
              />
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className={cn(
                    "cursor-pointer rounded border-0 bg-transparent p-0 text-xs font-semibold text-[#294a9b] hover:underline disabled:cursor-not-allowed disabled:opacity-50",
                    focusRing,
                  )}
                  disabled={submitting || filteredRemoveMembers.length === 0}
                  onClick={() => {
                    const visibleIds = filteredRemoveMembers.map(
                      (member) => member.id,
                    )
                    setRemoveSelection((previous) =>
                      allVisibleSelected
                        ? previous.filter((id) => !visibleIds.includes(id))
                        : [...new Set([...previous, ...visibleIds])],
                    )
                  }}
                >
                  {allVisibleSelected
                    ? removeQuery
                      ? "Clear matches"
                      : "Clear all"
                    : removeQuery
                      ? "Select matches"
                      : "Select all"}
                </button>
                <span className={panelMuted} aria-live="polite">
                  {filteredRemoveMembers.length} of {removeTeamMembers.length}{" "}
                  shown
                </span>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overscroll-contain px-6 py-4 max-[560px]:px-5">
              {actionError && (
                <div className="mb-1">
                  <SidePanelAlert>{actionError}</SidePanelAlert>
                </div>
              )}
              {filteredRemoveMembers.length === 0 ? (
                <p className={`${panelEmpty} m-0`} role="status">
                  No members match your search.
                </p>
              ) : (
                <ul
                  className="m-0 grid list-none gap-2 p-0"
                  aria-label={`${removeTeam.name} members`}
                >
                  {filteredRemoveMembers.map((member) => {
                    const selected = removeSelection.includes(member.id)
                    return (
                      <li key={member.id}>
                        <label
                          className={cn(
                            "group/pick flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150 motion-reduce:transition-none",
                            selected
                              ? "border-[#efc0c8] bg-[#fff5f6]"
                              : "border-[#e8ebef] bg-background hover:border-[#d9dee6] hover:bg-[#fafbfc]",
                            submitting && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <MemberIdentity
                            member={member}
                            secondaryText={memberSummary(member)}
                          />
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={selected}
                            onChange={() => toggleRemoveSelection(member.id)}
                            disabled={submitting}
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid size-5 flex-none place-items-center rounded-full border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#294a9b] motion-reduce:transition-none",
                              selected
                                ? "border-[#bc3649] bg-[#bc3649] text-white"
                                : "border-[#c9d1dd] bg-background text-transparent group-hover/pick:border-[#a9b4c4]",
                            )}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <SidePanelFooter className="justify-between">
              <span className="text-xs font-medium text-[#52627a]">
                {removeSelection.length === 0
                  ? "No one selected"
                  : `${removeSelection.length} selected`}
              </span>
              <div className="flex gap-2">
                <SidePanelButton
                  variant="secondary"
                  disabled={submitting}
                  onClick={closeRemoveTeamMembers}
                >
                  Cancel
                </SidePanelButton>
                <SidePanelButton
                  variant="danger"
                  disabled={submitting || removeSelection.length === 0}
                  onClick={() => void handleRemoveTeamMembers()}
                >
                  {submitting
                    ? "Removing…"
                    : removeSelection.length > 0
                      ? `Remove ${removeSelection.length}`
                      : "Remove"}
                </SidePanelButton>
              </div>
            </SidePanelFooter>
          </div>
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
            {actionError && <SidePanelAlert>{actionError}</SidePanelAlert>}
            {assignTeamCandidates.length > 0 ? (
              <>
                <SearchField
                  id="team-member-search"
                  label={`Search members for ${assignTeam.name}`}
                  placeholder="Search name, email, or position"
                  value={teamAssignSearch}
                  onChange={(event) => setTeamAssignSearch(event.target.value)}
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
            <div className="grid gap-2" aria-busy="true">
              <span role="status" className="sr-only">
                {assignSearch.trim()
                  ? "Searching employees…"
                  : "Loading available staff…"}
              </span>
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border border-[#e8ebef] p-2.5"
                >
                  <MemberRowSkeleton className="flex-1" />
                  <Skeleton className="h-[34px] w-16 flex-none rounded-lg" />
                </div>
              ))}
            </div>
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
            {actionError && <SidePanelAlert>{actionError}</SidePanelAlert>}
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
                  <span className="font-normal text-[#bc3649]">(required)</span>
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
                onChange={(event) => setNewTeamMemberSearch(event.target.value)}
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
                            selected ? panelAssignButton : panelSecondaryButton
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
          <SidePanelFooter>
            <SidePanelButton
              variant="secondary"
              disabled={submitting}
              onClick={closeCreateTeam}
            >
              Cancel
            </SidePanelButton>
            <SidePanelButton
              type="submit"
              disabled={submitting || newTeamMemberIds.length === 0}
            >
              {submitting ? "Saving..." : "Save team"}
            </SidePanelButton>
          </SidePanelFooter>
        </Form>
      </PanelSubview>
    </SidePanel>
  )
}
