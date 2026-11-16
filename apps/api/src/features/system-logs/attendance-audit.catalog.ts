export const attendanceSource = "audit.attendance" as const
export const attendanceSubjects = {
  AttendancePolicy: "attendance_policy",
  AttendancePolicyDay: "attendance_policy_day",
  AttendancePolicyAssignment: "attendance_policy_assignment",
  AttendanceWorkday: "attendance_workday",
  AttendanceWorkSession: "attendance_work_session",
  AttendanceBreak: "attendance_break",
  AttendanceAdjustment: "attendance_adjustment",
} as const
export type AttendanceSubject =
  (typeof attendanceSubjects)[keyof typeof attendanceSubjects]
export const attendanceActions = ["INSERT", "UPDATE", "DELETE"] as const
export const attendanceActionSupported = (entityType: string, action: string) =>
  attendanceActions.some((value) => value === action) &&
  !(entityType === "AttendanceWorkday" && action === "DELETE")
export const attendanceEventNames = Object.values(attendanceSubjects).flatMap(
  (subject) =>
    attendanceActions
      .filter(
        (action) => !(subject === "attendance_workday" && action === "DELETE"),
      )
      .map((action) => `${subject}.${action.toLowerCase()}`),
)
