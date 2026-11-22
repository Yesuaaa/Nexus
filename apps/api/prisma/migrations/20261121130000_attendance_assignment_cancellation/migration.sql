ALTER TABLE "AttendancePolicyAssignment" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3);

CREATE OR REPLACE FUNCTION attendance_assignment_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_zone text;
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    SELECT "timeZone" INTO policy_zone FROM "AttendancePolicy" WHERE id = NEW."policyId" FOR UPDATE;
    IF (SELECT count(*) FROM "AttendancePolicyDay" WHERE "policyId" = NEW."policyId") <> 7 THEN
        RAISE EXCEPTION 'Configure all seven weekdays before assigning a policy' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW."employeeId" <> OLD."employeeId" OR NEW."policyId" <> OLD."policyId" OR NEW."effectiveFrom" <> OLD."effectiveFrom") THEN
        RAISE EXCEPTION 'Create a new policy assignment instead' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD."cancelledAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Cancelled attendance assignments are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."cancelledAt" IS NOT NULL THEN
        IF TG_OP = 'INSERT' OR NOT isfinite(NEW."cancelledAt")
            OR NEW."cancelledAt" >= (NEW."effectiveFrom"::timestamp AT TIME ZONE policy_zone) THEN
            RAISE EXCEPTION 'Only scheduled attendance assignments can be cancelled' USING ERRCODE = '23514';
        END IF;
        IF NEW."effectiveUntil" IS DISTINCT FROM OLD."effectiveUntil" THEN
            RAISE EXCEPTION 'Cancellation must retain the scheduled assignment dates' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (SELECT 1 FROM "AttendanceWorkday" WHERE "assignmentId" = NEW.id) THEN
            RAISE EXCEPTION 'This assignment has recorded attendance and cannot be cancelled' USING ERRCODE = '23514';
        END IF;
        IF EXISTS (SELECT 1 FROM "LeaveRequestDay" d JOIN "LeaveRequest" r ON r.id = d."requestId"
            WHERE d."assignmentId" = NEW.id AND r.status IN ('SUBMITTED', 'VERIFIED', 'APPROVED')) THEN
            RAISE EXCEPTION 'Resolve future leave requests before ending this assignment' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW."effectiveUntil" IS NOT NULL AND NEW."effectiveUntil" <= NEW."effectiveFrom" THEN
        RAISE EXCEPTION 'Assignment end must follow its start' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendancePolicyAssignment" a
        WHERE a."employeeId" = NEW."employeeId" AND a.id <> NEW.id
        AND a."cancelledAt" IS NULL
        AND daterange(a."effectiveFrom", a."effectiveUntil", '[)') && daterange(NEW."effectiveFrom", NEW."effectiveUntil", '[)')) THEN
        RAISE EXCEPTION 'Attendance assignments overlap' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendanceWorkday" WHERE "assignmentId" = NEW.id
        AND NEW."effectiveUntil" IS NOT NULL AND "workDate" >= NEW."effectiveUntil") THEN
        RAISE EXCEPTION 'Assignment would exclude recorded workdays' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION attendance_day_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment "AttendancePolicyAssignment"%ROWTYPE; rule "AttendancePolicyDay"%ROWTYPE; policy "AttendancePolicy"%ROWTYPE;
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    SELECT * INTO STRICT assignment FROM "AttendancePolicyAssignment"
        WHERE id = NEW."assignmentId" AND "employeeId" = NEW."employeeId" FOR SHARE;
    IF assignment."cancelledAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Attendance policy assignment is cancelled' USING ERRCODE = '23514';
    END IF;
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

CREATE OR REPLACE FUNCTION attendance_assignment_end_at(target_employee_id text, end_date date, outgoing_zone text)
RETURNS timestamptz LANGUAGE sql STABLE STRICT AS $$
    SELECT end_date::timestamp AT TIME ZONE COALESCE((
        SELECT p."timeZone"
        FROM "AttendancePolicyAssignment" next_assignment
        JOIN "AttendancePolicy" p ON p.id = next_assignment."policyId"
        WHERE next_assignment."employeeId" = target_employee_id
          AND next_assignment."effectiveFrom" = end_date
          AND next_assignment."cancelledAt" IS NULL
    ), outgoing_zone)
$$;

CREATE OR REPLACE FUNCTION attendance_policy_at(target_employee_id text, at_time timestamptz)
RETURNS TABLE ("assignmentId" text, "workDate" date) LANGUAGE sql STABLE AS $$
    WITH latest_started AS (
        SELECT a.id, a."effectiveUntil", p."timeZone"
        FROM "AttendancePolicyAssignment" a
        JOIN "AttendancePolicy" p ON p.id = a."policyId"
        WHERE a."employeeId" = target_employee_id
          AND a."cancelledAt" IS NULL
          AND at_time >= (a."effectiveFrom"::timestamp AT TIME ZONE p."timeZone")
        ORDER BY a."effectiveFrom" DESC
        LIMIT 1
    )
    SELECT a.id, LEAST((at_time AT TIME ZONE a."timeZone")::date, a."effectiveUntil" - 1)
    FROM latest_started a
    WHERE a."effectiveUntil" IS NULL
       OR at_time < attendance_assignment_end_at(target_employee_id, a."effectiveUntil", a."timeZone")
$$;
