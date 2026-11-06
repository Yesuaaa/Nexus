"use client"

import { Form, validateFields } from "@/components/ui/form"
import { useState } from "react"
import { Check, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { WorkflowControls } from "../hooks/use-request-workflow"
import type { Workflow } from "../model/workflow"
import {
  WorkflowField,
  workflowMoney,
  workflowInput,
} from "./workflow-primitives"
import {
  WorkflowDraftFooter,
  draftSecondaryButton,
  draftPrimaryButton,
} from "./workflow-draft-footer"
import { QuotationMoneyInput } from "./quotation-money-input"
import {
  QuotationDateTimePicker,
  localDateTime,
} from "./quotation-date-time-picker"

export function QuotationForm({
  controls,
  workflow,
  onComplete,
  onCancel,
}: {
  controls: WorkflowControls
  workflow: Workflow
  onComplete?: () => void
  onCancel?: () => void
}) {
  const latest = workflow.quotations.at(-1)
  const [rows, setRows] = useState(() =>
    latest?.lineItems.length
      ? latest.lineItems.map((item, key) => ({ key, ...item }))
      : [{ key: 0, description: "", quantity: 1, unitPrice: "" }],
  )
  const [nextKey, setNextKey] = useState(rows.length)
  const [step, setStep] = useState(0)
  const [review, setReview] = useState<FormData | null>(null)
  const [currency, setCurrency] = useState(latest?.currency || "PHP")
  const [validUntil, setValidUntil] = useState(
    latest ? localDateTime(new Date(latest.validUntil)) : "",
  )
  const [error, setError] = useState("")
  const steps = ["Scope", "Pricing", "Terms", "Review"]
  function validate(form: HTMLFormElement, index: number) {
    setError("")
    const data = new FormData(form)
    const section = form.querySelector(`[data-quotation-step="${index}"]`)
    for (const input of section?.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select") ?? []) {
      input.setCustomValidity(
        input.required && !input.value.trim() ? "Complete this field." : "",
      )
      if (input.name === "deliverables" && input.value.trim()) {
        const items = input.value
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
        if (items.length > 30 || items.some((item) => item.length > 300))
          input.setCustomValidity(
            "Provide up to 30 deliverables, each at most 300 characters.",
          )
      }
      if (
        input instanceof HTMLInputElement &&
        input.dataset.moneyMin !== undefined &&
        input.value
      ) {
        const amount = Number(input.value.replace(/,/g, ""))
        if (amount < Number(input.dataset.moneyMin) || amount > 999999999)
          input.setCustomValidity(
            `Enter an amount between ${input.dataset.moneyMin} and 999,999,999.00.`,
          )
      }
      if (input.name === "paymentDueDisplay" && input.value) {
        const total = rows.reduce(
          (sum, { key }) =>
            sum +
            Math.round(Number(data.get(`price-${key}`)) * 100) *
              Number(data.get(`quantity-${key}`)),
          0,
        )
        if (Math.round(Number(data.get("paymentDue")) * 100) > total)
          input.setCustomValidity(
            "The commencement payment cannot exceed the quotation total.",
          )
      }
      if (!validateFields([input])) return false
    }
    if (index === 2) {
      const validity = new Date(validUntil).getTime()
      if (
        !Number.isFinite(validity) ||
        validity <= Date.now() ||
        validity > Date.now() + 366 * 86_400_000
      ) {
        setError("Choose a future validity date and time within the next year.")
        form
          .querySelector<HTMLButtonElement>("[data-quotation-validity] button")
          ?.focus()
        return false
      }
    }
    return true
  }
  return (
    <Form
      className="@container space-y-3 [&_label]:grid-cols-[minmax(0,1fr)] [&_label]:[overflow-wrap:anywhere]"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault()
        const form = event.currentTarget
        if (controls.busy) return
        if (step < 3) {
          if (validate(form, step)) {
            setReview(new FormData(form))
            setStep(step + 1)
          }
          return
        }
        const data = new FormData(form)
        if (
          await controls.act({
            type: "CREATE_QUOTATION",
            scope: String(data.get("scope")),
            deliverables: String(data.get("deliverables"))
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            lineItems: rows.map(({ key }) => ({
              description: String(data.get(`description-${key}`)),
              quantity: Number(data.get(`quantity-${key}`)),
              unitPrice: String(data.get(`price-${key}`)),
            })),
            currency: String(data.get("currency")),
            timeline: String(data.get("timeline")),
            paymentTerms: String(data.get("paymentTerms")),
            paymentDue: String(data.get("paymentDue")),
            validUntil: new Date(String(data.get("validUntil"))).toISOString(),
          })
        )
          onComplete?.()
      }}
    >
      <div className="flex flex-col gap-3">
        <ol
          aria-label="Quotation steps"
          className="m-0 grid list-none grid-cols-4 gap-2 p-0"
        >
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold @[260px]:flex-row @[260px]:gap-1.5",
                index <= step ? "text-[#203f8c]" : "text-[#52627a]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[10px]",
                  index <= step
                    ? "bg-[#edf2fb] text-[#203f8c]"
                    : "bg-[#f5f7fa] text-[#8791a2]",
                )}
              >
                {index < step ? <Check size={12} /> : index + 1}
              </span>
              <span>{label}</span>
              <span className="sr-only">
                {index < step
                  ? " completed"
                  : index === step
                    ? " current step"
                    : " upcoming"}
              </span>
            </li>
          ))}
        </ol>
        <div
          role="progressbar"
          aria-label="Quotation progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}
          className="h-1.5 overflow-hidden rounded-full bg-[#e8edf5]"
        >
          <div
            className="h-full rounded-full bg-[#203f8c] transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="space-y-3">
        <header className="space-y-1 pt-3">
          <p className="m-0 text-[10px] font-medium text-[#52627a]">
            Step {step + 1} of {steps.length}
          </p>
          <h3 className="m-0 text-xs font-semibold text-[#182235]">
            {
              [
                "Define the scope",
                "Set the pricing",
                "Add timeline and payment terms",
                "Review quotation",
              ][step]
            }
          </h3>
          <p className="m-0 text-[11px] leading-5 text-[#52627a]">
            {
              [
                "Describe the work and what the client will receive.",
                "List each item with its quantity and unit price.",
                "Confirm delivery, payment and quotation validity.",
                "Check the details before sending to the client.",
              ][step]
            }
          </p>
        </header>
        <div data-quotation-step="0" hidden={step !== 0} className="space-y-3">
          <WorkflowField label="Service scope">
            <textarea
              name="scope"
              required
              rows={3}
              maxLength={6000}
              defaultValue={latest?.scope || workflow.request.goals}
              className={workflowInput}
              placeholder="Describe the work covered by this quotation."
            />
          </WorkflowField>
          <WorkflowField label="Deliverables (one per line)">
            <textarea
              name="deliverables"
              required
              rows={3}
              maxLength={8000}
              defaultValue={latest?.deliverables.join("\n") || ""}
              className={workflowInput}
              placeholder="List the outputs the client will receive, one per line."
            />
          </WorkflowField>
        </div>
        <div data-quotation-step="1" hidden={step !== 1} className="space-y-3">
          <WorkflowField label="Currency" asGroup>
            <Select
              name="currency"
              value={currency}
              onValueChange={setCurrency}
            >
              <SelectTrigger
                aria-label="Currency"
                className={cn(workflowInput, "h-[38px] shadow-none")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[160]">
                <SelectItem value="PHP">PHP · Philippine Peso</SelectItem>
                <SelectItem value="USD">USD · US Dollar</SelectItem>
                <SelectItem value="EUR">EUR · Euro</SelectItem>
                <SelectItem value="GBP">GBP · British Pound</SelectItem>
                {latest &&
                  !["PHP", "USD", "EUR", "GBP"].includes(latest.currency) && (
                    <SelectItem value={latest.currency}>
                      {latest.currency}
                    </SelectItem>
                  )}
              </SelectContent>
            </Select>
          </WorkflowField>
          <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
            <legend className="mb-2 text-[11px] font-medium">
              Pricing breakdown
            </legend>
            {rows.map(({ key }, index) => (
              <div
                key={key}
                className="space-y-3 rounded-lg border border-[#d8e1ef] bg-[#f6f8fc] p-3"
              >
                <WorkflowField label={`Item ${index + 1}`}>
                  <input
                    name={`description-${key}`}
                    defaultValue={rows[index].description}
                    required
                    maxLength={300}
                    className={workflowInput}
                    placeholder="e.g. Design and development"
                  />
                </WorkflowField>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end gap-3">
                  <WorkflowField label="Quantity">
                    <input
                      name={`quantity-${key}`}
                      type="number"
                      required
                      min="1"
                      max="10000"
                      step="1"
                      defaultValue={rows[index].quantity}
                      className={workflowInput}
                    />
                  </WorkflowField>
                  <WorkflowField label="Unit price">
                    <QuotationMoneyInput
                      name={`price-${key}`}
                      label="Unit price"
                      defaultValue={rows[index].unitPrice}
                      currency={currency}
                    />
                  </WorkflowField>
                </div>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Remove item ${index + 1}`}
                    className="h-8 gap-1.5 border-0 bg-transparent px-0 text-[11px] text-[#738096] shadow-none hover:bg-transparent hover:text-[#b42318]"
                    onClick={() =>
                      setRows((items) =>
                        items.filter((item) => item.key !== key),
                      )
                    }
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className={draftSecondaryButton}
              disabled={rows.length >= 30}
              onClick={() => {
                setRows((items) => [
                  ...items,
                  { key: nextKey, description: "", quantity: 1, unitPrice: "" },
                ])
                setNextKey((value) => value + 1)
              }}
            >
              <Plus size={12} aria-hidden="true" />
              Add item
            </Button>
          </fieldset>
        </div>
        <div data-quotation-step="2" hidden={step !== 2} className="space-y-3">
          <WorkflowField label="Estimated timeline">
            <textarea
              name="timeline"
              required
              maxLength={1000}
              rows={2}
              defaultValue={
                latest?.timeline || workflow.request.expectedTimeline
              }
              className={workflowInput}
            />
          </WorkflowField>
          <WorkflowField label="Payment terms">
            <textarea
              name="paymentTerms"
              required
              maxLength={2000}
              rows={2}
              defaultValue={latest?.paymentTerms || ""}
              className={workflowInput}
            />
          </WorkflowField>
          <div
            className="grid grid-cols-2 items-end gap-3"
            data-quotation-terms-row
          >
            <WorkflowField label="Amount due before commencement">
              <QuotationMoneyInput
                name="paymentDue"
                label="Amount due before commencement"
                currency={currency}
                min={workflow.paymentRequired ? 0.01 : 0}
                defaultValue={latest?.paymentDue}
              />
            </WorkflowField>
            <WorkflowField label="Valid until" asGroup>
              <QuotationDateTimePicker
                value={validUntil}
                onChange={(value) => {
                  setValidUntil(value)
                  setError("")
                }}
              />
            </WorkflowField>
          </div>
        </div>
        {step === 3 && review && (
          <section
            aria-label="Quotation review"
            className="space-y-3 text-xs text-[#182235]"
          >
            <p className="whitespace-pre-wrap">
              <strong>Scope</strong>
              <br />
              {String(review.get("scope"))}
            </p>
            <p className="whitespace-pre-wrap">
              <strong>Deliverables</strong>
              <br />
              {String(review.get("deliverables"))}
            </p>
            <ul className="space-y-2 pl-4">
              {rows.map(({ key }) => (
                <li key={key}>
                  {String(review.get(`description-${key}`))} ·{" "}
                  {String(review.get(`quantity-${key}`))} ×{" "}
                  {workflowMoney(
                    String(review.get(`price-${key}`)),
                    String(review.get("currency")),
                  )}
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#edf2fb] px-3 py-2.5 text-sm font-semibold text-[#203f8c]">
              <strong>Total: </strong>
              {workflowMoney(
                String(
                  rows.reduce(
                    (total, { key }) =>
                      total +
                      Number(review.get(`quantity-${key}`)) *
                        Number(review.get(`price-${key}`)),
                    0,
                  ),
                ),
                String(review.get("currency")),
              )}
            </p>
            <p className="whitespace-pre-wrap">
              <strong>Timeline</strong>
              <br />
              {String(review.get("timeline"))}
            </p>
            <p className="whitespace-pre-wrap">
              <strong>Payment terms</strong>
              <br />
              {String(review.get("paymentTerms"))}
            </p>
            <p>
              Due before commencement:{" "}
              {workflowMoney(
                String(review.get("paymentDue")),
                String(review.get("currency")),
              )}
            </p>
            <p>
              Valid until: {String(review.get("validUntil")).replace("T", " ")}
            </p>
          </section>
        )}
        {workflow.quotationApprovalRequired && (
          <p className="mt-5 mb-0 rounded-lg bg-[#edf2fb] p-3 text-xs leading-5 text-[#52627a]">
            The assigned quotation approver must authorize this version before
            the client can accept it.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 mb-0 text-xs text-[#b42318]">
            {error}
          </p>
        )}
      </div>
      <WorkflowDraftFooter sticky>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={controls.busy}
            onClick={onCancel}
            className={draftSecondaryButton}
          >
            Cancel
          </Button>
        )}
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={controls.busy}
            onClick={() => setStep(step - 1)}
            className={draftSecondaryButton}
          >
            Back
          </Button>
        )}
        <Button className={draftPrimaryButton} disabled={controls.busy}>
          {controls.busy
            ? "Saving…"
            : step < 2
              ? "Next"
              : step === 2
                ? "Review"
                : latest
                  ? "Send revised quotation"
                  : "Send quotation"}
        </Button>
      </WorkflowDraftFooter>
    </Form>
  )
}
