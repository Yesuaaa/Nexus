import { randomUUID } from "node:crypto"

export type ProjectTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE"

export type ProjectWorkPlan = {
  phases: {
    id: string
    title: string
    tasks: {
      id: string
      title: string
      role: string
      status: ProjectTaskStatus
    }[]
  }[]
}

type TemplateDefinition = {
  key: string
  name: string
  type: string
  description: string
  recommendedFor: string[]
  phases: { title: string; tasks: { title: string; role: string }[] }[]
}

export const projectTemplates: TemplateDefinition[] = [
  {
    key: "website-development",
    name: "Website Development",
    type: "One-time",
    description: "Discovery to launch for a new site or refresh.",
    recommendedFor: ["website", "web development"],
    phases: [
      {
        title: "Discovery",
        tasks: [
          { title: "Confirm goals and audience", role: "Project lead" },
          { title: "Approve sitemap and scope", role: "UX designer" },
        ],
      },
      {
        title: "Design",
        tasks: [
          { title: "Prepare page wireframes", role: "UX designer" },
          { title: "Approve visual direction", role: "Design lead" },
        ],
      },
      {
        title: "Build",
        tasks: [
          { title: "Develop approved pages", role: "Developer" },
          { title: "Review content and accessibility", role: "Project team" },
        ],
      },
      {
        title: "Launch",
        tasks: [
          { title: "Complete launch checklist", role: "Developer" },
          { title: "Hand over site access", role: "Project lead" },
        ],
      },
    ],
  },
  {
    key: "social-media-management",
    name: "Social Media Management",
    type: "Recurring",
    description: "Ongoing planning, content and reporting.",
    recommendedFor: ["social media", "content management"],
    phases: [
      {
        title: "Planning",
        tasks: [
          { title: "Set monthly content goals", role: "Strategist" },
          { title: "Build the content calendar", role: "Content lead" },
        ],
      },
      {
        title: "Production",
        tasks: [
          { title: "Draft posts and captions", role: "Content creator" },
          { title: "Prepare creative assets", role: "Designer" },
        ],
      },
      {
        title: "Publishing",
        tasks: [
          {
            title: "Review and schedule approved posts",
            role: "Social media specialist",
          },
        ],
      },
      {
        title: "Reporting",
        tasks: [
          { title: "Review engagement and reach", role: "Analyst" },
          { title: "Share monthly recommendations", role: "Strategist" },
        ],
      },
    ],
  },
  {
    key: "paid-ads-campaign",
    name: "Paid Ads Campaign",
    type: "Campaign",
    description: "Plan, launch and optimize paid advertising.",
    recommendedFor: ["ads", "advertising", "paid media"],
    phases: [
      {
        title: "Plan",
        tasks: [
          { title: "Confirm audience and budget", role: "Media strategist" },
          { title: "Approve campaign structure", role: "Project lead" },
        ],
      },
      {
        title: "Prepare",
        tasks: [
          { title: "Write ad variations", role: "Copywriter" },
          { title: "Prepare campaign assets", role: "Designer" },
        ],
      },
      {
        title: "Launch",
        tasks: [
          { title: "Configure tracking and targeting", role: "Media buyer" },
          { title: "Review launch readiness", role: "Project lead" },
        ],
      },
      {
        title: "Optimize",
        tasks: [
          { title: "Review campaign performance", role: "Analyst" },
          { title: "Apply approved optimizations", role: "Media buyer" },
        ],
      },
    ],
  },
  {
    key: "seo-campaign",
    name: "SEO Campaign",
    type: "Recurring",
    description: "Audit, on-page, off-page and monitoring.",
    recommendedFor: ["seo", "search engine optimization"],
    phases: [
      {
        title: "Audit",
        tasks: [
          { title: "Review technical health", role: "SEO specialist" },
          { title: "Capture baseline rankings", role: "Analyst" },
        ],
      },
      {
        title: "Optimize",
        tasks: [
          { title: "Map keywords to pages", role: "SEO specialist" },
          {
            title: "Prepare on-page recommendations",
            role: "Content strategist",
          },
        ],
      },
      {
        title: "Publish",
        tasks: [{ title: "Apply approved page updates", role: "Content team" }],
      },
      {
        title: "Monitor",
        tasks: [
          { title: "Review organic traffic and rankings", role: "Analyst" },
          { title: "Share next-month priorities", role: "SEO specialist" },
        ],
      },
    ],
  },
  {
    key: "graphic-design",
    name: "Graphic Design",
    type: "One-time",
    description: "Briefs, concepts, revisions and delivery.",
    recommendedFor: ["graphic design", "design", "branding"],
    phases: [
      {
        title: "Brief",
        tasks: [
          { title: "Confirm format and usage", role: "Project lead" },
          { title: "Collect brand assets", role: "Designer" },
        ],
      },
      {
        title: "Concepts",
        tasks: [
          { title: "Prepare initial concepts", role: "Designer" },
          { title: "Review selected direction", role: "Project lead" },
        ],
      },
      {
        title: "Revisions",
        tasks: [
          { title: "Apply consolidated feedback", role: "Designer" },
          { title: "Approve final artwork", role: "Client contact" },
        ],
      },
      {
        title: "Delivery",
        tasks: [
          { title: "Export requested formats", role: "Designer" },
          { title: "Share final files", role: "Project lead" },
        ],
      },
    ],
  },
  {
    key: "blank-custom",
    name: "Blank / Custom Project",
    type: "Custom",
    description: "Start with empty phases and add the work as you plan it.",
    recommendedFor: [],
    phases: [
      { title: "Planning", tasks: [] },
      { title: "In progress", tasks: [] },
      { title: "Review & delivery", tasks: [] },
    ],
  },
]

export function makeWorkPlan(templateKey: string): ProjectWorkPlan {
  const template = projectTemplates.find((item) => item.key === templateKey)
  if (!template) throw new Error("Choose a project template.")
  return {
    phases: template.phases.map((phase) => ({
      id: randomUUID(),
      title: phase.title,
      tasks: phase.tasks.map((task) => ({
        id: randomUUID(),
        ...task,
        status: "NOT_STARTED",
      })),
    })),
  }
}

export function readWorkPlan(value: unknown): ProjectWorkPlan | null {
  if (!value || typeof value !== "object" || !("phases" in value)) return null
  const phases = value.phases
  if (!Array.isArray(phases)) return null
  for (const phase of phases) {
    if (
      !phase ||
      typeof phase !== "object" ||
      typeof phase.id !== "string" ||
      typeof phase.title !== "string" ||
      !Array.isArray(phase.tasks)
    )
      return null
    for (const task of phase.tasks) {
      if (
        !task ||
        typeof task !== "object" ||
        typeof task.id !== "string" ||
        typeof task.title !== "string" ||
        typeof task.role !== "string" ||
        !["NOT_STARTED", "IN_PROGRESS", "DONE"].includes(task.status)
      )
        return null
    }
  }
  return value as ProjectWorkPlan
}
