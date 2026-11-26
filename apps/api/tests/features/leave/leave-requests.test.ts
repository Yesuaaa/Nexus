import { test } from "node:test"
import { createLeaveContext } from "./leave-requests/context.js"
import { leaveLifecycle } from "./leave-requests/lifecycle.js"
import { departmentTransfers } from "./leave-requests/transfers.js"
import { listFilters } from "./leave-requests/filters.js"
import { inputBoundaries } from "./leave-requests/boundaries.js"
import { attendanceConflicts } from "./leave-requests/attendance-conflicts.js"
import { requesterAccount } from "./leave-requests/requester-account.js"
import { reportsAndAssignments } from "./leave-requests/reports-and-assignments.js"
import { decisionReplays } from "./leave-requests/replays.js"
import { reviewRouting } from "./leave-requests/review-routing.js"
import { paginationAndPolicyGaps } from "./leave-requests/pagination-and-policy-gaps.js"

test(
  "leave requests enforce staged review, conflicts, and attendance exceptions",
  { timeout: 120000 },
  async (t) => {
    const context = await createLeaveContext(t)
    await leaveLifecycle(context)
    const transfer = await departmentTransfers(t, context)
    await listFilters(context)
    await inputBoundaries(context)
    await attendanceConflicts(t, { ...context, ...transfer })
    await requesterAccount(t, context)
    await reportsAndAssignments(t, context)
    await decisionReplays(t, context)
    await reviewRouting(t, context)
    await paginationAndPolicyGaps(t, context)
  },
)
