ALTER TABLE "AttendanceAdjustment" ADD COLUMN "verifiedDepartmentId" TEXT;

UPDATE "AttendanceAdjustment" a SET "verifiedDepartmentId" = d.id
FROM "Employee" e JOIN "Department" d ON d.id = e."departmentId"
WHERE e.id = a."employeeId" AND d."headId" = a."verifiedById" AND a.status = 'VERIFIED';
-- Return unprovable legacy verifications to review. The audit trigger retains the decision.
UPDATE "AttendanceAdjustment" SET status = 'PENDING', "verifiedById" = NULL,
    "verifiedAt" = NULL, "verificationNote" = NULL
WHERE status = 'VERIFIED' AND "verifiedDepartmentId" IS NULL;

CREATE FUNCTION attendance_adjustment_verification_department() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'VERIFIED' THEN
        SELECT "departmentId" INTO NEW."verifiedDepartmentId" FROM "Employee" WHERE id = NEW."employeeId";
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER adjustment_verification_department BEFORE INSERT OR UPDATE OF status ON "AttendanceAdjustment"
FOR EACH ROW EXECUTE FUNCTION attendance_adjustment_verification_department();

CREATE FUNCTION attendance_transfer_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE "AttendanceAdjustment" SET status = 'PENDING', "verifiedById" = NULL,
        "verifiedAt" = NULL, "verificationNote" = NULL, "verifiedDepartmentId" = NULL
    WHERE "employeeId" = NEW.id AND status = 'VERIFIED';
    INSERT INTO "WorkflowNotification" (id, "userId", "attendanceAdjustmentId", type, summary)
    SELECT gen_random_uuid()::text, u.id, a.id, 'ATTENDANCE_' || a.type || '_PENDING',
        'An attendance request requires review after a department transfer.'
    FROM "AttendanceAdjustment" a
    LEFT JOIN "Department" d ON d.id = NEW."departmentId"
    LEFT JOIN "User" h ON h.id = d."headId" AND h.role = 'STAFF' AND h."isActive"
        AND h."accountDeletedAt" IS NULL AND h.id <> a."requestedById" AND h.id IS DISTINCT FROM NEW."userId"
    JOIN "User" u ON u.id = h.id OR (h.id IS NULL AND u.role = 'ADMIN') OR u.role = 'SUPERADMIN'
    WHERE a."employeeId" = NEW.id AND a.status = 'PENDING' AND u."isActive" AND u."accountDeletedAt" IS NULL
        AND u.id <> a."requestedById" AND u.id IS DISTINCT FROM NEW."userId"
    ON CONFLICT ("userId","attendanceAdjustmentId",type) DO UPDATE SET "readAt" = NULL, "createdAt" = CURRENT_TIMESTAMP, summary = EXCLUDED.summary;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_transfer_review AFTER UPDATE OF "departmentId" ON "Employee"
FOR EACH ROW WHEN (NEW."departmentId" IS DISTINCT FROM OLD."departmentId") EXECUTE FUNCTION attendance_transfer_review();

ALTER TABLE "AttendanceWorkSession" ADD COLUMN "suspendedAt" TIMESTAMPTZ(3);
-- Already stranded sessions use the earliest recorded account cutoff when available.
UPDATE "AttendanceWorkSession" s
SET "suspendedAt" = greatest(s."startedAt", coalesce(u."accountDeletedAt", CURRENT_TIMESTAMP))
FROM "Employee" e LEFT JOIN "User" u ON e."userId" = u.id
WHERE s."employeeId" = e.id AND s."endedAt" IS NULL
  AND (u.id IS NULL OR NOT u."isActive" OR u."accountDeletedAt" IS NOT NULL);
