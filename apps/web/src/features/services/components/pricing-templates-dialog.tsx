"use client"

import { Form } from "@/components/ui/form"

import { useState, type FormEvent, type ReactNode } from "react"
import { sileo } from "@/lib/toast"
import { focusRing } from "@/components/layout/styles"
import { InlineConfirm } from "@/components/ui/inline-confirm"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SheetClose } from "@/components/ui/sheet"
import {
  SidePanel,
  SidePanelAlert,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { cn } from "@/lib/utils"
import {
  deletePricingTemplate,
  updatePricingTemplate,
  type PricingTemplate,
} from "../api/services-api"
import { needsAmount, PriceFields } from "./service-price-fields"
import { errorMessage } from "@/lib/error-message"

const inputClass = `h-10 w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm ${focusRing}`
const fieldClass = "grid min-w-0 gap-1.5"
const labelClass = "text-xs font-semibold"
const selectionId = "managed-template-selection"
const deleteButtonId = "managed-template-delete"

/** Focus an element once React has committed the view that renders it. */
function focusAfterRender(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus())
}

function TemplateEditor({
  template,
  selector,
  confirmingDelete,
  onStartDelete,
  onCancelDelete,
  onSaved,
  onDeleted,
  onPendingChange,
}: {
  template: PricingTemplate
  /** Template picker shown above the fields. */
  selector: ReactNode
  confirmingDelete: boolean
  onStartDelete: () => void
  onCancelDelete: () => void
  onSaved: (template: PricingTemplate) => void
  onDeleted: (id: string) => void
  onPendingChange: (pending: boolean) => void
}) {
  const [name, setName] = useState(template.name)
  const [model, setModel] = useState(template.pricingModel)
  const [amount, setAmount] = useState(template.amount ?? "")
  const [currency, setCurrency] = useState(template.currency)
  const [interval, setInterval] = useState(template.billingInterval)
  const [isPublic, setIsPublic] = useState(template.isPublic)
  const [pending, setPending] = useState(false)
  // Save errors show at the top of the body; delete errors inside the confirm.
  const [error, setError] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const linkedServices = template.services ?? []

  function setBusy(value: boolean) {
    setPending(value)
    onPendingChange(value)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    if (name.trim().length < 2) {
      setError("Enter a template name with at least 2 characters")
      return
    }
    if (
      needsAmount(model) &&
      (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
    ) {
      setError("Enter a valid price")
      return
    }
    if (model === "RECURRING" && !interval) {
      setError("Select a billing interval")
      return
    }
    setBusy(true)
    setError("")
    try {
      const saved = await updatePricingTemplate(template.id, {
        name: name.trim(),
        pricingModel: model,
        currency: currency.toUpperCase(),
        amount: needsAmount(model) ? Number(amount) : null,
        billingInterval: model === "RECURRING" ? interval : null,
        isPublic,
      })
      onSaved(saved)
      sileo.success({
        title: "Pricing template updated",
        description: `${saved.name} was saved successfully.`,
      })
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          "Couldn't update the pricing template. Please try again.",
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  function startDelete() {
    setError("")
    setDeleteError("")
    onStartDelete()
  }

  async function remove() {
    if (pending || linkedServices.length > 0) return
    setBusy(true)
    setDeleteError("")
    try {
      await deletePricingTemplate(template.id)
      onDeleted(template.id)
      sileo.success({
        title: "Pricing template deleted",
        description: `${template.name} was deleted.`,
      })
    } catch (caught) {
      setDeleteError(
        errorMessage(
          caught,
          "Couldn't delete the pricing template. Please try again.",
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => void save(event)}
    >
      <SidePanelBody>
        {error && <SidePanelAlert>{error}</SidePanelAlert>}
        {selector}
        <fieldset
          disabled={pending}
          className="m-0 grid min-w-0 gap-4 border-0 p-0"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="managed-template-name">
                Template Name
              </label>
              <input
                id="managed-template-name"
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
              />
            </div>
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="managed-template-currency">
                Currency
              </label>
              <input
                id="managed-template-currency"
                className={inputClass}
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
                pattern="[A-Za-z]{3}"
                maxLength={3}
                required
              />
            </div>
          </div>
          <PriceFields
            idPrefix="managed-template"
            model={model}
            amount={amount}
            currency={currency}
            billingInterval={interval}
            onModelChange={(value) => {
              setModel(value)
              if (value !== "RECURRING") setInterval(null)
            }}
            onAmountChange={setAmount}
            onBillingIntervalChange={setInterval}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            Display pricing publicly
          </label>
          <div className="rounded-lg border border-[#dce3ed] bg-[#f1f5fc] p-3 text-xs leading-5 text-[#526686]">
            {linkedServices.length > 0 ? (
              <>
                <p className="m-0">
                  Used by {linkedServices.length}{" "}
                  {linkedServices.length === 1 ? "service" : "services"}:{" "}
                  {linkedServices.map((service) => service.name).join(", ")}.
                </p>
                <p className="mt-1 mb-0">
                  Saving updates pricing for all of these services. Existing
                  requests keep their agreed pricing. Reassign or remove this
                  template from these services before deleting it.
                </p>
              </>
            ) : (
              <p className="m-0">
                This template is not currently used by a service.
              </p>
            )}
          </div>
        </fieldset>
      </SidePanelBody>
      <SidePanelFooter
        className={
          confirmingDelete ? "block p-0 max-[560px]:p-0" : "justify-between"
        }
      >
        {confirmingDelete ? (
          <InlineConfirm
            message={`Permanently delete “${template.name}”?`}
            detail="This cannot be undone."
            confirmLabel="Delete permanently"
            cancelLabel="Cancel deletion"
            pendingLabel="Deleting..."
            pending={pending}
            error={deleteError}
            className="px-6 py-3.5 max-[560px]:px-5"
            onCancel={onCancelDelete}
            onConfirm={() => void remove()}
          />
        ) : (
          <>
            <SidePanelButton
              id={deleteButtonId}
              variant="secondary"
              className="border-[#f1cbd1] text-[#bc3649] hover:bg-[#fff6f7] hover:text-[#bc3649]"
              disabled={pending || linkedServices.length > 0}
              onClick={startDelete}
            >
              Delete Template
            </SidePanelButton>
            <SidePanelButton type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Template"}
            </SidePanelButton>
          </>
        )}
      </SidePanelFooter>
    </Form>
  )
}

export function PricingTemplatesDialog({
  templates,
  initialTemplateId,
  onClose,
  onSaved,
  onDeleted,
}: {
  templates: PricingTemplate[]
  initialTemplateId?: string
  onClose: () => void
  onSaved: (template: PricingTemplate) => void
  onDeleted: (id: string) => void
}) {
  const panel = useSidePanel(onClose)
  const [selectedId, setSelectedId] = useState(
    initialTemplateId ?? templates[0]?.id ?? "",
  )
  const [pending, setPending] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  )
  const selected =
    templates.find((template) => template.id === selectedId) ?? templates[0]
  const confirmingDelete =
    selected !== undefined && confirmingDeleteId === selected.id

  function cancelDelete() {
    if (pending) return
    setConfirmingDeleteId(null)
    focusAfterRender(deleteButtonId)
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      dismissible={false}
      busy={pending}
      // Escape backs out of a pending deletion; the panel itself stays open.
      onEscapeKeyDown={() => {
        if (confirmingDelete) cancelDelete()
      }}
    >
      <SidePanelHeader
        title="Pricing Templates"
        description="Customize reusable pricing or delete an unused template."
        closeLabel="Close pricing templates"
        closeDisabled={pending}
      />
      {selected ? (
        <TemplateEditor
          key={selected.id}
          template={selected}
          selector={
            <div className={fieldClass}>
              <label className={labelClass} htmlFor={selectionId}>
                Pricing Template
              </label>
              <Select
                value={selected.id}
                onValueChange={(id) => {
                  setConfirmingDeleteId(null)
                  setSelectedId(id)
                }}
                disabled={pending}
              >
                <SelectTrigger
                  id={selectionId}
                  className={cn(inputClass, "shadow-none")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          confirmingDelete={confirmingDelete}
          onStartDelete={() => setConfirmingDeleteId(selected.id)}
          onCancelDelete={cancelDelete}
          onSaved={onSaved}
          onDeleted={(id) => {
            setConfirmingDeleteId(null)
            onDeleted(id)
            focusAfterRender(selectionId)
          }}
          onPendingChange={setPending}
        />
      ) : (
        <>
          <SidePanelBody>
            <p className="m-0 py-4 text-center text-sm text-[#738096]">
              No pricing templates yet. Create a reusable template when
              configuring a service&apos;s pricing.
            </p>
          </SidePanelBody>
          <SidePanelFooter>
            <SheetClose asChild>
              <SidePanelButton>Done</SidePanelButton>
            </SheetClose>
          </SidePanelFooter>
        </>
      )}
    </SidePanel>
  )
}
