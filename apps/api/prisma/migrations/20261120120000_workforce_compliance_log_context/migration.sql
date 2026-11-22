ALTER TABLE "AttendanceAudit"
    ADD COLUMN "operationId" UUID,
    ADD COLUMN "correlationId" UUID,
    ADD COLUMN "actorRoleAtTime" "Role";
ALTER TABLE "LeaveDecision"
    ADD COLUMN "operationId" UUID,
    ADD COLUMN "correlationId" UUID,
    ADD COLUMN "actorRoleAtTime" "Role";

CREATE INDEX "AttendanceAudit_createdAt_id_idx" ON "AttendanceAudit" ("createdAt", id);
CREATE INDEX "AttendanceAudit_operationId_idx" ON "AttendanceAudit" ("operationId");
CREATE INDEX "LeaveDecision_createdAt_id_idx" ON "LeaveDecision" ("createdAt", id);
CREATE INDEX "LeaveDecision_operationId_idx" ON "LeaveDecision" ("operationId");

CREATE OR REPLACE FUNCTION attendance_record_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous jsonb; following jsonb; row_data jsonb; entity_id text; employee_id text; workday_id text;
BEGIN
    IF TG_OP <> 'INSERT' THEN previous := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN following := to_jsonb(NEW); END IF;
    row_data := coalesce(following, previous);
    entity_id := coalesce(row_data->>'id', (row_data->>'policyId') || ':' || (row_data->>'weekday'));
    employee_id := row_data->>'employeeId';
    workday_id := row_data->>'workdayId';
    IF TG_TABLE_NAME = 'AttendanceWorkday' THEN workday_id := entity_id; END IF;
    IF TG_TABLE_NAME = 'AttendanceBreak' THEN
        SELECT "workdayId", "employeeId" INTO workday_id, employee_id FROM "AttendanceWorkSession" WHERE id = row_data->>'sessionId';
    END IF;
    INSERT INTO "AttendanceAudit" (
        id, "entityType", "entityId", "employeeId", "workdayId", "actorId", action, reason, before, after, "actionId",
        "operationId", "correlationId", "actorRoleAtTime"
    ) VALUES (
        gen_random_uuid()::text, TG_TABLE_NAME, entity_id, employee_id, workday_id,
        nullif(current_setting('app.attendance_actor_id', true), ''), TG_OP,
        coalesce(nullif(current_setting('app.attendance_reason', true), ''), 'Database change'),
        previous, following, gen_random_uuid()::text,
        nullif(current_setting('app.attendance_operation_id', true), '')::uuid,
        nullif(current_setting('app.attendance_correlation_id', true), '')::uuid,
        nullif(current_setting('app.attendance_actor_role', true), '')::"Role"
    );
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
