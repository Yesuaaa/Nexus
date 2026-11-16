import assert from "node:assert/strict"
import test from "node:test"
import { kpiSegmentGradient } from "../src/components/ui/kpi-chart-utils.ts"

test("KPI segment gradient reflects positive category shares", () => {
  assert.equal(
    kpiSegmentGradient([
      { label: "One", value: 1, color: "#f00" },
      { label: "Empty", value: 0, color: "#0f0" },
      { label: "Three", value: 3, color: "#00f" },
    ]),
    "conic-gradient(#f00 0% 25%, #00f 25% 100%)",
  )
})

test("KPI segment gradient uses the existing empty-chart color", () => {
  assert.equal(kpiSegmentGradient([]), "#e3e9ef")
})
