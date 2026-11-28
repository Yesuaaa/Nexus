import assert from "node:assert/strict"
import { test } from "node:test"
import {
  parseInquiryService,
  withInquiryService,
} from "../src/features/public-services/model/service-inquiry-link.ts"

test("PG-027-F005-A001-T005 bounds and encodes one service context", async (t) => {
  const fixtures = [
    [undefined, undefined],
    [null, undefined],
    [[], undefined],
    [["a", "b"], undefined],
    [42, undefined],
    [{}, undefined],
    ["", undefined],
    ["a", "a"],
    ["a".repeat(80), "a".repeat(80)],
    ["a".repeat(81), undefined],
    [" a", undefined],
    ["a/b", undefined],
    ["A_0-z", "A_0-z"],
  ]
  for (const [input, expected] of fixtures) {
    const parsed = parseInquiryService(input)
    const url = new URL(
      withInquiryService("/services", parsed),
      "http://127.0.0.1",
    )
    assert.equal(parsed, expected)
    assert.equal(url.pathname, "/services")
    assert.deepEqual(
      [...url.searchParams],
      expected === undefined ? [] : [["service", expected]],
    )
  }
  t.diagnostic("13 input iterations")
})
