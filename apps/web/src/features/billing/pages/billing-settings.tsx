"use client"
import { useState, type FormEvent } from "react"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { errorMessage } from "@/lib/error-message"
import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"

type Configuration = {
  defaultTerms: string
  defaultDueDays: number
  invoicePrefix: string
  version: number
}
type Method = { id: string; label: string }
type Settings = { configuration: Configuration; methods: Method[] }
function ConfigurationForm({
  title,
  config,
  canManage,
  onSaved,
}: {
  title: string
  config: Configuration
  canManage: boolean
  onSaved: () => void
}) {
  const [terms, setTerms] = useState(config.defaultTerms)
  const [days, setDays] = useState(String(config.defaultDueDays))
  const [prefix, setPrefix] = useState(config.invoicePrefix)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await apiRequest("/api/billing/settings", {
        method: "PATCH",
        body: JSON.stringify({
          defaultTerms: terms,
          defaultDueDays: Number(days),
          invoicePrefix: prefix,
          version: config.version,
        }),
      })
      onSaved()
    } catch (reason) {
      setError(errorMessage(reason, "Could not save billing settings."))
    } finally {
      setPending(false)
    }
  }
  return (
    <form className="grid max-w-lg gap-3" onSubmit={submit}>
      {title === "Billing Configuration" ? (
        <>
          <label htmlFor="billing-terms">Default payment terms</label>
          <FormTextarea
            id="billing-terms"
            maxLength={2000}
            value={terms}
            readOnly={!canManage}
            onChange={(event) => setTerms(event.target.value)}
          />
          <label htmlFor="billing-days">Default due period (days)</label>
          <FormInput
            id="billing-days"
            type="number"
            min={0}
            max={365}
            required
            value={days}
            readOnly={!canManage}
            onChange={(event) => setDays(event.target.value)}
          />
        </>
      ) : (
        <>
          <label htmlFor="billing-prefix">Invoice prefix</label>
          <FormInput
            id="billing-prefix"
            required
            maxLength={20}
            pattern="[A-Z0-9]{1,20}"
            value={prefix}
            readOnly={!canManage}
            onChange={(event) => setPrefix(event.target.value.toUpperCase())}
          />
          <p>
            New invoice numbers use this prefix and a unique sequence. Existing
            numbers stay unchanged.
          </p>
        </>
      )}
      {error && <Alert>{error}</Alert>}
      {canManage && (
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      )}
    </form>
  )
}
function PaymentMethods({
  methods,
  canManage,
  onSaved,
}: {
  methods: Method[]
  canManage: boolean
  onSaved: () => void
}) {
  const [label, setLabel] = useState("")
  const [selected, setSelected] = useState<Method | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function change(path: string, method: string, body?: object) {
    setPending(true)
    setError("")
    try {
      await apiRequest(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      setLabel("")
      setSelected(null)
      onSaved()
    } catch (reason) {
      setError(errorMessage(reason, "Could not update payment methods."))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="grid max-w-lg gap-4">
      <p>
        These labels describe manually recorded payments; they do not connect to
        a payment gateway.
      </p>
      {methods.length ? (
        <ul className="grid gap-2">
          {methods.map((method) => (
            <li
              key={method.id}
              className="flex items-center justify-between gap-3"
            >
              <span>{method.label}</span>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(method)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No payment methods configured.</p>
      )}
      {canManage && (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void change("/api/billing/payment-methods", "POST", { label })
          }}
        >
          <label htmlFor="method-label">Payment method label</label>
          <FormInput
            id="method-label"
            required
            maxLength={100}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button type="submit" variant="brand" disabled={pending}>
            Add method
          </Button>
        </form>
      )}
      {error && !selected && <Alert>{error}</Alert>}
      {selected && (
        <ConfirmationDialog
          title="Remove payment method?"
          subject={selected.label}
          description="Methods used by recorded payments cannot be removed."
          confirmLabel="Remove"
          pendingLabel="Removing…"
          pending={pending}
          error={error}
          onClose={() => {
            setSelected(null)
            setError("")
          }}
          onConfirm={() =>
            void change(
              `/api/billing/payment-methods/${encodeURIComponent(selected.id)}`,
              "DELETE",
            )
          }
        />
      )}
    </div>
  )
}
export function BillingSettings({ title }: { title: string }) {
  const account = usePortalAccount()
  const result = useAsyncResource(
    (signal) => apiRequest<Settings>("/api/billing/settings", { signal }),
    [],
    { fallbackError: "Could not load billing settings." },
  )
  if (result.loading)
    return (
      <p className="mt-5" role="status">
        Loading billing settings…
      </p>
    )
  if (result.error || !result.data)
    return (
      <div className="mt-5">
        <Alert>{result.error || "Could not load billing settings."}</Alert>
        <Button variant="outline" size="sm" onClick={result.retry}>
          Try again
        </Button>
      </div>
    )
  return (
    <section className="mt-5">
      {title === "Payment Methods" ? (
        <PaymentMethods
          methods={result.data.methods}
          canManage={account.role === "ADMIN"}
          onSaved={result.retry}
        />
      ) : (
        <ConfigurationForm
          key={`${title}-${result.data.configuration.version}`}
          title={title}
          config={result.data.configuration}
          canManage={account.role === "ADMIN"}
          onSaved={result.retry}
        />
      )}
    </section>
  )
}
