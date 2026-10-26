"use client"

import { useEffect, useState } from "react"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { sileo } from "sileo"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { PlusIcon } from "@/components/layout/icons"
import { contentClass, focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import {
  deleteDepartment,
  listDepartments,
  type Department,
} from "../api/departments-api"
import { CreateEditDepartmentDialog } from "../components/create-edit-department-dialog"
import { DepartmentKpiCards } from "../components/department-kpi-cards"
import { DepartmentTable } from "../components/department-table"
import { ManageMembersDrawer } from "../components/manage-members-drawer"
import "../styles/departments.css"

export function DepartmentManagementPage() {
  const actor = usePortalAccount()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
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

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Department management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Department Management
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Organize departments, assign department heads, and manage employee
            assignments.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className={cn(
              "inline-flex min-h-[34px] flex-none items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#203f8c] px-[13px] text-xs leading-[1.2] font-semibold whitespace-nowrap text-white cursor-pointer transition-[background-color,border-color,color] duration-150 hover:bg-[#172f70] motion-reduce:transition-none",
              focusRing,
            )}
            onClick={() => {
              setEditingDept(null)
              setDialogOpen(true)
            }}
          >
            <PlusIcon width="14" height="14" /> Create Department
          </button>
        )}
      </header>

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
          onDelete={handleDelete}
          onRetry={() => {
            setLoading(true)
            setRevision((r) => r + 1)
          }}
        />
      </section>

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
