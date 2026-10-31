import assert from "node:assert/strict"
import { test } from "node:test"
import {
  readServiceDraft,
  writeServiceDraft,
  clearServiceDraft,
} from "../src/features/services/model/service-draft.ts"

test("service drafts survive reload and stay scoped to their account", () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  const draft = {
    serviceId: "service",
    packageId: "package",
    step: 3,
    requirements: {
      goals: "More inquiries",
      requirements: "A website",
      expectedTimeline: "Flexible",
      additionalDetails: "",
    },
    specialistId: null,
    submissionKey: null,
  }
  assert.equal(writeServiceDraft(storage, "account-a", draft), true)
  assert.deepEqual(readServiceDraft(storage, "account-a"), draft)
  assert.equal(readServiceDraft(storage, "account-b"), null)
  clearServiceDraft(storage, "account-a")
  assert.equal(readServiceDraft(storage, "account-a"), null)
})

test("malformed drafts and unavailable storage are handled without losing the form", () => {
  const malformed = { getItem: () => '{"step":4}', removeItem: () => {} }
  assert.equal(readServiceDraft(malformed, "account"), null)
  const blocked = {
    getItem: () => {
      throw new Error("Blocked")
    },
    setItem: () => {
      throw new Error("Full")
    },
    removeItem: () => {
      throw new Error("Blocked")
    },
  }
  assert.equal(readServiceDraft(blocked, "account"), null)
  assert.equal(writeServiceDraft(blocked, "account", {}), false)
  assert.doesNotThrow(() => clearServiceDraft(blocked, "account"))
})
