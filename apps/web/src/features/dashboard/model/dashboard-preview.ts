// Illustrative records for the Phase 1 dashboard preview.
export const projects = [
  {
    name: "Harbor & Pine website refresh",
    service: "Website Design",
    status: "IN_PROGRESS",
    lead: "Maria Santos",
    team: ["Maria Santos", "Jamie Lim", "Sam Cruz"],
    completedTasks: 13,
    taskCount: 19,
  },
  {
    name: "Northline product launch",
    service: "Campaign Strategy",
    status: "IN_PROGRESS",
    lead: "Daniel Reyes",
    team: ["Daniel Reyes", "Ari Cruz"],
    completedTasks: 2,
    taskCount: 6,
  },
] as const

export const actions = [
  {
    reference: "REQ-1048",
    service: "Brand Identity Design",
    title: "Review your quotation",
    reason: "Your approval is needed to move forward.",
    state: "CLIENT_APPROVAL",
  },
  {
    reference: "REQ-1056",
    service: "Social Media Strategy",
    title: "Provide the requested information",
    reason: "Your team needs a few details to continue.",
    state: "AWAITING_CLIENT_INFO",
  },
] as const

export const requests = [
  {
    reference: "REQ-1063",
    service: "Search Engine Optimization",
    status: "SUBMITTED",
    date: "2026-11-20",
  },
  {
    reference: "REQ-1065",
    service: "Website Design & Development",
    status: "ACTIVATED",
    date: "2026-11-19",
  },
] as const

export const updates = [
  {
    kind: "plan",
    title: "Project plan shared",
    context: "Northline product launch",
    date: "2026-11-20",
  },
  {
    kind: "calendar",
    title: "Consultation scheduled",
    context: "Harbor & Pine website refresh",
    date: "2026-11-19",
  },
  {
    kind: "milestone",
    title: "Milestone completed",
    context: "Northline product launch",
    date: "2026-11-18",
  },
] as const

export const appointment = {
  title: "Website design consultation",
  project: "Harbor & Pine website refresh",
  location: "Online",
}

export const previewStates = ["loaded", "empty", "loading", "error"] as const
export type PreviewState = (typeof previewStates)[number]
