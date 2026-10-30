"use client"

import { useRef, useState } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { Input } from "@/components/ui/input"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveClient, type Client } from "../api/clients-api"

const fieldClass =
  "grid min-w-0 content-start gap-y-[7px] pb-4 text-xs font-semibold text-foreground"
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-4 items-center gap-1 leading-4">
      {children}
      <span aria-hidden="true" className="text-[#d04b56]">
        *
      </span>
      <span className="sr-only">required</span>
    </span>
  )
}

const inputClass = `h-10 w-full min-w-0 rounded-lg border-[#d6dfec] bg-background px-[11px] text-sm text-foreground placeholder:text-[#9aa8bb] ${focusRing}`

export function ClientFormDialog({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null
  onClose: () => void
  onSaved: (client: Client) => void
}) {
  const opener = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [fullName, setFullName] = useState(client?.fullName ?? "")
  const [email, setEmail] = useState(client?.email ?? "")
  const [contactNumber, setContactNumber] = useState(
    client?.contactNumber ?? "",
  )
  const [password, setPassword] = useState("")
  const [isActive, setIsActive] = useState(client?.isActive ?? true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    if (
      fullName.trim().length < 2 ||
      !/^\+?[0-9][0-9\s-]{6,19}$/.test(contactNumber.trim())
    ) {
      setError(
        "Enter a name with at least 2 characters and a valid contact number (7–20 characters).",
      )
      return
    }
    setPending(true)
    setError("")
    try {
      const saved = await saveClient(client?.id ?? null, {
        fullName: fullName.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim(),
        isActive,
        ...(!client ? { password } : {}),
      })
      onSaved(saved)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save the client. Please try again.",
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
        overlayClassName="z-[110] bg-[rgb(13_28_57_/_48%)]"
        className="z-[110] max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (
            opener.current instanceof HTMLElement &&
            opener.current.isConnected
          )
            opener.current.focus()
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
          <div className="min-w-0">
            <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
              {client ? "Edit Client" : "Create Client"}
            </DialogTitle>
            <DialogDescription className="mt-1 mb-0 text-xs text-[#738096]">
              {client
                ? "Update the client's contact details and account status."
                : "Add a client account and set their initial login password."}
            </DialogDescription>
          </div>
          <Button
            variant="outline"
            type="button"
            className="grid size-8 flex-none place-items-center rounded-[7px] border border-[#e1e4ea] bg-background p-0 text-[#65718a] shadow-none hover:bg-[#f1f5fc] disabled:opacity-50"
            aria-label="Close client form"
            disabled={pending}
            onClick={onClose}
          >
            <CloseIcon width="16" height="16" />
          </Button>
        </header>
        <form onSubmit={submit}>
          <fieldset
            disabled={pending}
            className="m-0 grid min-w-0 gap-4 border-0 p-5 disabled:opacity-60 sm:grid-cols-2 sm:p-6"
          >
            {error && (
              <p
                role="alert"
                className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649] sm:col-span-2"
              >
                {error}
              </p>
            )}
            <label className={fieldClass} htmlFor="client-name">
              <RequiredLabel>Full Name</RequiredLabel>
              <Input
                autoFocus
                id="client-name"
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label className={fieldClass} htmlFor="client-email">
              <RequiredLabel>Email Address</RequiredLabel>
              <Input
                id="client-email"
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label className={fieldClass} htmlFor="client-contact">
              <RequiredLabel>Contact Number</RequiredLabel>
              <Input
                id="client-contact"
                className={inputClass}
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
                maxLength={20}
                autoComplete="tel"
              />
            </label>
            <div className={fieldClass}>
              <label className="text-xs font-semibold" htmlFor="client-status">
                <RequiredLabel>Account Status</RequiredLabel>
              </label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(value) => setIsActive(value === "active")}
                disabled={pending}
              >
                <SelectTrigger id="client-status" className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[120]">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <p className="m-0 text-[11px] text-[#738096]">
                Inactive clients cannot sign in.
              </p>
            </div>
            {!client && (
              <div className="grid min-w-0 gap-y-[7px] pb-4 sm:col-span-2">
                <label
                  className="text-xs font-semibold"
                  htmlFor="client-password"
                >
                  <RequiredLabel>Initial Password</RequiredLabel>
                </label>
                <Input
                  id="client-password"
                  className={inputClass}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={12}
                  maxLength={256}
                  autoComplete="new-password"
                  aria-describedby="client-password-hint"
                />
                <p
                  id="client-password-hint"
                  className="m-0 text-[11px] text-[#738096]"
                >
                  Use at least 12 characters. Share this password securely with
                  the client.
                </p>
              </div>
            )}
          </fieldset>
          <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-[38px] cursor-pointer rounded-[9px] border-[#d7e0ee] bg-background px-[15px] text-xs font-semibold text-[#24437e] shadow-none hover:enabled:bg-[#f1f5fc]"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="h-auto min-h-[38px] cursor-pointer rounded-[9px] border border-transparent bg-[#203f8c] px-[15px] text-xs font-semibold text-white shadow-none hover:enabled:bg-[#172f70]"
            >
              {pending ? "Saving…" : client ? "Save Changes" : "Create Client"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
