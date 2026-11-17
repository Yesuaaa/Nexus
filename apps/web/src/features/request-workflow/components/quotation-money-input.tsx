"use client"

import { FormInput } from "@/components/ui/form-input"

import { useState } from "react"
import {
  decimalMoneyValue,
  formatMoneyInput,
  parseMoneyInput,
} from "../model/quotation-money"

export function QuotationMoneyInput({
  name,
  label,
  currency,
  defaultValue = "",
  min = 0,
}: {
  name: string
  label: string
  currency: string
  defaultValue?: string
  min?: number
}) {
  const [raw, setRaw] = useState(defaultValue)
  return (
    <span className="relative flex min-w-0 items-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 hidden text-[11px] font-semibold text-[#738096] @[260px]:block"
      >
        {currency}
      </span>
      <input type="hidden" name={name} value={decimalMoneyValue(raw)} />
      <FormInput
        name={`${name}Display`}
        aria-label={label}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required
        data-money-min={min}
        placeholder="0.00"
        value={formatMoneyInput(raw)}
        className="tabular-nums @[260px]:pl-12"
        onChange={(event) => {
          const input = event.currentTarget
          const next = parseMoneyInput(input.value)
          if (next === null) return
          const position = input.selectionStart ?? input.value.length
          const characters = input.value
            .slice(0, position)
            .replace(/,/g, "").length
          const formatted = formatMoneyInput(next)
          let caret = 0
          let count = 0
          while (caret < formatted.length && count < characters) {
            if (formatted[caret] !== ",") count++
            caret++
          }
          input.setCustomValidity("")
          setRaw(next)
          requestAnimationFrame(() => {
            if (document.activeElement === input)
              input.setSelectionRange(caret, caret)
          })
        }}
        onBlur={() => {
          if (raw) setRaw(decimalMoneyValue(raw))
        }}
      />
    </span>
  )
}
