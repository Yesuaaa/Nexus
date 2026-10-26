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
import { HoverTooltip } from "@/components/ui/hover-tooltip"
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
  removeDepartmentMember,
  updateDepartmentMember,
  type DepartmentDetail,
  type DepartmentMember,
} from "../api/departments-api"
import {
  listAccounts,
  type AccountList,
} from "@/features/accounts/api/accounts-api"

function MemberIdentity({
  member,
}: {
  member: Pick<DepartmentMember, "fullName" | "email">
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid size-8 flex-none place-items-center rounded-full bg-[#eef0f3] text-xs font-medium text-[#65718a]"
        aria-hidden="true"
      >
        {(member.fullName?.[0] || member.email[0]).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p
          className="m-0 truncate text-xs font-medium"
          title={member.fullName || member.email}
        >
          {member.fullName || member.email}
        </p>
        <p
          className={`${panelMuted} mt-0.5 mb-0 truncate`}
          title={member.email}
        >
          {member.email}
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

  // Available company accounts (for dropdown assignment)
  const [allAccounts, setAllAccounts] = useState<AccountList["users"]>([])
  const [quickAssignUserId, setQuickAssignUserId] = useState("")

  // Member search state
  const [assignSearch, setAssignSearch] = useState("")
  const [searchCandidates, setSearchCandidates] = useState<
    AccountList["users"]
  >([])
  const [submitting, setSubmitting] = useState(false)

  // Team creation state
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamDesc, setNewTeamDesc] = useState("")
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Team member assignment state: mapping teamId -> selected userId
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

  // 2. Load accounts for quick assignment
  useEffect(() => {
    if (!canManage) return
    let active = true
    listAccounts("", "STAFF", 1)
      .then((res) => {
        if (active) {
          setAllAccounts(res.users)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canManage, revision])

  // 3. Debounced search for assignable accounts
  const [debouncedAssignSearch, setDebouncedAssignSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssignSearch(assignSearch.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [assignSearch])

  useEffect(() => {
    if (!canManage || !debouncedAssignSearch) {
      return
    }
    let active = true
    const currentMemberIds = new Set(detail?.members.map((m) => m.id) || [])
    listAccounts(debouncedAssignSearch, "STAFF", 1)
      .then((res) => {
        if (active) {
          setSearchCandidates(
            res.users.filter((u) => !currentMemberIds.has(u.id)),
          )
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canManage, debouncedAssignSearch, detail?.members])

  const isSearching = Boolean(
    assignSearch.trim() && assignSearch.trim() !== debouncedAssignSearch,
  )
  const displayedCandidates = debouncedAssignSearch ? searchCandidates : []

  const currentMemberIds = new Set(detail?.members.map((m) => m.id) || [])
  const availableAccountsForQuickAssign = allAccounts.filter(
    (u) => !currentMemberIds.has(u.id),
  )

  async function handleAddMember(userId: string) {
    if (!userId) return
    try {
      setActionError("")
      setSubmitting(true)
      await assignDepartmentMembers(departmentId, [userId])
      setAssignSearch("")
      setSearchCandidates([])
      setQuickAssignUserId("")
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

  async function handleRemoveMember(userId: string) {
    try {
      setActionError("")
      setSubmitting(true)
      await removeDepartmentMember(departmentId, userId)
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't remove this member.",
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

  async function handleDeleteTeam(teamId: string, teamName: string) {
    if (
      !window.confirm(
        `Delete team "${teamName}"? Members will remain in the department.`,
      )
    ) {
      return
    }
    try {
      setActionError("")
      setSubmitting(true)
      await deleteTeam(departmentId, teamId)
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : "Couldn't delete this team.",
      )
    } finally {
      setSubmitting(false)
    }
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

  async function handleRemoveMemberFromTeam(userId: string) {
    try {
      setActionError("")
      setSubmitting(true)
      await updateDepartmentMember(departmentId, userId, { teamId: null })
      setRevision((r) => r + 1)
      onChanged()
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Couldn't remove this team assignment.",
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
    if (detail?.headId === member.id) return
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
        if (!open) onClose()
      }}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_40%)]"
        className="inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
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
                          value={quickAssignUserId}
                          onValueChange={setQuickAssignUserId}
                          disabled={submitting}
                        >
                          <SelectTrigger
                            className={cn(panelSelectTrigger, "flex-1")}
                            aria-label="Employee to assign"
                          >
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                          <SelectContent collisionPadding={24}>
                            {availableAccountsForQuickAssign.length === 0 ? (
                              <p className="m-0 p-3 text-xs text-muted-foreground">
                                No employees available to assign.
                              </p>
                            ) : (
                              availableAccountsForQuickAssign.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.fullName || user.email}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          className={panelAssignButton}
                          disabled={!quickAssignUserId || submitting}
                          onClick={() =>
                            void handleAddMember(quickAssignUserId)
                          }
                        >
                          <PlusIcon width="14" height="14" /> Assign
                        </Button>
                      </div>
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
                      {displayedCandidates.length > 0 && !isSearching && (
                        <ul
                          className="m-0 grid list-none gap-2 p-0"
                          aria-label="Employee search results"
                        >
                          {displayedCandidates.slice(0, 5).map((user) => (
                            <li
                              key={user.id}
                              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e8ebef] p-2.5"
                            >
                              <MemberIdentity member={user} />
                              <Button
                                type="button"
                                variant="outline"
                                className={panelSecondaryButton}
                                aria-label={`Assign ${user.fullName || user.email}`}
                                onClick={() => void handleAddMember(user.id)}
                                disabled={submitting}
                              >
                                Assign
                              </Button>
                            </li>
                          ))}
                        </ul>
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
                              if (detail?.headId === a.id) return -1
                              if (detail?.headId === b.id) return 1
                              const aTeam = a.team?.name || ""
                              const bTeam = b.team?.name || ""
                              if (aTeam && !bTeam) return -1
                              if (!aTeam && bTeam) return 1
                              return (
                                aTeam.localeCompare(bTeam) ||
                                (a.fullName || a.email).localeCompare(
                                  b.fullName || b.email,
                                )
                              )
                            })
                            .map((member) => {
                              const isHead = detail?.headId === member.id
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
                                        {member.role}
                                      </span>
                                    </div>
                                  </div>
                                  {canManage && !isHead && (
                                    <div className="flex flex-none items-center gap-2">
                                      <Button
                                        type="button"
                                        className={panelAssignButton}
                                        aria-label={`Edit ${member.fullName || member.email}`}
                                        onClick={() => startEditMember(member)}
                                        disabled={submitting}
                                      >
                                        Edit info
                                      </Button>
                                      <button
                                        type="button"
                                        className={panelDangerButton}
                                        aria-label={`Remove ${member.fullName || member.email} from department`}
                                        disabled={submitting}
                                        onClick={() =>
                                          void handleRemoveMember(member.id)
                                        }
                                      >
                                        <TrashIcon width="15" height="15" />
                                        <HoverTooltip>
                                          Remove from department
                                        </HoverTooltip>
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
                            member.role === "STAFF" &&
                            member.id !== detail.headId &&
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
                                  disabled={submitting}
                                  onClick={() =>
                                    void handleDeleteTeam(team.id, team.name)
                                  }
                                >
                                  <TrashIcon width="15" height="15" />
                                  <HoverTooltip>Delete team</HoverTooltip>
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
                                        aria-label={`Remove ${member.fullName || member.email} from ${team.name}`}
                                        disabled={submitting}
                                        onClick={() =>
                                          void handleRemoveMemberFromTeam(
                                            member.id,
                                          )
                                        }
                                      >
                                        <CloseIcon width="14" height="14" />
                                        <HoverTooltip>
                                          Remove from team
                                        </HoverTooltip>
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
                                            {member.fullName || member.email}
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
                                      (member) => member.id !== detail.headId,
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
            <Button type="button" className={panelAssignButton}>
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
      </SheetContent>
    </Sheet>
  )
}
