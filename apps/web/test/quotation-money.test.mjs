import assert from "node:assert/strict"
import { test } from "node:test"
import {
  parseMoneyInput,
  formatMoneyInput,
  decimalMoneyValue,
} from "../src/features/request-workflow/model/quotation-money.ts"

test("quotation amounts preserve editable decimals and produce API decimal strings", () => {
  for (const [input, raw, display, decimal] of [
    ["", "", "", ""],
    [".", "0.", "0.", "0.00"],
    ["001234.5", "1234.5", "1,234.5", "1234.50"],
    ["₱ 1,234,567.89", "1234567.89", "1,234,567.89", "1234567.89"],
    ["0.01", "0.01", "0.01", "0.01"],
    ["25000.", "25000.", "25,000.", "25000.00"],
  ]) {
    assert.equal(parseMoneyInput(input), raw)
    assert.equal(formatMoneyInput(raw), display)
    assert.equal(decimalMoneyValue(raw), decimal)
  }
})

test("quotation amounts reject negative, exponential, oversized and overprecision input", () => {
  for (const input of [
    "-1",
    "1e3",
    "12.345",
    "1.2.3",
    "12345678901",
    "Infinity",
    "letters",
  ])
    assert.equal(parseMoneyInput(input), null)
})
