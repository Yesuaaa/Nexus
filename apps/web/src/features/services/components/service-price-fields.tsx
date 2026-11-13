"use client"

import { FormInput } from "@/components/ui/form-input"

import { focusRing } from "@/components/layout/styles"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { BillingInterval, PricingModel } from "../api/services-api"

const inputClass = `w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm text-foreground ${focusRing}`
const pricingModels: { value: PricingModel; label: string }[] = [
  { value: "FIXED", label: "Fixed Price" },
  { value: "STARTING", label: "Starting Price" },
  { value: "CUSTOM_QUOTE", label: "Custom Quotation" },
  { value: "RECURRING", label: "Recurring" },
  { value: "HOURLY", label: "Hourly Rate" },
]
const billingIntervals: { value: BillingInterval; label: string }[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
]

export function needsAmount(model: PricingModel) {
  return model !== "CUSTOM_QUOTE"
}

export function PriceFields({
  model,
  amount,
  billingInterval,
  onModelChange,
  onAmountChange,
  onBillingIntervalChange,
  idPrefix,
  currency = "PHP",
}: {
  model: PricingModel
  amount: string
  billingInterval: BillingInterval | null
  onModelChange: (model: PricingModel) => void
  onAmountChange: (amount: string) => void
  onBillingIntervalChange: (interval: BillingInterval | null) => void
  idPrefix: string
  currency?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
      <div className="grid min-w-0 gap-1.5">
        <label className="text-xs font-semibold" htmlFor={`${idPrefix}-model`}>
          Pricing Model
        </label>
        <Select
          value={model}
          onValueChange={(value) => onModelChange(value as PricingModel)}
        >
          <SelectTrigger
            id={`${idPrefix}-model`}
            className={cn(inputClass, "h-10 shadow-none")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pricingModels.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {needsAmount(model) && (
        <div className="grid min-w-0 gap-1.5">
          <label
            className="text-xs font-semibold"
            htmlFor={`${idPrefix}-amount`}
          >
            {model === "HOURLY" ? "Hourly Rate" : "Amount"} ({currency})
          </label>
          <FormInput
            id={`${idPrefix}-amount`}
            type="number"
            min="0.01"
            max="99999999999.99"
            step="0.01"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      )}
      {model === "RECURRING" && (
        <div className="grid min-w-0 gap-1.5">
          <label
            className="text-xs font-semibold"
            htmlFor={`${idPrefix}-interval`}
          >
            Billing Interval
          </label>
          <Select
            value={billingInterval ?? ""}
            onValueChange={(value) =>
              onBillingIntervalChange(value as BillingInterval)
            }
          >
            <SelectTrigger
              id={`${idPrefix}-interval`}
              className={cn(inputClass, "h-10 shadow-none")}
            >
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              {billingIntervals.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
