export type ProjectRequirementsDraft = {
  goals: string
  requirements: string
  expectedTimeline: string
  additionalDetails: string
}

export const projectRequirementsLimits: Record<
  keyof ProjectRequirementsDraft,
  number
> = {
  goals: 2000,
  requirements: 5000,
  expectedTimeline: 300,
  additionalDetails: 5000,
}

export function createProjectRequirementsDraft(): ProjectRequirementsDraft {
  return {
    goals: "",
    requirements: "",
    expectedTimeline: "",
    additionalDetails: "",
  }
}

export function validateProjectRequirements(draft: ProjectRequirementsDraft) {
  const errors: Partial<Record<keyof ProjectRequirementsDraft, string>> = {}
  if (!draft.goals.trim()) errors.goals = "Describe your project goals."
  if (!draft.requirements.trim())
    errors.requirements = "Describe what you need for this project."
  if (!draft.expectedTimeline.trim())
    errors.expectedTimeline =
      "Enter your expected timeline, or let us know if it is flexible."

  for (const field of Object.keys(
    projectRequirementsLimits,
  ) as (keyof ProjectRequirementsDraft)[]) {
    if (draft[field].length > projectRequirementsLimits[field]) {
      errors[field] =
        `Use ${projectRequirementsLimits[field].toLocaleString("en")} characters or fewer.`
    }
  }
  return errors
}
