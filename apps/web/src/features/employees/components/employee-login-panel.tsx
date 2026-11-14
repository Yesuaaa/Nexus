"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"
import { Form } from "@/components/ui/form"
import { PasswordInput } from "@/components/ui/password-input"
import { RequiredMark } from "@/components/ui/required-mark"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelAlert,
  SidePanelBody,
  SidePanelButton,
  SidePanelFieldset,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { createEmployeeLogin, type Employee } from "../api/employees-api"
import { errorMessage } from "@/lib/error-message"
import { PASSWORD_MIN_LENGTH, passwordIssue } from "@/lib/validation"

const passwordRule = `Use at least ${PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, a number, and a special character.`

export function EmployeeLoginPanel({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    if (passwordIssue(password)) {
      setError(passwordRule)
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
      panel.close(onSaved)
    } catch (reason) {
      setError(errorMessage(reason, "Could not create the login account."))
    } finally {
      setPending(false)
    }
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      dismissible={false}
      busy={pending}
    >
      <Form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <SidePanelHeader
          leading={
            <span
              className="grid size-11 flex-none place-items-center rounded-full bg-[#e8eef8] text-[#284f9e]"
              aria-hidden="true"
            >
              <KeyRound size={18} />
            </span>
          }
          title="Create login account"
          description={`Create a Staff login for ${employee.fullName}.`}
          closeLabel="Close login form"
          closeDisabled={pending}
        />
        <SidePanelBody>
          {error && <SidePanelAlert>{error}</SidePanelAlert>}
          <SidePanelFieldset title="Account">
            <DetailList className="sm:col-span-2">
              <DetailItem label="Employee">{employee.fullName}</DetailItem>
              <DetailItem label="Sign-in email">{employee.email}</DetailItem>
              <DetailItem label="Role">Staff</DetailItem>
            </DetailList>
          </SidePanelFieldset>
          <SidePanelFieldset title="Password" description={passwordRule}>
            {(["password", "confirmation"] as const).map((key) => (
              <div key={key} className="grid min-w-0 gap-[7px] pb-3">
                <label
                  htmlFor={`login-${key}`}
                  className="text-xs font-semibold"
                >
                  {key === "password" ? "Password" : "Confirm password"}{" "}
                  <RequiredMark />
                </label>
                <PasswordInput
                  id={`login-${key}`}
                  toggleLabel={
                    key === "password" ? "password" : "confirm password"
                  }
                  value={key === "password" ? password : confirmation}
                  onChange={(event) =>
                    (key === "password" ? setPassword : setConfirmation)(
                      event.target.value,
                    )
                  }
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={256}
                  autoComplete="new-password"
                  disabled={pending}
                />
              </div>
            ))}
          </SidePanelFieldset>
        </SidePanelBody>
        <SidePanelFooter>
          <SidePanelButton
            variant="secondary"
            disabled={pending}
            onClick={() => panel.close()}
          >
            Cancel
          </SidePanelButton>
          <SidePanelButton type="submit" disabled={pending || !employee.email}>
            {pending ? "Creating…" : "Create login"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
