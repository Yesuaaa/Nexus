BEGIN;

-- Match notifySubmittedLeave for existing requests after a reviewer change.
-- A pending notice stays at version zero and keeps its original read state.
INSERT INTO "WorkflowNotification"
    (id, "userId", "leaveRequestId", type, "leaveVersion", summary)
SELECT gen_random_uuid()::text, reviewer.id, request.id, 'LEAVE_SUBMITTED', 0,
    'A leave request is awaiting review.'
FROM "LeaveRequest" request
JOIN "Employee" employee ON employee.id = request."employeeId"
LEFT JOIN "Department" department ON department.id = employee."departmentId"
LEFT JOIN "User" head ON head.id = department."headId"
    AND head.role = 'STAFF' AND head."isActive" AND head."accountDeletedAt" IS NULL
    AND head.id <> request."requestedById" AND head.id IS DISTINCT FROM employee."userId"
JOIN "User" reviewer ON reviewer.id = head.id OR (head.id IS NULL AND reviewer.role = 'ADMIN')
WHERE request.status = 'SUBMITTED'
    AND reviewer."isActive" AND reviewer."accountDeletedAt" IS NULL
    AND reviewer.id <> request."requestedById" AND reviewer.id IS DISTINCT FROM employee."userId"
ON CONFLICT ("userId", "leaveRequestId", type, "leaveVersion") DO NOTHING;

COMMIT;
