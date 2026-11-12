"use client"

import { useState } from "react"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { sileo } from "@/lib/toast"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { PlusIcon } from "@/components/layout/icons"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { deleteDepartment, type Department } from "../api/departments-api"
import { DepartmentFormPanel } from "../components/department-form-panel"
import { DeleteDepartmentDialog } from "../components/delete-department-dialog"
import { DepartmentKpiCards } from "../components/department-kpi-cards"
import { DepartmentTable } from "../components/department-table"
import { ManageMembersDrawer } from "../components/manage-members-drawer"
import { useDepartments } from "../hooks/use-departments"
import "../styles/departments.css"
import { errorMessage } from "@/lib/error-message"

export function DepartmentManagementPage() {
  const actor = usePortalAccount()
  const departmentList = useDepartments()
  const { departments, error, retry: reload } = departmentList
  // Reloads after a change keep the current rows instead of showing skeletons.
  const loading = departmentList.loading && !departmentList.data
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    memberCount: number
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [selectedDeptIdForMembers, setSelectedDeptIdForMembers] = useState<
    string | null
  >(null)

  const canManage = hasPermission(actor, Permissions.DEPARTMENTS_MANAGE)
  const canDelete = hasPermission(actor, Permissions.DEPARTMENTS_DELETE)

  function requestDelete(id: string, name: string) {
    if (!canDelete || deleting) return
    setDeleteError("")
    const memberCount =
      departments.find((department) => department.id === id)?.memberCount ?? 0
    setDeleteTarget({ id, name, memberCount })
  }

  async function handleDelete() {
    if (!deleteTarget || deleting || !canDelete) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteDepartment(deleteTarget.id)
      setDeleteTarget(null)
      if (editingDept?.id === deleteTarget.id) setDialogOpen(false)
      if (selectedDeptIdForMembers === deleteTarget.id)
        setSelectedDeptIdForMembers(null)
      sileo.success({ title: "Department deleted" })
      reload()
    } catch (err: unknown) {
      setDeleteError(errorMessage(err, "Failed to delete department"))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Department management"
    >
      <PageHeader
        title="Department Management"
        description="Organize departments, assign department heads, and manage employee assignments."
        actions={
          canManage && (
            <PageHeaderButton
              type="button"
              onClick={() => {
                setEditingDept(null)
                setDialogOpen(true)
              }}
            >
              <PlusIcon width="14" height="14" /> Create Department
            </PageHeaderButton>
          )
        }
      />

      <div className="mt-[18px] max-[560px]:mt-[14px]">
        <DepartmentKpiCards
          departments={departments}
          loading={loading}
          unavailable={Boolean(error)}
        />
      </div>

      <section className="mt-4 min-w-0" aria-label="Departments">
        <DepartmentTable
          departments={departments}
          loading={loading}
          error={error}
          canManage={canManage}
          canDelete={canDelete}
          onEdit={(department) => {
            setEditingDept(department)
            setDialogOpen(true)
          }}
          onManageMembers={setSelectedDeptIdForMembers}
          onDelete={requestDelete}
          onRetry={reload}
        />
      </section>

      {dialogOpen && (
        <DepartmentFormPanel
          department={editingDept}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false)
            reload()
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
          onChanged={() => reload()}
        />
      )}

      {deleteTarget && (
        <DeleteDepartmentDialog
          name={deleteTarget.name}
          memberCount={deleteTarget.memberCount}
          deleting={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) setDeleteTarget(null)
          }}
          onConfirm={handleDelete}
        />
      )}
    </main>
  )
}
