import { Form } from "@/components/ui/form"
import { useState, type FormEvent } from "react"
import { Alert } from "@/components/ui/alert"
import { FilterSelect } from "@/components/ui/filter-select"
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal"
import { PasswordInput } from "@/components/ui/password-input"
import { RequiredMark } from "@/components/ui/required-mark"
import { roleLabels } from "@/features/auth/model/roles"
import { cn } from "@/lib/utils"
import {
  NAME_PATTERN,
  PH_MOBILE_PATTERN,
  isValidEmail,
  passwordIssue,
} from "@/lib/validation"
import { createAccount, type AccountRole } from "../api/accounts-api"
import {
  accountButton,
  accountButtonPrimary,
  accountButtonSecondary,
  accountField,
  accountInput,
} from "../styles/account-styles"
import { errorMessage } from "@/lib/error-message"

type FieldName =
  "email" | "fullName" | "contactNumber" | "password" | "confirmation"
type Values = Record<FieldName, string>

const emptyValues: Values = {
  email: "",
  fullName: "",
  contactNumber: "",
  password: "",
  confirmation: "",
}

function validate(values: Values): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {}
  const email = values.email.trim()
  const name = values.fullName.trim()
  const phone = values.contactNumber
  const { password, confirmation } = values

  if (!email) errors.email = "Email address is required."
  else if (!isValidEmail(email))
    errors.email = "Enter a valid email like name@example.com."

  if (!name) errors.fullName = "Full name is required."
  else if (name.length < 2)
    errors.fullName = "Full name must be at least 2 characters."
  else if (!NAME_PATTERN.test(name))
    errors.fullName = "Letters, spaces, hyphens, apostrophes and periods only."

  if (phone && !PH_MOBILE_PATTERN.test(phone))
    errors.contactNumber = "Enter 11 digits starting with 09 or 08."

  if (!password) errors.password = "Password is required."
  else {
    const issue = passwordIssue(password)
    if (issue) errors.password = issue
  }

  if (!confirmation) errors.confirmation = "Please confirm your password."
  else if (password !== confirmation)
    errors.confirmation = "Passwords do not match."

  return errors
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="m-0 text-[11px] font-normal text-[#bc3649]">{message}</p>
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [role, setRole] = useState<AccountRole>("USER")
  const [values, setValues] = useState<Values>(emptyValues)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  )
  const [submitted, setSubmitted] = useState(false)
  // Remounts the password fields on reset so their show/hide state clears.
  const [passwordKey, setPasswordKey] = useState(0)
  const errors = validate(values)

  function resetForm() {
    setValues(emptyValues)
    setTouched({})
    setSubmitted(false)
    setPasswordKey((current) => current + 1)
    setRole("USER")
    setError("")
  }

  function closeDialog() {
    resetForm()
    onClose()
  }

  function showError(field: FieldName) {
    const hasValue = values[field].length > 0
    return hasValue || touched[field] || submitted ? errors[field] : undefined
  }

  function setField(field: FieldName, value: string) {
    const next = field === "contactNumber" ? value.replace(/\D/g, "") : value
    setValues((current) => ({ ...current, [field]: next }))
  }

  function blurField(field: FieldName) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function inputClass(field: FieldName) {
    return cn(
      accountInput,
      showError(field) && [
        "border-[#d64557] focus:border-[#d64557] focus-visible:border-[#d64557]",
        "outline-none focus:outline-none focus-visible:outline-none",
        "focus:ring-0 focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none",
      ],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    setError("")
    try {
      await createAccount({
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        contactNumber: values.contactNumber || undefined,
        password: values.password,
        role,
      })
      onCreated()
      closeDialog()
    } catch (caught) {
      setError(
        errorMessage(caught, "Couldn't create the account. Please try again."),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      size="md"
      busy={saving}
      className="font-sans text-sm"
      onClose={closeDialog}
    >
      <ModalHeader
        eyebrow="New account"
        title="Create account"
        description="Set up an account and assign its portal access."
        closeLabel="Close account creation"
        closeDisabled={saving}
      />
      <Form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid grid-cols-2 items-start gap-x-[14px] gap-y-[17px] px-5 py-[22px] max-[560px]:grid-cols-1 max-[560px]:p-5 sm:px-6">
          <label className={accountField}>
            <span>
              Email address <RequiredMark />
            </span>
            <input
              className={inputClass("email")}
              name="email"
              type="email"
              autoComplete="off"
              maxLength={254}
              autoFocus
              placeholder="name@example.com"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              onBlur={() => blurField("email")}
              aria-invalid={Boolean(showError("email"))}
            />
            <FieldError message={showError("email")} />
          </label>
          <label className={accountField}>
            <span>
              Full name <RequiredMark />
            </span>
            <input
              className={inputClass("fullName")}
              name="fullName"
              type="text"
              maxLength={100}
              autoComplete="off"
              placeholder="Full name"
              value={values.fullName}
              onChange={(event) => setField("fullName", event.target.value)}
              onBlur={() => blurField("fullName")}
              aria-invalid={Boolean(showError("fullName"))}
            />
            <FieldError message={showError("fullName")} />
          </label>
          <label className={accountField}>
            <span>Contact number</span>
            <input
              className={inputClass("contactNumber")}
              name="contactNumber"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              autoComplete="off"
              placeholder="Optional"
              value={values.contactNumber}
              onChange={(event) =>
                setField("contactNumber", event.target.value)
              }
              onBlur={() => blurField("contactNumber")}
              aria-invalid={Boolean(showError("contactNumber"))}
            />
            <FieldError message={showError("contactNumber")} />
          </label>
          <div className={accountField}>
            <span>
              Role <RequiredMark />
            </span>
            <FilterSelect
              className="w-full"
              triggerClassName="h-10 border-[#d6dfec] text-sm text-foreground max-[560px]:h-10"
              label="Role"
              announceValue
              value={role}
              onChange={setRole}
              options={roles.map((option) => ({
                value: option,
                label: roleLabels[option],
              }))}
            />
          </div>
          <label className={accountField}>
            <span>
              Password <RequiredMark />
            </span>
            <PasswordInput
              key={`password-${passwordKey}`}
              className={cn(inputClass("password"), "text-sm shadow-none")}
              name="password"
              autoComplete="new-password"
              maxLength={1024}
              placeholder="At least 12 characters"
              value={values.password}
              onChange={(event) => setField("password", event.target.value)}
              onBlur={() => blurField("password")}
              aria-invalid={Boolean(showError("password"))}
            />
            <FieldError message={showError("password")} />
          </label>
          <label className={accountField}>
            <span>
              Confirm password <RequiredMark />
            </span>
            <PasswordInput
              key={`confirmation-${passwordKey}`}
              toggleLabel="confirm password"
              className={cn(inputClass("confirmation"), "text-sm shadow-none")}
              name="confirmation"
              autoComplete="new-password"
              maxLength={1024}
              placeholder="Repeat password"
              value={values.confirmation}
              onChange={(event) => setField("confirmation", event.target.value)}
              onBlur={() => blurField("confirmation")}
              aria-invalid={Boolean(showError("confirmation"))}
            />
            <FieldError message={showError("confirmation")} />
          </label>
        </div>

        {error && (
          <Alert variant="text" className="mx-5 mb-3 sm:mx-6">
            {error}
          </Alert>
        )}
        <ModalFooter>
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
        </ModalFooter>
      </Form>
    </Modal>
  )
}
