import { useEffect, useRef, useState, type FormEvent } from "react"
import { ApiError } from "@/features/auth/api"
import { createAccount, type AccountRole } from "./api"
import { AccountDropdown } from "./account-dropdown"

const roleNames: Record<AccountRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "User",
}

export function CreateAccountDialog({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean
  roles: AccountRole[]
  onClose: () => void
  onCreated: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [role, setRole] = useState<AccountRole>("USER")

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function closeDialog() {
    setError("")
    onClose()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const password = String(fields.get("password") ?? "")
    const confirmation = String(fields.get("confirmation") ?? "")
    if (password !== confirmation) {
      setError("Passwords do not match.")
      return
    }
    setSaving(true)
    setError("")
    try {
      await createAccount({
        email: String(fields.get("email") ?? "").trim(),
        fullName: String(fields.get("fullName") ?? "").trim(),
        contactNumber:
          String(fields.get("contactNumber") ?? "").trim() || undefined,
        password,
        role,
      })
      form.reset()
      setRole("USER")
      onCreated()
      closeDialog()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't create the account. Please try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="account-dialog"
      aria-labelledby="create-account-title"
      onClose={closeDialog}
    >
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="account-dialog-header">
          <div>
            <p className="account-eyebrow">NEW ACCOUNT</p>
            <h2 id="create-account-title">Create account</h2>
            <p>Set up an account and assign its portal access.</p>
          </div>
          <button
            type="button"
            className="account-dialog-close"
            aria-label="Close"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>

        <div className="account-dialog-fields">
          <label className="account-field">
            <span>
              Email address <strong>*</strong>
            </span>
            <input
              name="email"
              type="email"
              autoComplete="off"
              maxLength={254}
              required
              autoFocus
              placeholder="name@example.com"
            />
          </label>
          <label className="account-field">
            <span>
              Full name <strong>*</strong>
            </span>
            <input
              name="fullName"
              type="text"
              minLength={2}
              maxLength={100}
              autoComplete="off"
              required
              placeholder="Full name"
            />
          </label>
          <label className="account-field">
            <span>Contact number</span>
            <input
              name="contactNumber"
              type="tel"
              autoComplete="off"
              pattern="[+]?[0-9](?:[0-9 ]|-){6,19}"
              placeholder="Optional"
            />
          </label>
          <div className="account-field">
            <span>
              Role <strong>*</strong>
            </span>
            <AccountDropdown
              label="Role"
              value={role}
              onChange={setRole}
              options={roles.map((option) => ({
                value: option,
                label: roleNames[option],
              }))}
            />
          </div>
          <label className="account-field">
            <span>
              Password <strong>*</strong>
            </span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              required
              placeholder="At least 12 characters"
            />
          </label>
          <label className="account-field">
            <span>
              Confirm password <strong>*</strong>
            </span>
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              required
              placeholder="Repeat password"
            />
          </label>
        </div>

        {error && (
          <p className="account-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-dialog-actions">
          <button
            type="button"
            className="account-button account-button-secondary"
            onClick={closeDialog}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="account-button account-button-primary"
            disabled={saving}
          >
            {saving ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </dialog>
  )
}
