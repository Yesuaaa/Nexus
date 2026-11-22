import { attendanceTimestamp } from "./attendance.validation.js"
import { fail } from "../../shared/http-error.js"
import { isPlainObject } from "../../shared/validation.js"
import { Router } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { recordIdParam } from "../../shared/validation.js"
import { attendanceHandlers } from "./attendance.controller.js"
import { createAttendanceService } from "./attendance.service.js"
import { createAttendanceManagement } from "./attendance.management.js"

export function createAttendanceRouter(clock: () => Date = () => new Date()) {
  const router = Router()
  const service = createAttendanceService(clock)
  const handlers = attendanceHandlers(service, clock)
  const management = createAttendanceManagement(clock)
  router.use(requireAuth)
  router.param("employeeId", recordIdParam("Invalid employee ID"))
  router.param("adjustmentId", recordIdParam("Invalid adjustment ID"))
  router.param("policyId", recordIdParam("Invalid policy ID"))
  router.get("/departments", async (req, res) => {
    res.json(await management.departments(req.auth!.user.id))
  })
  router.get("/records", async (req, res) => {
    res.json(await management.records(req.auth!.user.id, req.query))
  })
  router.get("/audit", async (req, res) => {
    res.json(await management.records(req.auth!.user.id, req.query, true))
  })
  router.get("/employees", async (req, res) => {
    res.json(await management.employees(req.auth!.user.id, req.query))
  })
  router.get("/overview", async (req, res) => {
    res.json(await management.overview(req.auth!.user.id, req.query))
  })
  router.get("/policies", async (req, res) => {
    res.json(await management.policies(req.auth!.user.id, req.query))
  })
  router.post("/policies", async (req, res) => {
    res
      .status(201)
      .json(await management.createPolicy(req.auth!.user.id, req.body))
  })
  router.patch("/policies/:policyId", async (req, res) => {
    res.json(
      await management.updatePolicy(
        req.auth!.user.id,
        String(req.params.policyId),
        req.body,
      ),
    )
  })
  router.get("/policies/:policyId/assignments", async (req, res) => {
    res.json(
      await management.policyAssignments(
        req.auth!.user.id,
        String(req.params.policyId),
        req.query,
      ),
    )
  })
  router.post("/policies/:policyId/archive", async (req, res) => {
    res.json(
      await management.archivePolicy(
        req.auth!.user.id,
        String(req.params.policyId),
        true,
      ),
    )
  })
  router.post("/policies/:policyId/restore", async (req, res) => {
    res.json(
      await management.archivePolicy(
        req.auth!.user.id,
        String(req.params.policyId),
        false,
      ),
    )
  })
  router.delete("/policies/:policyId", async (req, res) => {
    res.json(
      await management.deletePolicy(
        req.auth!.user.id,
        String(req.params.policyId),
      ),
    )
  })
  router.post("/assignments", async (req, res) => {
    res
      .status(201)
      .json(await management.assignPolicy(req.auth!.user.id, req.body))
  })
  router.post("/assignments/:assignmentId/unassign", async (req, res) => {
    res.json(
      await management.unassignPolicy(
        req.auth!.user.id,
        String(req.params.assignmentId),
        req.body,
      ),
    )
  })
  router.get("/adjustments/overview", async (req, res) => {
    res.json(await management.adjustmentOverview(req.auth!.user.id, req.query))
  })
  router.get("/adjustments/:adjustmentId", async (req,res)=>{res.json(await management.adjustmentDetail(req.auth!.user.id,String(req.params.adjustmentId)))})
  router.get("/adjustments", async (req, res) => {
    res.json(await management.adjustments(req.auth!.user.id, req.query))
  })
  router.post("/adjustments", async (req, res) => {
    res
      .status(201)
      .json(await management.requestAdjustment(req.auth!.user.id, req.body))
  })
  router.post("/adjustments/:adjustmentId/review", async (req, res) => {
    res.json(
      await management.reviewAdjustment(
        req.auth!.user.id,
        String(req.params.adjustmentId),
        req.body,
      ),
    )
  })
  router.param("sessionId",recordIdParam("Invalid session ID"))
  router.post("/employees/:employeeId/sessions/:sessionId/reconcile",async(req,res)=>{
    const body:unknown=req.body
    if(!isPlainObject(body) || Object.keys(body).some(key=>key!=="endedAt"&&key!=="note") || typeof body.note!=="string" || body.note.trim().length<5 || body.note.trim().length>2000)fail(400,"Record a reconciliation reason of 5 to 2,000 characters")
    let endedAt:Date
    try{endedAt=attendanceTimestamp(body.endedAt)}catch{ return fail(400,"Provide a valid confirmed clock-out time") }
    res.json(await service.reconcile(req.auth!.user.id,String(req.params.employeeId),String(req.params.sessionId),endedAt,body.note.trim()))
  })
  router.get("/me/overview", async (req, res) => {
    res.json(await management.overview(req.auth!.user.id, req.query, true))
  })
  router.get("/me/current", handlers.current)
  router.get("/me/history", handlers.history)
  router.post("/me/clock-in", handlers.mutation("clock-in"))
  router.post("/me/clock-out", handlers.mutation("clock-out"))
  router.post("/me/breaks/start", handlers.mutation("break-start"))
  router.post("/me/breaks/end", handlers.mutation("break-end"))
  router.get("/employees/:employeeId/history", handlers.history)
  return router
}
