"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FormInput } from "@/components/ui/form-input"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { renameAdministrativeWorkspace } from "../api/administrative-projects-api"

export function AdministrativeWorkspaceName({
  projectId,
  name: initialName,
  grouped,
  onSaved,
}: {
  projectId: string
  name: string
  grouped: boolean
  onSaved: () => void
}) {
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <form
      className="my-4 flex flex-wrap items-end gap-3"
      aria-label="Rename workspace"
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        setError("")
        try {
          await renameAdministrativeWorkspace(projectId, name.trim())
          sileo.success({ title: "Workspace renamed" })
          onSaved()
        } catch (reason) {
          setError(errorMessage(reason, "Couldn't rename workspace."))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="text-xs">
        Workspace name
        <FormInput
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={120}
          required
          disabled={busy}
        />
      </label>
      <Button type="submit" disabled={busy}>
        Rename workspace
      </Button>
      {grouped && (
        <p className="w-full text-xs text-muted-foreground">
          Renames the shared workspace. Individual project names remain
          unchanged.
        </p>
      )}
      {error && (
        <p className="w-full text-sm" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
