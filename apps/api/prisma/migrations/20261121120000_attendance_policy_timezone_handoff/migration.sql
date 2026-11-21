-- Adjacent assignments share the incoming policy's midnight. An assignment
-- without a successor on its end date still ends in its own timezone.
CREATE FUNCTION attendance_assignment_end_at(target_employee_id text, end_date date, outgoing_zone text)
RETURNS timestamptz LANGUAGE sql STABLE STRICT AS $$
    SELECT end_date::timestamp AT TIME ZONE COALESCE((
        SELECT p."timeZone"
        FROM "AttendancePolicyAssignment" next_assignment
        JOIN "AttendancePolicy" p ON p.id = next_assignment."policyId"
        WHERE next_assignment."employeeId" = target_employee_id
          AND next_assignment."effectiveFrom" = end_date
    ), outgoing_zone)
$$;

CREATE FUNCTION attendance_policy_at(target_employee_id text, at_time timestamptz)
RETURNS TABLE ("assignmentId" text, "workDate" date) LANGUAGE sql STABLE AS $$
    WITH latest_started AS (
        SELECT a.id, a."effectiveUntil", p."timeZone"
        FROM "AttendancePolicyAssignment" a
        JOIN "AttendancePolicy" p ON p.id = a."policyId"
        WHERE a."employeeId" = target_employee_id
          AND at_time >= (a."effectiveFrom"::timestamp AT TIME ZONE p."timeZone")
        ORDER BY a."effectiveFrom" DESC
        LIMIT 1
    )
    -- If the outgoing local date has rolled over before the handoff, keep
    -- punches on its final workday so the stored assignment dates stay valid.
    SELECT a.id, LEAST((at_time AT TIME ZONE a."timeZone")::date, a."effectiveUntil" - 1)
    FROM latest_started a
    WHERE a."effectiveUntil" IS NULL
       OR at_time < attendance_assignment_end_at(target_employee_id, a."effectiveUntil", a."timeZone")
$$;

CREATE OR REPLACE FUNCTION attendance_session_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment_id text; local_day date;
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    IF TG_OP = 'UPDATE' AND (NEW."workdayId" <> OLD."workdayId" OR NEW."employeeId" <> OLD."employeeId") THEN
        RAISE EXCEPTION 'Session employee and workday are immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW."workdayId" IS NULL THEN
        SELECT selected."assignmentId", selected."workDate" INTO assignment_id, local_day
        FROM attendance_policy_at(NEW."employeeId", NEW."startedAt") selected;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'A unique effective policy is required' USING ERRCODE = '23514';
        END IF;
        SELECT id INTO NEW."workdayId" FROM "AttendanceWorkday"
            WHERE "employeeId" = NEW."employeeId" AND "workDate" = local_day;
        IF NEW."workdayId" IS NULL THEN
            NEW."workdayId" := gen_random_uuid()::text;
            INSERT INTO "AttendanceWorkday" (id, "employeeId", "assignmentId", "workDate", "timeZone", "isWorkingDay", "requiredMinutes")
                VALUES (NEW."workdayId", NEW."employeeId", assignment_id, local_day, '', false, 0);
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "AttendanceWorkday" WHERE id = NEW."workdayId" AND "employeeId" = NEW."employeeId") THEN
        RAISE EXCEPTION 'Workday must belong to the employee' USING ERRCODE = '23514';
    END IF;
    IF NEW."endedAt" IS NOT NULL AND NEW."endedAt" <= NEW."startedAt" THEN
        RAISE EXCEPTION 'Session end must follow its start' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendanceWorkSession" s WHERE s."employeeId" = NEW."employeeId" AND s.id <> NEW.id
        AND tstzrange(s."startedAt", s."endedAt", '[)') && tstzrange(NEW."startedAt", NEW."endedAt", '[)')) THEN
        RAISE EXCEPTION 'Attendance sessions overlap' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendanceBreak" b WHERE b."sessionId" = NEW.id
        AND (b."startedAt" < NEW."startedAt" OR (NEW."endedAt" IS NOT NULL AND (b."endedAt" IS NULL OR b."endedAt" > NEW."endedAt")))) THEN
        RAISE EXCEPTION 'Session would exclude a break' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
