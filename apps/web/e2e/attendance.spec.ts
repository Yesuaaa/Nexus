import { test } from "@playwright/test"
import { clockAndCorrectionTests } from "./attendance/clock-and-corrections"
import { managementPageTests } from "./attendance/management-pages"
import { personalOverviewTests } from "./attendance/personal-overview"
import { policyEditingTests } from "./attendance/policy-editing"
import { policyOverviewTests } from "./attendance/policy-overview"
import { auditTests } from "./attendance/audit"
import { reconciliationTests } from "./attendance/reconciliation"
import { correctionNoticeTests } from "./attendance/correction-notices"
import { workforceLogTests } from "./attendance/workforce-logs"
import { overtimeConflictTests } from "./attendance/overtime-conflicts"
import { leaveTests } from "./attendance/leave"
import { requestsOverviewTests } from "./attendance/requests-overview"
import { staleReviewTests } from "./attendance/stale-reviews"
import { registerAttendanceHooks } from "./attendance/support"

// One server and database serve every test below, so they run in this order.
test.describe.configure({ mode: "serial" })

registerAttendanceHooks()
clockAndCorrectionTests()
managementPageTests()
personalOverviewTests()
policyEditingTests()
policyOverviewTests()
auditTests()
reconciliationTests()
correctionNoticeTests()
workforceLogTests()
overtimeConflictTests()
leaveTests()
requestsOverviewTests()
staleReviewTests()
