"use client"

import { Form } from "@/components/ui/form"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { RequiredMark } from "@/components/ui/required-mark"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveClient, type Client } from "../api/clients-api"
import {
  CONTACT_PHONE_PATTERN,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
  passwordIssue,
  passwordPolicyHint,
} from "@/lib/validation"
import { errorMessage } from "@/lib/error-message"

const fieldClass =
  "grid min-w-0 content-start gap-y-[7px] pb-4 text-xs font-semibold text-foreground"
function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-4 items-center gap-1 leading-4">
      {children}
      <RequiredMark />
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
      !CONTACT_PHONE_PATTERN.test(contactNumber.trim())
    ) {
      setError(
        "Enter a name with at least 2 characters and a valid contact number (7–20 characters).",
      )
      return
    }
    if (!isValidEmail(email.trim())) {
      setError("Enter a valid email address.")
      return
    }
    const passwordError = client ? null : passwordIssue(password)
    if (passwordError) {
      setError(passwordError)
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
        errorMessage(reason, "Could not save the client. Please try again."),
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal
      onClose={onClose}
      busy={pending}
      closeOnEscape={false}
      size="lg"
      elevated
    >
      <ModalHeader
        title={client ? "Edit Client" : "Create Client"}
        description={
          client
            ? "Update the client's contact details and account status."
            : "Add a client account and set their initial login password."
        }
        closeLabel="Close client form"
        closeDisabled={pending}
      />
      <Form onSubmit={submit}>
        <fieldset
          disabled={pending}
          className="m-0 grid min-w-0 gap-4 border-0 p-5 disabled:opacity-60 sm:grid-cols-2 sm:p-6"
        >
          {error && <Alert className="sm:col-span-2">{error}</Alert>}
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
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={256}
                autoComplete="new-password"
                aria-describedby="client-password-hint"
              />
              <p
                id="client-password-hint"
                className="m-0 text-[11px] text-[#738096]"
              >
                {passwordPolicyHint} Share this password securely with the
                client.
              </p>
            </div>
          )}
        </fieldset>
        <ModalFooter>
          <Button
            type="button"
            variant="brandOutline"
            size="modal"
            className="cursor-pointer shadow-none"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            variant="brand"
            size="modal"
            className="cursor-pointer shadow-none"
          >
            {pending ? "Saving…" : client ? "Save Changes" : "Create Client"}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  )
}
