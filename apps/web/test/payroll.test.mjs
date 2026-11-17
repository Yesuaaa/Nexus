import assert from "node:assert/strict"
import { test } from "node:test"
import { formatPayrollMoney } from "../src/features/payroll/model/money.ts"

test("Payroll formats exact PHP decimal strings without floating-point rounding", () => {
  assert.equal(formatPayrollMoney("72500.10"), "₱72,500.10")
  assert.equal(formatPayrollMoney("9999999999.99"), "₱9,999,999,999.99")
  assert.equal(formatPayrollMoney("0.01"), "₱0.01")
  assert.equal(formatPayrollMoney("72500.105"), "—")
  assert.equal(formatPayrollMoney("1e5"), "—")
})
