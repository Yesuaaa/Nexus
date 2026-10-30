"use client"

import { useRef, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { createEmployeeLogin, type Employee } from "../api/employees-api"

export function EmployeeLoginDialog({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}) {
  const opener = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(
        "Use at least 12 characters with uppercase, lowercase, a number, and a special character.",
      )
      return
    }
    if (password !== confirmation) {
      setError("Passwords do not match.")
      return
    }
    setPending(true)
    setError("")
    try {
      await createEmployeeLogin(employee.id, password)
      onSaved()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not create the login account.",
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        overlayClassName="bg-[rgb(13_28_57_/_48%)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (
            opener.current instanceof HTMLElement &&
            opener.current.isConnected
          )
            opener.current.focus()
        }}
      >
        <form onSubmit={submit}>
          <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
            <div>
              <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
                Create login account
              </DialogTitle>
              <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
                Create a Staff login for {employee.fullName} using{" "}
                {employee.email}.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="size-8 flex-none rounded-[7px] p-0"
              aria-label="Close login form"
              disabled={pending}
              onClick={onClose}
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </header>
          <fieldset
            disabled={pending}
            className="m-0 grid min-w-0 gap-4 border-0 p-5 sm:grid-cols-2 sm:p-6"
          >
            {error && (
              <p
                role="alert"
                className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649] sm:col-span-2"
              >
                {error}
              </p>
            )}
            {(["password", "confirmation"] as const).map((key) => (
              <div key={key} className="grid min-w-0 gap-[7px]">
                <label
                  htmlFor={`login-${key}`}
                  className="text-xs font-semibold"
                >
                  {key === "password" ? "Password" : "Confirm password"}{" "}
                  <span aria-hidden="true" className="text-[#d04b56]">
                    *
                  </span>
                </label>
                <div className="relative">
                  <Input
                    id={`login-${key}`}
                    type={visible[key] ? "text" : "password"}
                    value={key === "password" ? password : confirmation}
                    onChange={(event) =>
                      (key === "password" ? setPassword : setConfirmation)(
                        event.target.value,
                      )
                    }
                    className="h-10 rounded-lg border-[#d6dfec] pr-10 text-sm"
                    required
                    minLength={12}
                    maxLength={256}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={`${visible[key] ? "Hide" : "Show"} ${key === "password" ? "password" : "confirm password"}`}
                    aria-pressed={visible[key]}
                    className={cn(
                      "absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-[#65718a]",
                      focusRing,
                    )}
                    onClick={() =>
                      setVisible((value) => ({ ...value, [key]: !value[key] }))
                    }
                  >
                    {visible[key] ? (
                      <EyeOff size={16} aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            ))}
            <p className="m-0 text-[11px] leading-4 text-[#738096] sm:col-span-2">
              Use at least 12 characters with uppercase, lowercase, a number,
              and a special character.
            </p>
          </fieldset>
          <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="min-h-[38px] rounded-[9px] text-xs"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-[38px] rounded-[9px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
              disabled={pending || !employee.email}
            >
              {pending ? "Creating…" : "Create login"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
