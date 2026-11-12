import { useState } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { sileo } from "@/lib/toast"
import {
  deleteEmployeeLogin,
  permanentlyDeleteEmployeeLogin,
  setEmployeeLoginStatus,
  type Employee,
} from "../api/employees-api"

export type EmployeeLoginAction =
  "deactivate" | "reactivate" | "delete" | "permanent"

const actions: Record<
  EmployeeLoginAction,
  {
    title: string
    description: string
    confirmLabel: string
    pendingLabel: string
    destructive: boolean
    successTitle: string
    run: (employeeId: string) => Promise<void>
  }
> = {
  deactivate: {
    title: "Deactivate account?",
    description:
      "This immediately signs the employee out and prevents login. You can reactivate the login later.",
    confirmLabel: "Deactivate account",
    pendingLabel: "Deactivating…",
    destructive: true,
    successTitle: "Account deactivated",
    run: (id) => setEmployeeLoginStatus(id, false),
  },
  reactivate: {
    title: "Reactivate account?",
    description:
      "Allow this employee to sign in again using their existing password. Their employment status stays the same.",
    confirmLabel: "Reactivate account",
    pendingLabel: "Reactivating…",
    destructive: false,
    successTitle: "Account reactivated",
    run: (id) => setEmployeeLoginStatus(id, true),
  },
  delete: {
    title: "Move account to Archive?",
    description:
      "This moves the deactivated account to Archive and ends its sessions. Its employee record and assignments are preserved. Permanent deletion is available only from Archive.",
    confirmLabel: "Move to Archive",
    pendingLabel: "Archiving…",
    destructive: true,
    successTitle: "Account moved to Archive",
    run: deleteEmployeeLogin,
  },
  permanent: {
    title: "Permanently delete account?",
    description:
      "This permanently deletes the login account and its sessions. The employee's HR record, department, and team placement remain. Account-based leadership assignments are cleared. This cannot be undone.",
    confirmLabel: "Delete permanently",
    pendingLabel: "Deleting…",
    destructive: true,
    successTitle: "Account permanently deleted",
    run: permanentlyDeleteEmployeeLogin,
  },
}

/**
 * Confirms and runs a login-account action (deactivate, reactivate, archive,
 * or permanent delete) for an employee, then shows a success toast.
 */
export function EmployeeLoginActionDialog({
  action,
  employee,
  pending,
  onPendingChange,
  onClose,
  onCompleted,
}: {
  action: EmployeeLoginAction
  employee: Employee
  pending: boolean
  onPendingChange: (pending: boolean) => void
  onClose: () => void
  /** Called after the action succeeds; the parent should close the dialog. */
  onCompleted: () => void
}) {
  const [error, setError] = useState("")
  const copy = actions[action]

  return (
    <ConfirmationDialog
      title={copy.title}
      subject={employee.fullName}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      pendingLabel={copy.pendingLabel}
      destructive={copy.destructive}
      pending={pending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        if (pending) return
        onPendingChange(true)
        setError("")
        void copy
          .run(employee.id)
          .then(() => {
            onCompleted()
            sileo.success({
              title: copy.successTitle,
              description: `${employee.fullName}'s employee record was kept.`,
            })
          })
          .catch((reason: unknown) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Couldn't update this login account.",
            )
          })
          .finally(() => onPendingChange(false))
      }}
    />
  )
}
