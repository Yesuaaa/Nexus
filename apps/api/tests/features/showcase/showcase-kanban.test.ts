import assert from "node:assert/strict"
import { test } from "node:test"
import {
  photographyShowcasePlan,
  preparePhotographyShowcaseBoard,
  showcaseBoardPlan,
} from "../../../prisma/seed/showcase-kanban.js"

test("photography showcase plan has distinct tasks and approved assignees", () => {
  const staff = ["staff-one", "staff-two", "staff-three"]
  const plan = photographyShowcasePlan(staff)
  const tasks = plan.phases.flatMap((phase) => phase.tasks)
  assert.equal(tasks.length, 16)
  assert.equal(new Set(tasks.map((task) => task.id)).size, 16)
  assert.equal(new Set(tasks.map((task) => task.title)).size, 16)
  assert.equal(tasks.filter((task) => task.status === "NOT_STARTED").length, 4)
  assert.equal(tasks.filter((task) => task.status === "IN_PROGRESS").length, 8)
  assert.equal(tasks.filter((task) => task.status === "DONE").length, 4)
  assert.equal(plan.phases[2].tasks.length, 3)
  assert.ok(tasks.every((task) => staff.includes(task.employeeId!)))
  assert.deepEqual(photographyShowcasePlan(staff), plan)
  assert.throws(() => photographyShowcasePlan(["staff-one"]))
  assert.throws(() => photographyShowcasePlan(["staff-one", "staff-one"]))
})

test("both showcase workspaces have separate task identifiers and dated deliverables", () => {
  const staff = ["staff-one", "staff-two"]
  const start = new Date("2026-08-01T00:00:00.000Z")
  const photography = showcaseBoardPlan("photography", staff, start)
  const design = showcaseBoardPlan("design", staff, start)
  const photographyTasks = photography.phases.flatMap((phase) => phase.tasks)
  const designTasks = design.phases.flatMap((phase) => phase.tasks)
  assert.equal(designTasks.length, 16)
  assert.equal(
    new Set([...photographyTasks, ...designTasks].map((task) => task.id)).size,
    32,
  )
  assert.ok(
    designTasks.every(
      (task) => task.dueDate && staff.includes(task.employeeId!),
    ),
  )
  assert.deepEqual(showcaseBoardPlan("design", staff, start), design)
})

test("board preparation refuses the development database before connecting", async () => {
  const original = { ...process.env }
  try {
    process.env.NODE_ENV = "development"
    process.env.DATABASE_URL =
      "postgresql://local:local@127.0.0.1:5433/nexus_dev"
    delete process.env.DIRECT_URL
    process.env.SHOWCASE_CONFIRM_TARGET = "nexus_dev"
    await assert.rejects(
      () => preparePhotographyShowcaseBoard("head", "project"),
      /separate local nexus_showcase/,
    )
  } finally {
    for (const key of [
      "NODE_ENV",
      "DATABASE_URL",
      "DIRECT_URL",
      "SHOWCASE_CONFIRM_TARGET",
    ]) {
      if (original[key] === undefined) delete process.env[key]
      else process.env[key] = original[key]
    }
  }
})
