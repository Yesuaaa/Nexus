"use client"

import { useRef, useState, type FormEvent } from "react"
import { sileo } from "sileo"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
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
import { cn } from "@/lib/utils"
import {
  deletePricingTemplate,
  updatePricingTemplate,
  type PricingTemplate,
} from "../api/services-api"
import { needsAmount, PriceFields } from "./service-price-fields"

const inputClass = `h-10 w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm ${focusRing}`
const buttonClass = `inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-lg border px-4 text-xs font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

function TemplateEditor({
  template,
  onSaved,
  onDeleted,
  onPendingChange,
}: {
  template: PricingTemplate
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState("")
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
        caught instanceof Error
          ? caught.message
          : "Couldn't update the pricing template. Please try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (pending || linkedServices.length > 0) return
    setBusy(true)
    setError("")
    try {
      await deletePricingTemplate(template.id)
      onDeleted(template.id)
      sileo.success({
        title: "Pricing template deleted",
        description: `${template.name} was deleted.`,
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't delete the pricing template. Please try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void save(event)}>
      <fieldset
        disabled={pending}
        className="m-0 grid min-w-0 gap-4 border-0 p-0"
      >
        {error && (
          <p
            className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="grid min-w-0 gap-1.5">
          <label
            className="text-xs font-semibold"
            htmlFor="managed-template-name"
          >
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
        <div className="grid min-w-0 gap-1.5">
          <label
            className="text-xs font-semibold"
            htmlFor="managed-template-currency"
          >
            Currency
          </label>
          <input
            id="managed-template-currency"
            className={inputClass}
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            pattern="[A-Za-z]{3}"
            maxLength={3}
            required
          />
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
        {confirmingDelete ? (
          <div className="grid gap-3 rounded-lg border border-[#f1cbd1] p-3">
            <p className="m-0 text-xs leading-5">
              Permanently delete &ldquo;{template.name}&rdquo;? This cannot be
              undone.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={cn(buttonClass, "border-[#d7e0ee] text-[#24437e]")}
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel deletion
              </button>
              <button
                type="button"
                className={cn(
                  buttonClass,
                  "border-transparent bg-[#bc3649] text-white",
                )}
                onClick={() => void remove()}
              >
                {pending ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-between gap-2 border-t border-[#eceef1] pt-4">
            <button
              type="button"
              disabled={linkedServices.length > 0}
              className={cn(buttonClass, "border-[#f1cbd1] text-[#bc3649]")}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete Template
            </button>
            <button
              type="submit"
              className={cn(
                buttonClass,
                "border-transparent bg-[#203f8c] text-white hover:bg-[#172f70]",
              )}
            >
              {pending ? "Saving..." : "Save Template"}
            </button>
          </div>
        )}
      </fieldset>
    </form>
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
  const opener = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [selectedId, setSelectedId] = useState(
    initialTemplateId ?? templates[0]?.id ?? "",
  )
  const [pending, setPending] = useState(false)
  const selected =
    templates.find((template) => template.id === selectedId) ?? templates[0]
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[120] bg-[rgb(13_28_57_/_48%)]"
        className="z-[120] max-h-[calc(100dvh-28px)] w-[min(560px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0"
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (
            opener.current instanceof HTMLElement &&
            opener.current.isConnected
          )
            opener.current.focus()
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#eceef1] p-5">
          <div>
            <DialogTitle className="m-0 text-lg font-[650]">
              Pricing Templates
            </DialogTitle>
            <DialogDescription className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
              Customize reusable pricing or delete an unused template.
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close pricing templates"
            disabled={pending}
            onClick={onClose}
            className={cn(
              "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#65718a]",
              focusRing,
            )}
          >
            <CloseIcon />
          </button>
        </header>
        <div className="grid min-w-0 gap-4 p-5">
          {selected ? (
            <>
              <div className="grid min-w-0 gap-1.5">
                <label
                  className="text-xs font-semibold"
                  htmlFor="managed-template-selection"
                >
                  Pricing Template
                </label>
                <Select
                  value={selected.id}
                  onValueChange={setSelectedId}
                  disabled={pending}
                >
                  <SelectTrigger
                    id="managed-template-selection"
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
              <TemplateEditor
                key={selected.id}
                template={selected}
                onSaved={onSaved}
                onDeleted={onDeleted}
                onPendingChange={setPending}
              />
            </>
          ) : (
            <p className="m-0 py-4 text-center text-sm text-[#738096]">
              No pricing templates yet. Create a reusable template when
              configuring a service&apos;s pricing.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
