import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import { sileo } from "sileo"
import type { Account } from "@/features/auth/types"
import { hasPermission, Permissions } from "@/features/auth/permissions"
import { PlusIcon, SearchIcon } from "@/components/layout/icons"
import { deleteDepartment, listDepartments, type Department } from "./api"
import { CreateEditDepartmentDialog } from "./create-edit-department-dialog"
import { ManageMembersDrawer } from "./manage-members-drawer"
import "./departments.css"

export function DepartmentManagementPage() {
  const actor = useOutletContext<Account>()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [selectedDeptIdForMembers, setSelectedDeptIdForMembers] = useState<
    string | null
  >(null)

  const canManage = hasPermission(actor, Permissions.DEPARTMENTS_MANAGE)
  const canDelete = hasPermission(actor, Permissions.DEPARTMENTS_DELETE)

  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    listDepartments()
      .then((data) => {
        if (active) {
          setDepartments(data)
          setError("")
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load departments",
          )
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [revision])

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `Are you sure you want to delete the department "${name}"? Members will be unassigned.`,
      )
    ) {
      return
    }
    try {
      await deleteDepartment(id)
      sileo.success({ title: "Department deleted" })
      setRevision((r) => r + 1)
    } catch (err: unknown) {
      sileo.error({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Failed to delete",
      })
    }
  }

  const filteredDepartments = departments.filter((dept) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      dept.name.toLowerCase().includes(q) ||
      dept.code?.toLowerCase().includes(q) ||
      dept.head?.fullName?.toLowerCase().includes(q) ||
      dept.head?.email.toLowerCase().includes(q)
    )
  })

  return (
    <main className="dept-page">
      <div className="dept-header-card">
        <div>
          <div className="dept-header-eyebrow">ADMINISTRATION</div>
          <h1 className="dept-header-title">Department Management</h1>
          <p className="dept-header-sub">
            Organize departments, assign department heads, and manage employee
            assignments.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className="dept-primary-btn"
            onClick={() => {
              setEditingDept(null)
              setDialogOpen(true)
            }}
          >
            <PlusIcon /> Create Department
          </button>
        )}
      </div>

      <div className="dept-container">
        <div className="dept-toolbar">
          <div className="dept-search-wrapper">
            <span className="dept-search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              className="dept-search-input"
              placeholder="Search department or head..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ color: "#64748b", fontSize: "0.875rem" }}>
            {filteredDepartments.length}{" "}
            {filteredDepartments.length === 1 ? "department" : "departments"}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="dept-empty-state">Loading departments...</div>
        ) : filteredDepartments.length === 0 ? (
          <div className="dept-empty-state">
            {search
              ? "No departments matched your search."
              : "No departments created yet. Create one above!"}
          </div>
        ) : (
          <div className="dept-grid">
            {filteredDepartments.map((dept) => (
              <div key={dept.id} className="dept-card">
                <div>
                  <div className="dept-card-top">
                    <h3 className="dept-card-title">{dept.name}</h3>
                    {dept.code && (
                      <span className="dept-badge">{dept.code}</span>
                    )}
                  </div>
                  <p className="dept-desc">
                    {dept.description || "No description provided."}
                  </p>

                  <div className="dept-meta-box">
                    <div className="dept-meta-row">
                      <span className="dept-meta-label">Department Head</span>
                      <span className="dept-meta-val">
                        {dept.head
                          ? dept.head.fullName || dept.head.email
                          : "Unassigned"}
                      </span>
                    </div>
                    <div className="dept-meta-row">
                      <span className="dept-meta-label">Structure</span>
                      <span className="dept-meta-val">
                        {dept.teamCount ?? 0}{" "}
                        {(dept.teamCount ?? 0) === 1 ? "team" : "teams"} •{" "}
                        {dept.memberCount}{" "}
                        {dept.memberCount === 1 ? "employee" : "employees"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="dept-card-actions">
                  <button
                    type="button"
                    className="dept-btn-outline"
                    onClick={() => setSelectedDeptIdForMembers(dept.id)}
                  >
                    Members & Teams ({dept.memberCount})
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      className="dept-btn-outline"
                      onClick={() => {
                        setEditingDept(dept)
                        setDialogOpen(true)
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogOpen && (
        <CreateEditDepartmentDialog
          department={editingDept}
          onClose={() => setDialogOpen(false)}
          onDelete={canDelete ? handleDelete : undefined}
          onSaved={() => {
            setDialogOpen(false)
            setRevision((r) => r + 1)
            sileo.success({
              title: editingDept
                ? "Department updated"
                : "Department created successfully",
            })
          }}
        />
      )}

      {selectedDeptIdForMembers && (
        <ManageMembersDrawer
          departmentId={selectedDeptIdForMembers}
          canManage={canManage}
          onClose={() => setSelectedDeptIdForMembers(null)}
          onChanged={() => setRevision((r) => r + 1)}
        />
      )}
    </main>
  )
}
