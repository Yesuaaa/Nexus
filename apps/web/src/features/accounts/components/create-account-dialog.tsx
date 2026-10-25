import { useEffect, useRef, useState, type FormEvent } from "react"
import { cn } from "@/lib/utils"
import { ApiError } from "@/features/auth/api/auth-api"
import { createAccount, type AccountRole } from "../api/accounts-api"
import { AccountDropdown } from "./account-dropdown"
import {
  accountButton,
  accountButtonPrimary,
  accountButtonSecondary,
  accountField,
  accountFocusRing,
  accountInput,
} from "../styles/account-styles"

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
      className="fixed inset-0 m-auto max-h-[min(90dvh,780px)] w-[min(520px,calc(100vw-28px))] overflow-y-auto rounded-2xl border border-[#dce4f0] bg-background p-0 font-sans text-sm text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)] backdrop:bg-[rgb(13_28_57_/_48%)]"
      aria-labelledby="create-account-title"
      onClose={closeDialog}
    >
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex justify-between gap-4 border-b border-[#e9edf4] px-7 pt-[26px] pb-5 max-[560px]:px-5">
          <div>
            <p className="mt-0 mb-2 text-[11px] font-bold tracking-[0.09em] text-[#32549a]">
              NEW ACCOUNT
            </p>
            <h2
              id="create-account-title"
              className="m-0 text-[22px] tracking-[-0.03em]"
            >
              Create account
            </h2>
            <p className="mt-[5px] mb-0 text-[#7183a2]">
              Set up an account and assign its portal access.
            </p>
          </div>
          <button
            type="button"
            className={cn(
              "size-[30px] flex-none cursor-pointer rounded-[7px] border-0 bg-[#f3f6fa] text-[23px] leading-none text-[#526686]",
              accountFocusRing,
            )}
            aria-label="Close"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-[14px] gap-y-[17px] px-7 py-[22px] max-[560px]:grid-cols-1 max-[560px]:p-5">
          <label className={accountField}>
            <span>
              Email address <strong>*</strong>
            </span>
            <input
              className={accountInput}
              name="email"
              type="email"
              autoComplete="off"
              maxLength={254}
              required
              autoFocus
              placeholder="name@example.com"
            />
          </label>
          <label className={accountField}>
            <span>
              Full name <strong>*</strong>
            </span>
            <input
              className={accountInput}
              name="fullName"
              type="text"
              minLength={2}
              maxLength={100}
              autoComplete="off"
              required
              placeholder="Full name"
            />
          </label>
          <label className={accountField}>
            <span>Contact number</span>
            <input
              className={accountInput}
              name="contactNumber"
              type="tel"
              autoComplete="off"
              pattern="[+]?[0-9](?:[0-9 ]|-){6,19}"
              placeholder="Optional"
            />
          </label>
          <div className={accountField}>
            <span>
              Role <strong>*</strong>
            </span>
            <AccountDropdown
              triggerClassName="h-10 border-[#d6dfec] text-foreground"
              label="Role"
              value={role}
              onChange={setRole}
              options={roles.map((option) => ({
                value: option,
                label: roleNames[option],
              }))}
            />
          </div>
          <label className={accountField}>
            <span>
              Password <strong>*</strong>
            </span>
            <input
              className={accountInput}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={1024}
              required
              placeholder="At least 12 characters"
            />
          </label>
          <label className={accountField}>
            <span>
              Confirm password <strong>*</strong>
            </span>
            <input
              className={accountInput}
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
          <p className="mx-7 mt-0 mb-3 text-xs text-[#bc3649]" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-[9px] border-t border-[#e9edf4] px-7 pt-[18px] pb-6 max-[560px]:px-5">
          <button
            type="button"
            className={cn(accountButton, accountButtonSecondary)}
            onClick={closeDialog}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={cn(accountButton, accountButtonPrimary)}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </dialog>
  )
}
