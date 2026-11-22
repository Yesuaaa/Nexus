CREATE TYPE "AttendanceScheduleMode" AS ENUM ('FLEXIBLE', 'FIXED');

ALTER TABLE "AttendancePolicy"
    ADD COLUMN "scheduleMode" "AttendanceScheduleMode" NOT NULL DEFAULT 'FLEXIBLE';

ALTER TABLE "AttendancePolicyDay"
    ADD COLUMN "scheduledStartMinute" INTEGER,
    ADD COLUMN "scheduledEndMinute" INTEGER,
    ADD COLUMN "scheduledUnpaidBreakMinutes" INTEGER,
    ADD CONSTRAINT attendance_policy_day_schedule CHECK (
        ("scheduledStartMinute" IS NULL AND "scheduledEndMinute" IS NULL
            AND "scheduledUnpaidBreakMinutes" IS NULL)
        OR (
            "isWorkingDay"
            AND "scheduledStartMinute" IS NOT NULL AND "scheduledEndMinute" IS NOT NULL
            AND "scheduledUnpaidBreakMinutes" IS NOT NULL
            AND "scheduledStartMinute" BETWEEN 0 AND 1439 AND "scheduledEndMinute" BETWEEN 0 AND 1439
            AND "scheduledStartMinute" <> "scheduledEndMinute"
            AND "scheduledUnpaidBreakMinutes" >= 0 AND "requiredMinutes" > 0
            AND "requiredMinutes" = (("scheduledEndMinute" - "scheduledStartMinute" + 1440) % 1440)
                - "scheduledUnpaidBreakMinutes"
        )
    );

ALTER TABLE "AttendanceWorkday"
    ADD COLUMN "scheduledStartAt" TIMESTAMPTZ(3),
    ADD COLUMN "scheduledEndAt" TIMESTAMPTZ(3),
    ADD COLUMN "scheduledUnpaidBreakMinutes" INTEGER;

-- Resolve local shift boundaries with the same PostgreSQL timezone rules as assignment cutoffs.
CREATE FUNCTION attendance_schedule_at(work_date date, zone_name text, start_minute integer, end_minute integer)
RETURNS TABLE ("scheduledStartAt" timestamptz, "scheduledEndAt" timestamptz)
LANGUAGE sql STABLE STRICT AS $$
    WITH shift AS (
        SELECT start_minute AS starts, end_minute
            + CASE WHEN end_minute < start_minute THEN 1440 ELSE 0 END AS ends
    ), boundaries AS (
        SELECT (work_date::timestamp + make_interval(mins => starts)) AT TIME ZONE zone_name AS start_at,
            (work_date::timestamp + make_interval(mins => ends)) AT TIME ZONE zone_name AS end_at,
            ends - starts AS duration
        FROM shift
    )
    -- A spring-forward gap can move the resolved start beyond the resolved end.
    SELECT start_at, CASE WHEN end_at <= start_at THEN start_at + make_interval(mins => duration) ELSE end_at END
    FROM boundaries
$$;

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
    NEW."scheduledStartAt" := NULL;
    NEW."scheduledEndAt" := NULL;
    NEW."scheduledUnpaidBreakMinutes" := NULL;
    IF policy."scheduleMode" = 'FIXED' AND rule."isWorkingDay" THEN
        SELECT "scheduledStartAt", "scheduledEndAt" INTO STRICT NEW."scheduledStartAt", NEW."scheduledEndAt"
        FROM attendance_schedule_at(NEW."workDate", policy."timeZone", rule."scheduledStartMinute", rule."scheduledEndMinute");
        NEW."scheduledUnpaidBreakMinutes" := rule."scheduledUnpaidBreakMinutes";
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION attendance_policy_at(target_employee_id text, at_time timestamptz)
RETURNS TABLE ("assignmentId" text, "workDate" date) LANGUAGE sql STABLE AS $$
    WITH latest_started AS (
        SELECT a.id, a."effectiveFrom", a."effectiveUntil", a."policyId", p."timeZone", p."scheduleMode",
            (at_time AT TIME ZONE p."timeZone")::date AS local_day
        FROM "AttendancePolicyAssignment" a
        JOIN "AttendancePolicy" p ON p.id = a."policyId"
        WHERE a."employeeId" = target_employee_id
          AND a."cancelledAt" IS NULL
          AND at_time >= (a."effectiveFrom"::timestamp AT TIME ZONE p."timeZone")
        ORDER BY a."effectiveFrom" DESC
        LIMIT 1
    )
    SELECT a.id, CASE WHEN a.local_day > a."effectiveFrom"
        AND (a."effectiveUntil" IS NULL OR a.local_day < a."effectiveUntil")
        AND at_time < CASE WHEN recorded.id IS NOT NULL THEN recorded."scheduledEndAt" ELSE planned."scheduledEndAt" END
        THEN a.local_day - 1
        ELSE LEAST(a.local_day, a."effectiveUntil" - 1)
    END
    FROM latest_started a
    LEFT JOIN "AttendanceWorkday" recorded
        ON recorded."employeeId" = target_employee_id
        AND recorded."assignmentId" = a.id
        AND recorded."workDate" = a.local_day - 1
    LEFT JOIN "AttendancePolicyDay" rule
        ON rule."policyId" = a."policyId" AND rule.weekday = extract(dow FROM a.local_day - 1)
        AND a."scheduleMode" = 'FIXED' AND rule."scheduledEndMinute" < rule."scheduledStartMinute"
        AND recorded.id IS NULL
    LEFT JOIN LATERAL attendance_schedule_at(a.local_day - 1, a."timeZone", rule."scheduledStartMinute", rule."scheduledEndMinute")
        planned ON true
    WHERE a."effectiveUntil" IS NULL
       OR at_time < attendance_assignment_end_at(target_employee_id, a."effectiveUntil", a."timeZone")
$$;
