import assert from "node:assert/strict"
import { test } from "node:test"
import { parseMoneyInput } from "../src/features/request-workflow/model/quotation-money.ts"
import {
  formatMoneyInput,
  decimalMoneyValue,
  isMoneyInputPaste,
  moneyInputCaret,
  moneyInputError,
} from "../src/lib/money-input.ts"

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

test("compensation monetary input keeps grouping and the API decimal limit", () => {
  assert.equal(formatMoneyInput("1000000"), "1,000,000")
  assert.equal(moneyInputCaret("25,000.50", 4), 5)
  for (const value of ["25000", "25,000.50", "9,999,999,999.99"])
    assert.equal(isMoneyInputPaste(value), true)
  for (const value of ["1,00", "2e4", "+1", "-1", "25.001", " 25", "$25"])
    assert.equal(isMoneyInputPaste(value), false)
  assert.equal(moneyInputError("9999999999.99", true), "")
  assert.match(moneyInputError("10000000000", true), /limit/)
  assert.match(moneyInputError("25.001", true), /decimal/)
  assert.match(moneyInputError("", true), /required/)
  assert.match(moneyInputError("0.00", true), /greater than zero/)
  assert.equal(moneyInputError("0.00", false), "")
})
