import { useEffect, useState } from "react"
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/layout/icons"
import {
  assignDepartmentMembers,
  createTeam,
  deleteTeam,
  getDepartment,
  removeDepartmentMember,
  updateDepartmentMember,
  type DepartmentDetail,
  type DepartmentMember,
} from "./api"
import { listAccounts, type AccountList } from "@/features/accounts/api"

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
  const [detail, setDetail] = useState<DepartmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"members" | "teams">("members")

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
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [departmentId, revision])

  // 2. Load accounts for quick assignment
  useEffect(() => {
    let active = true
    listAccounts("", "", 1)
      .then((res) => {
        if (active) {
          setAllAccounts(res.users)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [revision])

  // 3. Debounced search for assignable accounts
  const [debouncedAssignSearch, setDebouncedAssignSearch] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAssignSearch(assignSearch.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [assignSearch])

  useEffect(() => {
    if (!debouncedAssignSearch) {
      return
    }
    let active = true
    const currentMemberIds = new Set(detail?.members.map((m) => m.id) || [])
    listAccounts(debouncedAssignSearch, "", 1)
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
  }, [debouncedAssignSearch, detail?.members])

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
      setSubmitting(true)
      await assignDepartmentMembers(departmentId, [userId])
      setAssignSearch("")
      setSearchCandidates([])
      setQuickAssignUserId("")
      setRevision((r) => r + 1)
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      setSubmitting(true)
      await removeDepartmentMember(departmentId, userId)
      setRevision((r) => r + 1)
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    try {
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
      setSubmitting(true)
      await deleteTeam(departmentId, teamId)
      setRevision((r) => r + 1)
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAssignMemberToTeam(teamId: string, userId: string) {
    if (!userId) return
    try {
      setSubmitting(true)
      await updateDepartmentMember(departmentId, userId, { teamId })
      setTeamAddSelection((prev) => ({ ...prev, [teamId]: "" }))
      setRevision((r) => r + 1)
      onChanged()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveMemberFromTeam(userId: string) {
    try {
      setSubmitting(true)
      await updateDepartmentMember(departmentId, userId, { teamId: null })
      setRevision((r) => r + 1)
      onChanged()
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
    <div className="dept-drawer-backdrop" onClick={onClose}>
      <aside
        className="dept-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Department Management Drawer"
      >
        <div className="dept-drawer-header">
          <div>
            <span className="dept-header-eyebrow">Department Overview</span>
            <h2 className="dept-modal-title">
              {detail ? detail.name : "Loading..."}
            </h2>
            {detail?.code && <span className="dept-badge">{detail.code}</span>}
          </div>
          <button
            type="button"
            className="dept-modal-close"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            padding: "0 24px",
            background: "#f8fafc",
            gap: "16px",
          }}
        >
          <button
            type="button"
            style={{
              padding: "12px 4px",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === "members"
                  ? "2px solid #112866"
                  : "2px solid transparent",
              fontWeight: activeTab === "members" ? 700 : 500,
              color: activeTab === "members" ? "#112866" : "#64748b",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
            onClick={() => setActiveTab("members")}
          >
            Employees ({detail?.members.length ?? 0})
          </button>
          <button
            type="button"
            style={{
              padding: "12px 4px",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === "teams"
                  ? "2px solid #112866"
                  : "2px solid transparent",
              fontWeight: activeTab === "teams" ? 700 : 500,
              color: activeTab === "teams" ? "#112866" : "#64748b",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
            onClick={() => setActiveTab("teams")}
          >
            Teams ({detail?.teams?.length ?? 0})
          </button>
        </div>

        <div className="dept-drawer-content">
          {activeTab === "members" && (
            <>
              {canManage && (
                <div className="dept-meta-box">
                  <label
                    className="dept-label"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Assign Employees to this Department</span>
                    <span
                      style={{
                        fontWeight: 400,
                        color: "#64748b",
                        fontSize: "0.75rem",
                      }}
                    >
                      {availableAccountsForQuickAssign.length} available
                    </span>
                  </label>

                  {/* Dropdown Quick Assign */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      className="dept-select"
                      value={quickAssignUserId}
                      onChange={(e) => setQuickAssignUserId(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">-- Select employee to assign --</option>
                      {availableAccountsForQuickAssign.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName || user.email} ({user.role})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dept-btn-primary"
                      style={{ flex: "none", padding: "8px 14px" }}
                      disabled={!quickAssignUserId || submitting}
                      onClick={() => handleAddMember(quickAssignUserId)}
                    >
                      <PlusIcon /> Assign
                    </button>
                  </div>

                  {/* Filter / Search by name or email */}
                  <div style={{ marginTop: "4px" }}>
                    <input
                      id="member-assign-search"
                      className="dept-input"
                      placeholder="Or type to search employee by name / email..."
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      disabled={submitting}
                    />
                  </div>

                  {isSearching && (
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Searching employees...
                    </span>
                  )}
                  {displayedCandidates.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        marginTop: "8px",
                      }}
                    >
                      {displayedCandidates.slice(0, 5).map((user) => (
                        <div
                          key={user.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                          }}
                        >
                          <div>
                            <div
                              style={{ fontWeight: 600, fontSize: "0.85rem" }}
                            >
                              {user.fullName || "Unnamed User"}
                            </div>
                            <div
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              {user.email} • {user.role}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="dept-btn-primary"
                            style={{ flex: "none", padding: "6px 12px" }}
                            onClick={() => handleAddMember(user.id)}
                            disabled={submitting}
                          >
                            <PlusIcon /> Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "12px",
                  }}
                >
                  Current Members ({detail?.members.length ?? 0})
                </h3>
                {loading ? (
                  <div className="dept-empty-state">Loading members...</div>
                ) : detail?.members.length === 0 ? (
                  <div className="dept-empty-state">
                    No members assigned to this department yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {[...(detail?.members || [])]
                      .sort((a, b) => {
                        // 1. Department Head always at the very top
                        const isAHead = detail?.headId === a.id
                        const isBHead = detail?.headId === b.id
                        if (isAHead) return -1
                        if (isBHead) return 1

                        // 2. Group by Team
                        const aTeam = a.team?.name || ""
                        const bTeam = b.team?.name || ""
                        if (aTeam && !bTeam) return -1
                        if (!aTeam && bTeam) return 1
                        if (aTeam !== bTeam) return aTeam.localeCompare(bTeam)

                        // 3. Alphabetical by Name
                        const nameA = a.fullName || a.email
                        const nameB = b.fullName || b.email
                        return nameA.localeCompare(nameB)
                      })
                      .map((member) => {
                        const isDeptHead = detail?.headId === member.id
                        return (
                          <div key={member.id} className="dept-member-item">
                            <div className="dept-member-info">
                              <div className="dept-member-avatar">
                                {(
                                  member.fullName?.[0] || member.email[0]
                                ).toUpperCase()}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.875rem",
                                    color: "#0f172a",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span>
                                    {member.fullName || "Unnamed User"}
                                  </span>
                                  {isDeptHead && (
                                    <span
                                      style={{
                                        fontSize: "0.7rem",
                                        background: "#fef3c7",
                                        color: "#92400e",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontWeight: 700,
                                      }}
                                    >
                                      DEPT HEAD
                                    </span>
                                  )}
                                  {member.position &&
                                    member.position.toLowerCase() !==
                                      "dept head" &&
                                    member.position.toLowerCase() !==
                                      "department head" && (
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          background: "#f1f5f9",
                                          color: "#334155",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                        }}
                                      >
                                        {member.position}
                                      </span>
                                    )}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#64748b",
                                  }}
                                >
                                  {member.email} • {member.role}
                                  {!isDeptHead && member.team && (
                                    <span
                                      style={{
                                        marginLeft: "6px",
                                        color: "#2563eb",
                                        fontWeight: 600,
                                      }}
                                    >
                                      • {member.team.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {canManage && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  alignItems: "center",
                                }}
                              >
                                {!isDeptHead ? (
                                  <>
                                    <button
                                      type="button"
                                      className="dept-btn-outline"
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "0.75rem",
                                      }}
                                      onClick={() => startEditMember(member)}
                                    >
                                      Edit Info
                                    </button>
                                    <button
                                      type="button"
                                      className="dept-btn-danger-icon"
                                      title="Remove from department"
                                      onClick={() =>
                                        handleRemoveMember(member.id)
                                      }
                                      disabled={submitting}
                                    >
                                      <TrashIcon />
                                    </button>
                                  </>
                                ) : (
                                  <span className="dept-head-status">
                                    Department Head
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "teams" && (
            <div>
              {canManage && (
                <div style={{ marginBottom: "16px" }}>
                  {!creatingTeam ? (
                    <button
                      type="button"
                      className="dept-btn-primary"
                      onClick={() => setCreatingTeam(true)}
                    >
                      <PlusIcon /> Create Team in {detail?.name}
                    </button>
                  ) : (
                    <form
                      onSubmit={handleCreateTeam}
                      className="dept-meta-box"
                      style={{ border: "1px solid #cbd5e1" }}
                    >
                      <div className="dept-field">
                        <label className="dept-label" htmlFor="team-name">
                          Team Name *
                        </label>
                        <input
                          id="team-name"
                          className="dept-input"
                          placeholder="e.g. Infrastructure, Software Engineering, Campaigns"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="dept-field">
                        <label className="dept-label" htmlFor="team-desc">
                          Description (Optional)
                        </label>
                        <input
                          id="team-desc"
                          className="dept-input"
                          placeholder="Responsibilities of this team..."
                          value={newTeamDesc}
                          onChange={(e) => setNewTeamDesc(e.target.value)}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "flex-end",
                          marginTop: "8px",
                        }}
                      >
                        <button
                          type="button"
                          className="dept-btn-outline"
                          onClick={() => setCreatingTeam(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="dept-btn-primary"
                          disabled={submitting}
                        >
                          Save Team
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              <h3
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: "12px",
                }}
              >
                Department Teams ({detail?.teams?.length ?? 0})
              </h3>

              {detail?.teams?.length === 0 ? (
                <div className="dept-empty-state">
                  No teams created in this department yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {detail?.teams?.map((team) => {
                    const teamMembers = (detail?.members || []).filter(
                      (m) => m.teamId === team.id,
                    )
                    // Eligible members for this team: in this department, not Dept Head, not already in this team
                    const eligibleEmployees = (detail?.members || []).filter(
                      (m) => m.id !== detail?.headId && m.teamId !== team.id,
                    )
                    const selectedUserId = teamAddSelection[team.id] || ""

                    return (
                      <div key={team.id} className="dept-team-box">
                        <div className="dept-team-header">
                          <div>
                            <h4 className="dept-team-title">{team.name}</h4>
                            {team.description && (
                              <p className="dept-team-desc">
                                {team.description}
                              </p>
                            )}
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#64748b",
                                marginTop: "4px",
                                fontWeight: 500,
                              }}
                            >
                              {teamMembers.length}{" "}
                              {teamMembers.length === 1 ? "member" : "members"}
                            </div>
                          </div>
                          {canManage && (
                            <button
                              type="button"
                              className="dept-btn-danger-icon"
                              title="Delete team"
                              onClick={() =>
                                handleDeleteTeam(team.id, team.name)
                              }
                              disabled={submitting}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>

                        {/* List of current team members */}
                        <div className="dept-team-members-section">
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#475569",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Team Members
                          </div>

                          {teamMembers.length === 0 ? (
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#94a3b8",
                                fontStyle: "italic",
                              }}
                            >
                              No members assigned to this team yet.
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              {teamMembers.map((m) => (
                                <div
                                  key={m.id}
                                  className="dept-team-member-item"
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "50%",
                                        background: "#e2e8f0",
                                        color: "#334155",
                                        fontWeight: 700,
                                        fontSize: "0.7rem",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      {(
                                        m.fullName?.[0] || m.email[0]
                                      ).toUpperCase()}
                                    </div>
                                    <span
                                      style={{
                                        fontWeight: 600,
                                        color: "#1e293b",
                                      }}
                                    >
                                      {m.fullName || m.email}
                                    </span>
                                    {m.position &&
                                      m.position.toLowerCase() !==
                                        "dept head" &&
                                      m.position.toLowerCase() !==
                                        "department head" && (
                                        <span
                                          style={{
                                            fontSize: "0.7rem",
                                            background: "#e2e8f0",
                                            color: "#475569",
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                          }}
                                        >
                                          {m.position}
                                        </span>
                                      )}
                                  </div>
                                  {canManage && (
                                    <button
                                      type="button"
                                      className="dept-team-remove-member"
                                      title="Remove from this team"
                                      disabled={submitting}
                                      onClick={() =>
                                        handleRemoveMemberFromTeam(m.id)
                                      }
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Member into this Team */}
                          {canManage && (
                            <div style={{ marginTop: "4px" }}>
                              {eligibleEmployees.length > 0 ? (
                                <div className="dept-team-add-row">
                                  <select
                                    className="dept-select"
                                    style={{
                                      height: "34px",
                                      fontSize: "0.8125rem",
                                      padding: "4px 8px",
                                    }}
                                    value={selectedUserId}
                                    onChange={(e) =>
                                      setTeamAddSelection((prev) => ({
                                        ...prev,
                                        [team.id]: e.target.value,
                                      }))
                                    }
                                    disabled={submitting}
                                  >
                                    <option value="">
                                      -- Add employee to {team.name} --
                                    </option>
                                    {eligibleEmployees.map((emp) => (
                                      <option key={emp.id} value={emp.id}>
                                        {emp.fullName || emp.email}{" "}
                                        {emp.position
                                          ? `(${emp.position})`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="dept-btn-primary"
                                    style={{
                                      flex: "none",
                                      padding: "6px 12px",
                                      fontSize: "0.8125rem",
                                    }}
                                    disabled={!selectedUserId || submitting}
                                    onClick={() =>
                                      handleAssignMemberToTeam(
                                        team.id,
                                        selectedUserId,
                                      )
                                    }
                                  >
                                    <PlusIcon /> Add
                                  </button>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#94a3b8",
                                    marginTop: "2px",
                                  }}
                                >
                                  {(detail?.members || []).filter(
                                    (m) => m.id !== detail?.headId,
                                  ).length === 0
                                    ? "Assign employees in the Employees tab first to add them here."
                                    : "All department employees are already in this team."}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Edit Member Position & Team Dialog */}
      {editingMember && (
        <div
          className="dept-modal-backdrop"
          style={{ zIndex: 110 }}
          onClick={() => setEditingMember(null)}
        >
          <div
            className="dept-modal"
            style={{ maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dept-modal-header">
              <h3 className="dept-modal-title">Edit Member Details</h3>
              <button
                type="button"
                className="dept-modal-close"
                onClick={() => setEditingMember(null)}
              >
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleSaveMemberDetails}>
              <div className="dept-modal-body">
                {editMemberError && (
                  <div
                    style={{
                      color: "#991b1b",
                      background: "#fef2f2",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                    }}
                  >
                    {editMemberError}
                  </div>
                )}
                <div>
                  <strong>
                    {editingMember.fullName || editingMember.email}
                  </strong>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {editingMember.email}
                  </div>
                </div>

                <div className="dept-field">
                  <label className="dept-label" htmlFor="mem-pos">
                    Job Title / Position
                  </label>
                  <input
                    id="mem-pos"
                    className="dept-input"
                    placeholder="e.g. Senior Frontend Developer, Media Buyer"
                    value={memberPosition}
                    onChange={(e) => setMemberPosition(e.target.value)}
                  />
                </div>

                <div className="dept-field">
                  <label className="dept-label" htmlFor="mem-team">
                    Assigned Team
                  </label>
                  <select
                    id="mem-team"
                    className="dept-select"
                    value={memberTeamId}
                    onChange={(e) => setMemberTeamId(e.target.value)}
                  >
                    <option value="">-- No Specific Team --</option>
                    {detail?.teams?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="dept-modal-footer">
                <button
                  type="button"
                  className="dept-btn-outline"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dept-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
