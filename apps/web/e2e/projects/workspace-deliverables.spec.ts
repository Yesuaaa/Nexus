import { expect, test } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"
import type { ProjectWorkspaceDetail } from "../../src/features/project-workspace/api/project-workspace-api"
import type {
  ProjectDeliverable,
  ProjectWorkspace,
} from "../../src/features/projects/api/projects-api"

configureRegressionTest()

type Actor = "STAFF" | "HEAD" | "USER"
type DeliveryStatus =
  "NOT_SUBMITTED" | "IN_REVIEW" | "REJECTED" | "APPROVED" | "SENT_TO_CLIENT"

const timestamp = "2026-11-10T08:00:00.000Z"

test("[NEX-009] assigned staff upload and department head review deliverables before client sharing", async ({
  page,
}) => {
  await restoreSession(page, "STAFF", { account: { id: "nex009-staff" } })

  let actor: Actor = "STAFF"
  let deliveryStatus: DeliveryStatus = "NOT_SUBMITTED"
  let rejectionReason: string | null = null
  let fileName: string | null = null
  let uploadedFileCount = 0
  const rejectionReasons: string[] = []

  function deliverable() {
    return {
      id: "deliverable-1",
      title: "Brand guide",
      description: "Final brand direction for client review.",
      expectedFileType: "Plain text",
      deliveryStatus,
      rejectionReason,
      reviewedAt:
        deliveryStatus === "REJECTED" || deliveryStatus === "APPROVED"
          ? timestamp
          : null,
      sentToClientAt: deliveryStatus === "SENT_TO_CLIENT" ? timestamp : null,
      workflowFileId: fileName ? "file-1" : null,
      updatedAt: timestamp,
      completedAt: null,
      workflowFile: fileName
        ? {
            id: "file-1",
            name: fileName,
            mimeType: "text/plain",
            size: 16,
            uploaderId: "nex009-staff",
            createdAt: timestamp,
            clientVisible: deliveryStatus === "SENT_TO_CLIENT",
          }
        : null,
    }
  }

  function workspace(): ProjectWorkspaceDetail {
    const isHead = actor === "HEAD"
    return {
      id: "workspace-1",
      name: "Website launch",
      structure: "SEPARATE",
      status: "IN_PROGRESS",
      client: { id: "client-1", fullName: "Casey Client" },
      updatedAt: timestamp,
      activityCount: 0,
      canCreate: false,
      canManage: isHead,
      activity: [],
      workstreams: [
        {
          id: "project-1",
          requestId: "request-1",
          name: "Website launch",
          description: "Build the client website.",
          serviceName: "Website Development",
          referenceNumber: "SR-WEB-001",
          workflowState: "ACTIVE_PROJECT",
          status: "IN_PROGRESS",
          startDate: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          templateKey: null,
          taskCount: 0,
          completedTaskCount: 0,
          plan: { phases: [] },
          milestones: [deliverable()],
          canUploadDeliverables: actor === "STAFF",
          canAssign: isHead,
        },
      ],
    }
  }

  function clientProject(): ProjectWorkspace {
    const shared: ProjectDeliverable[] =
      deliveryStatus === "SENT_TO_CLIENT" && fileName
        ? [
            {
              id: "deliverable-1",
              title: "Brand guide",
              description: "Final brand direction for client review.",
              expectedFileType: "Plain text",
              sentToClientAt: timestamp,
              workflowFile: {
                id: "file-1",
                name: fileName,
                mimeType: "text/plain",
                size: 16,
                createdAt: timestamp,
              },
              clientReviews: [],
            },
          ]
        : []
    return {
      id: "project-1",
      name: "Website launch",
      description: "Build the client website.",
      status: "IN_PROGRESS",
      startDate: timestamp,
      createdAt: timestamp,
      workspaceManaged: true,
      canManage: false,
      request: {
        id: "request-1",
        referenceNumber: "SR-WEB-001",
        service: { name: "Website Development" },
      },
      milestones: [],
      progress: { completed: 0, total: 0 },
      deliverables: shared,
      changeRequests: [],
      canReviewChanges: false,
    }
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    const method = request.method()

    if (pathname === "/api/auth/me" && method === "GET") {
      const isHead = actor === "HEAD"
      const user =
        actor === "USER"
          ? accountFor("USER", { id: "nex009-client" })
          : accountFor("STAFF", {
              id: isHead ? "nex009-head" : "nex009-staff",
              headOf: isHead ? { id: "department-1", name: "Design" } : null,
            })
      return route.fulfill({ json: { user } })
    }

    if (pathname === "/api/project-workspace/workspace-1" && method === "GET")
      return route.fulfill({ json: workspace() })

    if (
      pathname ===
        "/api/project-workspace/workspace-1/projects/project-1/deliverables/deliverable-1/attachment" &&
      method === "POST"
    ) {
      const body = request.postDataJSON() as { name: string }
      fileName = body.name
      uploadedFileCount += 1
      deliveryStatus = "IN_REVIEW"
      rejectionReason = null
      return route.fulfill({ status: 201, json: workspace() })
    }

    if (
      pathname ===
        "/api/project-workspace/workspace-1/projects/project-1/deliverables/deliverable-1/reject" &&
      method === "POST"
    ) {
      const body = request.postDataJSON() as { reason: string }
      rejectionReasons.push(body.reason)
      deliveryStatus = "REJECTED"
      rejectionReason = body.reason
      return route.fulfill({ json: workspace() })
    }

    if (
      pathname ===
        "/api/project-workspace/workspace-1/projects/project-1/deliverables/deliverable-1/approve" &&
      method === "POST"
    ) {
      deliveryStatus = "APPROVED"
      return route.fulfill({ json: workspace() })
    }

    if (
      pathname ===
        "/api/project-workspace/workspace-1/projects/project-1/deliverables/deliverable-1/send" &&
      method === "POST"
    ) {
      deliveryStatus = "SENT_TO_CLIENT"
      return route.fulfill({ json: workspace() })
    }

    if (pathname === "/api/projects/project-1" && method === "GET")
      return route.fulfill({ json: clientProject() })

    return route.fallback()
  })

  await page.goto("/project-workspace/workspace-1?tab=deliverables")
  const table = page.getByRole("table", { name: "Project deliverables" })
  await expect(table).toBeVisible()
  await expect(table.getByText("Not submitted", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve Brand guide" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Reject Brand guide" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Send Brand guide to client" }),
  ).toHaveCount(0)

  await page
    .getByRole("button", { name: "View details for Brand guide" })
    .click()
  await expect(
    page.getByRole("button", { name: "Upload attachment" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Upload attachment" }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "brand-v1.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("draft brand guide"),
  })
  await expect(table.getByText("In review", { exact: true })).toBeVisible()
  expect(uploadedFileCount).toBe(1)
  expect(rejectionReasons).toHaveLength(0)

  actor = "HEAD"
  await page.goto("/project-workspace/workspace-1?tab=deliverables")
  await expect(table.getByText("In review", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Approve Brand guide" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Reject Brand guide" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Upload attachment" }),
  ).toHaveCount(0)

  await page.getByRole("button", { name: "Reject Brand guide" }).click()
  const reason = page.getByRole("textbox", { name: "Reason for rejection" })
  await reason.fill("ok")
  const rejectButton = page.getByRole("button", {
    name: "Reject deliverable",
    exact: true,
  })
  await expect(rejectButton).toBeDisabled()
  expect(rejectionReasons).toHaveLength(0)
  await reason.fill("Please revise the contrast.")
  await rejectButton.click()
  await expect(table.getByText("Rejected", { exact: true })).toBeVisible()
  expect(rejectionReasons).toEqual(["Please revise the contrast."])

  actor = "STAFF"
  await page.goto("/project-workspace/workspace-1?tab=deliverables")
  await expect(table.getByText("Rejected", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "View details for Brand guide" })
    .click()
  await expect(page.getByText("Please revise the contrast.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Replace attachment" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Replace attachment" }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "brand-v2.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("revised brand guide"),
  })
  await expect(table.getByText("In review", { exact: true })).toBeVisible()
  await expect(page.getByText("Please revise the contrast.")).toHaveCount(0)
  expect(uploadedFileCount).toBe(2)

  actor = "USER"
  await page.goto("/projects/project-1?tab=deliverables")
  await expect(page.getByText("No deliverables shared yet")).toBeVisible()
  await expect(page.getByText("Brand guide", { exact: true })).toHaveCount(0)

  actor = "HEAD"
  await page.goto("/project-workspace/workspace-1?tab=deliverables")
  await page.getByRole("button", { name: "Approve Brand guide" }).click()
  await expect(table.getByText("Approved", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Upload attachment" }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Send Brand guide to client" }).click()
  await expect(table.getByText("Sent to client", { exact: true })).toBeVisible()
  await page
    .getByRole("button", { name: "View details for Brand guide" })
    .click()
  await expect(
    page.getByText("Shared with the client", { exact: true }),
  ).toBeVisible()

  actor = "USER"
  await page.goto("/projects/project-1?tab=deliverables")
  await expect(page.getByText("Brand guide", { exact: true })).toBeVisible()
  await expect(page.getByText("brand-v2.txt", { exact: false })).toBeVisible()
  await expect(
    page.getByText("Awaiting your review", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "View Brand guide" }),
  ).toBeVisible()
})
