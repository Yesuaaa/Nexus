"use client"

import { useState } from "react"
import { Eye, EyeOff, KeyRound } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
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
import { cn } from "@/lib/utils"
import { createEmployeeLogin, type Employee } from "../api/employees-api"

const passwordRule =
  "Use at least 12 characters with uppercase, lowercase, a number, and a special character."

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
                    disabled={pending}
                  />
                  <button
                    type="button"
                    aria-label={`${visible[key] ? "Hide" : "Show"} ${key === "password" ? "password" : "confirm password"}`}
                    aria-pressed={visible[key]}
                    className={cn(
                      "absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-[#65718a]",
                      focusRing,
                    )}
                    disabled={pending}
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
