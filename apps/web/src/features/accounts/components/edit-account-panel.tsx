"use client"

import { useState } from "react"
import { Alert } from "@/components/ui/alert"
import { Form } from "@/components/ui/form"
import { FormInput } from "@/components/ui/form-input"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelFieldset,
  SidePanelFooter,
  SidePanelButton,
  useSidePanel,
} from "@/components/ui/side-panel"
import type { Account } from "@/features/auth/model/types"
import { canAssignRole } from "@/features/auth/model/permissions"
import { roleLabels } from "@/features/auth/model/roles"
import { errorMessage } from "@/lib/error-message"
import { CONTACT_PHONE_PATTERN } from "@/lib/validation"
import { sileo } from "@/lib/toast"
import { updateAccount, type AccountRole } from "../api/accounts-api"
import { accountField } from "../styles/account-styles"

export function EditAccountPanel({
  account,
  actor,
  onClose,
  onSaved,
}: {
  account: Account
  actor: Account
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
  const [fullName, setFullName] = useState(account.fullName ?? "")
  const [email, setEmail] = useState(account.email)
  const [contactNumber, setContactNumber] = useState(
    account.contactNumber ?? "",
  )
  const [role, setRole] = useState<AccountRole>(account.role)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const roles = (["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const).filter(
    (next) => canAssignRole(actor, account.role, next),
  )
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={pending}
      dismissible={false}
    >
      <SidePanelHeader
        title="Edit account"
        description={account.fullName || account.email}
        closeDisabled={pending}
      />
      <Form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={async (event) => {
          event.preventDefault()
          if (pending) return
          setError("")
          if (
            contactNumber.trim() &&
            !CONTACT_PHONE_PATTERN.test(contactNumber.trim())
          ) {
            setError("Provide a valid contact number.")
            return
          }
          setPending(true)
          try {
            await updateAccount(account.id, {
              fullName: fullName.trim(),
              email: email.trim(),
              contactNumber: contactNumber.trim(),
              role,
            })
            sileo.success({ title: "Account updated" })
            onSaved()
            panel.close()
          } catch (failure) {
            setError(errorMessage(failure, "Couldn't update the account."))
          } finally {
            setPending(false)
          }
        }}
      >
        <SidePanelBody>
          {error && <Alert>{error}</Alert>}
          <SidePanelFieldset title="Account details">
            <label className={accountField}>
              Full name
              <FormInput
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={pending}
              />
            </label>
            <label className={accountField}>
              Email address
              <FormInput
                required
                type="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </label>
            <label className={accountField}>
              Contact number
              <FormInput
                type="tel"
                maxLength={20}
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
                disabled={pending}
              />
            </label>
            <div className={accountField}>
              <span>Role</span>
              <FilterSelect
                label="Account role"
                value={role}
                onChange={setRole}
                disabled={pending || actor.id === account.id}
                options={roles.map((value) => ({
                  value,
                  label: roleLabels[value],
                }))}
              />
              {actor.id === account.id && (
                <p className="m-0 text-xs text-[#738096]">
                  You cannot change your own role.
                </p>
              )}
            </div>
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
          <SidePanelButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
