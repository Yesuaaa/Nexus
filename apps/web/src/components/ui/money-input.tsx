"use client"

import { useLayoutEffect, useRef } from "react"
import { FormInput } from "@/components/ui/form-input"
import {
  decimalMoneyValue,
  formatMoneyInput,
  isMoneyInputPaste,
  moneyInputCaret,
  moneyInputError,
} from "@/lib/money-input"

export function MoneyInput({
  id,
  value,
  onValueChange,
  requirePositive = false,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  requirePositive?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const formatted = formatMoneyInput(value)
  useLayoutEffect(() => {
    ref.current?.setCustomValidity(moneyInputError(value, requirePositive))
  }, [value, requirePositive])

  function report(input: HTMLInputElement, message: string) {
    input.setCustomValidity(message)
    input.checkValidity()
  }

  return (
    <FormInput
      ref={ref}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="tabular-nums"
      required
      value={formatted}
      onPaste={(event) => {
        const clipboard = event.clipboardData.getData("text")
        if (isMoneyInputPaste(clipboard)) return
        event.preventDefault()
        report(
          event.currentTarget,
          "Paste a valid amount with up to 2 decimal places.",
        )
      }}
      onChange={(event) => {
        const input = event.currentTarget
        const edit = event.nativeEvent as InputEvent
        const position = input.selectionStart ?? input.value.length
        let characters = input.value
          .slice(0, position)
          .replaceAll(",", "").length
        let raw = input.value.replaceAll(",", "")

        // Deleting a grouping comma edits the adjacent digit in that direction.
        if (raw === value && input.value !== formatted) {
          const removed =
            edit.inputType === "deleteContentBackward"
              ? characters - 1
              : characters
          if (
            removed >= 0 &&
            (edit.inputType === "deleteContentBackward" ||
              edit.inputType === "deleteContentForward")
          ) {
            raw = raw.slice(0, removed) + raw.slice(removed + 1)
            characters = removed
          }
        }

        const next = raw.replace(/^0+(?=\d)/, "").replace(/^\./, "0.")
        const validSyntax = /^\d*(?:\.\d{0,2})?$/.test(next)
        const invalidCommas =
          edit.data?.includes(",") && !isMoneyInputPaste(edit.data)
        const error = moneyInputError(next, requirePositive)
        if (!validSyntax || invalidCommas || next.split(".")[0].length > 10) {
          input.value = formatted
          const caret = Math.max(0, position - (edit.data?.length ?? 0))
          input.setSelectionRange(caret, caret)
          report(input, invalidCommas ? "Enter a valid amount." : error)
          return
        }

        input.setCustomValidity(error)
        onValueChange(next)
        const display = formatMoneyInput(next)
        const caret = moneyInputCaret(
          display,
          Math.max(0, characters + next.length - raw.length),
        )
        input.value = display
        input.setSelectionRange(caret, caret)
      }}
      onBlur={(event) => {
        if (event.currentTarget.checkValidity())
          onValueChange(decimalMoneyValue(value))
      }}
    />
  )
}
