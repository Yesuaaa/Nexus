BEGIN;

ALTER TABLE "AttendanceAudit" DROP CONSTRAINT attendance_audit_values;
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT attendance_audit_values CHECK (
    length(trim(reason)) > 0 AND length(trim(action)) > 0 AND length(trim("entityId")) > 0
    AND (
        "entityType" IN ('AttendancePolicy', 'AttendancePolicyDay', 'AttendancePolicyAssignment',
            'AttendanceWorkday', 'AttendanceWorkSession', 'AttendanceBreak', 'AttendanceAdjustment')
        OR ("entityType" = 'EmployeeDepartmentPlacement' AND action = 'UPDATE'
            AND "employeeId" IS NOT NULL AND "entityId" = "employeeId"
            AND "actorId" IS NOT NULL AND "actorRoleAtTime" IS NOT NULL AND "operationId" IS NOT NULL
            AND before IS NOT NULL AND after IS NOT NULL AND before IS DISTINCT FROM after)
    )
);

CREATE OR REPLACE FUNCTION attendance_transfer_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    reopened_ids text[];
    pending_ids text[];
    initiating_actor text := nullif(current_setting('app.attendance_actor_id', true), '');
    initiating_role "Role" := nullif(current_setting('app.attendance_actor_role', true), '')::"Role";
    placement_operation uuid := nullif(current_setting('app.attendance_operation_id', true), '')::uuid;
BEGIN
    WITH reopened AS (
        UPDATE "AttendanceAdjustment" SET status = 'PENDING', "verifiedById" = NULL,
            "verifiedAt" = NULL, "verificationNote" = NULL, "verifiedDepartmentId" = NULL
        WHERE "employeeId" = NEW.id AND status = 'VERIFIED'
        RETURNING id
    )
    SELECT COALESCE(array_agg(id), '{}'::text[]) INTO reopened_ids FROM reopened;

    -- Moving a pending request preserves its stage and existing notice reads.
    -- Reopening a verified request renews pending notices for receiving reviewers.
    pending_ids := ARRAY(
        SELECT id FROM "AttendanceAdjustment" WHERE "employeeId" = NEW.id AND status = 'PENDING'
    );
    PERFORM attendance_notify_pending_adjustments(pending_ids, true, reopened_ids);

    -- Expose only placement changes that affect attendance review.
    IF cardinality(pending_ids) > 0 AND initiating_actor IS NOT NULL
        AND initiating_role IS NOT NULL AND placement_operation IS NOT NULL THEN
        INSERT INTO "AttendanceAudit" (
            id, "entityType", "entityId", "employeeId", "actorId", action, reason, before, after,
            "actionId", "operationId", "correlationId", "actorRoleAtTime"
        ) VALUES (
            gen_random_uuid()::text, 'EmployeeDepartmentPlacement', NEW.id, NEW.id, initiating_actor,
            'UPDATE', coalesce(nullif(current_setting('app.attendance_reason', true), ''), 'Database change'),
            jsonb_build_object('departmentId', OLD."departmentId"),
            jsonb_build_object('departmentId', NEW."departmentId"),
            gen_random_uuid()::text, placement_operation,
            nullif(current_setting('app.attendance_correlation_id', true), '')::uuid, initiating_role
        );
    END IF;
    RETURN NEW;
END $$;

COMMIT;
