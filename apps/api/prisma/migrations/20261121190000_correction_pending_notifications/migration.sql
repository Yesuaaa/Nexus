BEGIN;

-- Pending corrections use the current independent Head or active HR fallback.
-- Only an actual VERIFIED-to-PENDING reset starts a new review cycle.
CREATE FUNCTION attendance_notify_pending_corrections(
    request_ids text[],
    include_superadmins boolean,
    reopened_ids text[] DEFAULT '{}'::text[]
) RETURNS void LANGUAGE sql AS $$
    INSERT INTO "WorkflowNotification" AS n
        (id, "userId", "attendanceAdjustmentId", type, summary)
    SELECT gen_random_uuid()::text, u.id, a.id, 'ATTENDANCE_CORRECTION_PENDING',
        e."fullName" || ': attendance correction ' ||
        CASE WHEN h.id IS NULL THEN 'awaiting HR review.' ELSE 'awaiting department verification.' END
    FROM "AttendanceAdjustment" a
    JOIN "Employee" e ON e.id = a."employeeId"
    LEFT JOIN "Department" d ON d.id = e."departmentId"
    LEFT JOIN "User" h ON h.id = d."headId" AND h.role = 'STAFF' AND h."isActive"
        AND h."accountDeletedAt" IS NULL AND h.id <> a."requestedById" AND h.id IS DISTINCT FROM e."userId"
    JOIN "User" u ON u.id = h.id OR (h.id IS NULL AND u.role = 'ADMIN')
        OR (include_superadmins AND u.role = 'SUPERADMIN')
    WHERE a.id = ANY(request_ids) AND a.status = 'PENDING' AND a.type = 'CORRECTION'
        AND u."isActive" AND u."accountDeletedAt" IS NULL
        AND u.id <> a."requestedById" AND u.id IS DISTINCT FROM e."userId"
    ON CONFLICT ("userId", "attendanceAdjustmentId", type) DO UPDATE
    SET "readAt" = NULL, "createdAt" = CURRENT_TIMESTAMP, summary = EXCLUDED.summary
    WHERE n."attendanceAdjustmentId" = ANY(reopened_ids);
$$;

CREATE OR REPLACE FUNCTION attendance_transfer_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reopened_corrections text[];
BEGIN
    WITH reopened AS (
        UPDATE "AttendanceAdjustment" SET status = 'PENDING', "verifiedById" = NULL,
            "verifiedAt" = NULL, "verificationNote" = NULL, "verifiedDepartmentId" = NULL
        WHERE "employeeId" = NEW.id AND status = 'VERIFIED'
        RETURNING id, type
    )
    SELECT COALESCE(array_agg(id) FILTER (WHERE type = 'CORRECTION'), '{}'::text[])
        INTO reopened_corrections FROM reopened;

    PERFORM attendance_notify_pending_corrections(ARRAY(
        SELECT id FROM "AttendanceAdjustment"
        WHERE "employeeId" = NEW.id AND status = 'PENDING' AND type = 'CORRECTION'
    ), true, reopened_corrections);

    INSERT INTO "WorkflowNotification" (id, "userId", "attendanceAdjustmentId", type, summary)
    SELECT gen_random_uuid()::text, u.id, a.id, 'ATTENDANCE_' || a.type || '_PENDING',
        'An attendance request requires review after a department transfer.'
    FROM "AttendanceAdjustment" a
    LEFT JOIN "Department" d ON d.id = NEW."departmentId"
    LEFT JOIN "User" h ON h.id = d."headId" AND h.role = 'STAFF' AND h."isActive"
        AND h."accountDeletedAt" IS NULL AND h.id <> a."requestedById" AND h.id IS DISTINCT FROM NEW."userId"
    JOIN "User" u ON u.id = h.id OR (h.id IS NULL AND u.role = 'ADMIN') OR u.role = 'SUPERADMIN'
    WHERE a."employeeId" = NEW.id AND a.status = 'PENDING' AND a.type <> 'CORRECTION'
        AND u."isActive" AND u."accountDeletedAt" IS NULL
        AND u.id <> a."requestedById" AND u.id IS DISTINCT FROM NEW."userId"
    ON CONFLICT ("userId","attendanceAdjustmentId",type) DO UPDATE SET "readAt" = NULL, "createdAt" = CURRENT_TIMESTAMP, summary = EXCLUDED.summary;
    RETURN NEW;
END $$;

-- Fill gaps for requests that were already pending when the fix was installed.
SELECT attendance_notify_pending_corrections(ARRAY(
    SELECT id FROM "AttendanceAdjustment" WHERE status = 'PENDING' AND type = 'CORRECTION'
), false);

COMMIT;
