import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createProjectRequirementsDraft,
  projectRequirementsLimits,
  validateProjectRequirements,
} from "../src/features/services/model/project-requirements.ts"

const validDraft = {
  goals: "Increase brand awareness and generate qualified leads.",
  requirements:
    "A monthly calendar, 12 social posts, and performance reporting.",
  expectedTimeline: "Flexible; ideally launch within 6 weeks.",
  additionalDetails: "",
}

test("project requirements require goals, scope, and a timeline", () => {
  assert.deepEqual(
    validateProjectRequirements(createProjectRequirementsDraft()),
    {
      goals: "Describe your project goals.",
      requirements: "Describe what you need for this project.",
      expectedTimeline:
        "Enter your expected timeline, or let us know if it is flexible.",
    },
  )
  assert.deepEqual(
    validateProjectRequirements({
      ...validDraft,
      goals: " \n ",
      requirements: "\t",
      expectedTimeline: " ",
    }),
    validateProjectRequirements(createProjectRequirementsDraft()),
  )
})

test("project requirements allow flexible timelines and optional additional details", () => {
  assert.deepEqual(validateProjectRequirements(validDraft), {})
  assert.deepEqual(
    validateProjectRequirements({
      ...validDraft,
      expectedTimeline: "Flexible",
    }),
    {},
  )
})

test("project requirements validate each field limit", () => {
  for (const [field, limit] of Object.entries(projectRequirementsLimits)) {
    assert.deepEqual(
      validateProjectRequirements({
        ...validDraft,
        [field]: "x".repeat(limit),
      }),
      {},
    )
    assert.deepEqual(
      validateProjectRequirements({
        ...validDraft,
        [field]: "x".repeat(limit + 1),
      }),
      { [field]: `Use ${limit.toLocaleString("en")} characters or fewer.` },
    )
  }
})
