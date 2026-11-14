import type { RequestHandler } from "express"
import type { createAttendanceService } from "./attendance.service.js"
import {
  parseAttendanceAction,
  parseAttendanceHistory,
  type AttendanceAction,
} from "./attendance.schema.js"

export function attendanceHandlers(
  service: ReturnType<typeof createAttendanceService>,
  clock: () => Date,
) {
  const mutation =
    (action: AttendanceAction): RequestHandler =>
    async (request, response) => {
      const input = parseAttendanceAction(action, request.body)
      response
        .status(action === "clock-in" ? 201 : 200)
        .json(await service.act(request.auth!.user.id, action, input))
    }
  const current: RequestHandler = async (request, response) => {
    response.json(await service.current(request.auth!.user.id))
  }
  const history: RequestHandler = async (request, response) => {
    response.json(
      await service.history(
        request.auth!.user.id,
        parseAttendanceHistory(request.query, clock()),
        request.params.employeeId === undefined
          ? undefined
          : String(request.params.employeeId),
      ),
    )
  }
  return { mutation, current, history }
}
