ALTER TABLE "AttendancePolicy" ADD COLUMN "archivedAt" TIMESTAMPTZ(3);
ALTER TABLE "AttendanceWorkday"
    ADD COLUMN "policyName" TEXT,
    ADD COLUMN "unpaidBreaksEnabled" BOOLEAN,
    ADD COLUMN "overnightRequiresReview" BOOLEAN;

-- Backfill the remaining rules before allowing edits to assigned policies.
ALTER TABLE "AttendanceWorkday" DISABLE TRIGGER attendance_day_preserve;
UPDATE "AttendanceWorkday" w SET
    "policyName" = p.name,
    "unpaidBreaksEnabled" = p."unpaidBreaksEnabled",
    "overnightRequiresReview" = p."overnightRequiresReview"
FROM "AttendancePolicyAssignment" a JOIN "AttendancePolicy" p ON p.id = a."policyId"
WHERE a.id = w."assignmentId";
ALTER TABLE "AttendanceWorkday" ENABLE TRIGGER attendance_day_preserve;
ALTER TABLE "AttendanceWorkday"
    ALTER COLUMN "policyName" SET NOT NULL,
    ALTER COLUMN "unpaidBreaksEnabled" SET NOT NULL,
    ALTER COLUMN "overnightRequiresReview" SET NOT NULL;

CREATE OR REPLACE FUNCTION attendance_policy_preserve() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_id text;
BEGIN
    PERFORM attendance_write_isolation();
    IF TG_TABLE_NAME = 'AttendancePolicy' THEN
        policy_id := OLD.id;
        IF TG_OP = 'DELETE' AND OLD."archivedAt" IS NULL THEN
            RAISE EXCEPTION 'Archive the policy before permanently deleting it' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.id <> OLD.id THEN
            RAISE EXCEPTION 'Policy identity is immutable' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW."timeZone" <> OLD."timeZone"
            AND EXISTS (SELECT 1 FROM "AttendancePolicyAssignment" WHERE "policyId" = policy_id) THEN
            RAISE EXCEPTION 'Assigned policy timezone is immutable; create a policy for a different timezone' USING ERRCODE = '23514';
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        policy_id := NEW."policyId";
    ELSE
        policy_id := OLD."policyId";
        IF TG_OP = 'UPDATE' AND (NEW."policyId" <> OLD."policyId" OR NEW.weekday <> OLD.weekday) THEN
            RAISE EXCEPTION 'Weekday rule identity is immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    PERFORM 1 FROM "AttendancePolicy" WHERE id = policy_id FOR UPDATE;
    IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM "AttendancePolicyAssignment" WHERE "policyId" = policy_id) THEN
        RAISE EXCEPTION 'Policy has assignments; retain it for attendance history' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

-- Archiving prevents new assignments without interrupting existing attendance.
CREATE FUNCTION attendance_assignment_active_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    PERFORM 1 FROM "AttendancePolicy" WHERE id = NEW."policyId" FOR UPDATE;
    IF EXISTS (SELECT 1 FROM "AttendancePolicy" WHERE id = NEW."policyId" AND "archivedAt" IS NOT NULL) THEN
        RAISE EXCEPTION 'Restore the archived policy before assigning it' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_assignment_active_policy BEFORE INSERT ON "AttendancePolicyAssignment"
    FOR EACH ROW EXECUTE FUNCTION attendance_assignment_active_policy();

CREATE OR REPLACE FUNCTION attendance_day_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment "AttendancePolicyAssignment"%ROWTYPE; rule "AttendancePolicyDay"%ROWTYPE; policy "AttendancePolicy"%ROWTYPE;
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    SELECT * INTO STRICT assignment FROM "AttendancePolicyAssignment"
        WHERE id = NEW."assignmentId" AND "employeeId" = NEW."employeeId" FOR SHARE;
    IF NEW."workDate" < assignment."effectiveFrom" OR (assignment."effectiveUntil" IS NOT NULL AND NEW."workDate" >= assignment."effectiveUntil") THEN
        RAISE EXCEPTION 'Workday outside policy assignment' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT policy FROM "AttendancePolicy" WHERE id = assignment."policyId" FOR SHARE;
    SELECT * INTO STRICT rule FROM "AttendancePolicyDay"
        WHERE "policyId" = assignment."policyId" AND weekday = extract(dow FROM NEW."workDate");
    NEW."timeZone" := policy."timeZone";
    NEW."policyName" := policy.name;
    NEW."unpaidBreaksEnabled" := policy."unpaidBreaksEnabled";
    NEW."overnightRequiresReview" := policy."overnightRequiresReview";
    NEW."requiredMinutes" := rule."requiredMinutes";
    NEW."isWorkingDay" := rule."isWorkingDay";
    RETURN NEW;
END $$;
