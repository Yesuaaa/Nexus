-- CreateTable
CREATE TABLE "AttendancePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePolicyDay" (
    "policyId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL,
    "requiredMinutes" INTEGER NOT NULL,

    CONSTRAINT "AttendancePolicyDay_pkey" PRIMARY KEY ("policyId","weekday")
);

-- CreateTable
CREATE TABLE "AttendancePolicyAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveUntil" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceWorkday" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "timeZone" TEXT NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL,
    "requiredMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceWorkday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceWorkSession" (
    "id" TEXT NOT NULL,
    "workdayId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AttendanceWorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceBreak" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttendanceBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAudit" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "employeeId" TEXT,
    "workdayId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendancePolicyAssignment_employeeId_effectiveFrom_idx" ON "AttendancePolicyAssignment"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePolicyAssignment_id_employeeId_key" ON "AttendancePolicyAssignment"("id", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceWorkday_employeeId_workDate_key" ON "AttendanceWorkday"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceWorkday_id_employeeId_key" ON "AttendanceWorkday"("id", "employeeId");

-- CreateIndex
CREATE INDEX "AttendanceWorkSession_workdayId_startedAt_idx" ON "AttendanceWorkSession"("workdayId", "startedAt");

-- CreateIndex
CREATE INDEX "AttendanceWorkSession_employeeId_startedAt_idx" ON "AttendanceWorkSession"("employeeId", "startedAt");

-- CreateIndex
CREATE INDEX "AttendanceBreak_sessionId_startedAt_idx" ON "AttendanceBreak"("sessionId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAudit_actionId_key" ON "AttendanceAudit"("actionId");

-- CreateIndex
CREATE INDEX "AttendanceAudit_workdayId_createdAt_idx" ON "AttendanceAudit"("workdayId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceAudit_employeeId_createdAt_idx" ON "AttendanceAudit"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceAudit_entityType_entityId_createdAt_idx" ON "AttendanceAudit"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "AttendancePolicyDay" ADD CONSTRAINT "AttendancePolicyDay_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicyAssignment" ADD CONSTRAINT "AttendancePolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendancePolicyAssignment" ADD CONSTRAINT "AttendancePolicyAssignment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceWorkday" ADD CONSTRAINT "AttendanceWorkday_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceWorkday" ADD CONSTRAINT "AttendanceWorkday_assignmentId_employeeId_fkey" FOREIGN KEY ("assignmentId", "employeeId") REFERENCES "AttendancePolicyAssignment"("id", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceWorkSession" ADD CONSTRAINT "AttendanceWorkSession_workdayId_employeeId_fkey" FOREIGN KEY ("workdayId", "employeeId") REFERENCES "AttendanceWorkday"("id", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceBreak" ADD CONSTRAINT "AttendanceBreak_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceWorkSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_workdayId_fkey" FOREIGN KEY ("workdayId") REFERENCES "AttendanceWorkday"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Daily targets are independent of clock-in time. Explicit rest days require zero minutes.
ALTER TABLE "AttendancePolicy" ADD CONSTRAINT "attendance_policy_name" CHECK (length(trim("name")) BETWEEN 1 AND 100);
ALTER TABLE "AttendancePolicyDay"
    ADD CONSTRAINT "attendance_weekday" CHECK ("weekday" BETWEEN 0 AND 6),
    ADD CONSTRAINT "attendance_daily_minutes" CHECK ("requiredMinutes" BETWEEN 0 AND 1440),
    ADD CONSTRAINT "attendance_rest_day" CHECK ("isWorkingDay" OR "requiredMinutes" = 0);
ALTER TABLE "AttendancePolicyAssignment" ADD CONSTRAINT "attendance_assignment_dates"
    CHECK (isfinite("effectiveFrom") AND ("effectiveUntil" IS NULL OR (isfinite("effectiveUntil") AND "effectiveUntil" > "effectiveFrom")));
ALTER TABLE "AttendanceWorkday" ADD CONSTRAINT "attendance_workday_values"
    CHECK (isfinite("workDate") AND "requiredMinutes" BETWEEN 0 AND 1440 AND ("isWorkingDay" OR "requiredMinutes" = 0));
ALTER TABLE "AttendanceWorkSession" ADD CONSTRAINT "attendance_session_times"
    CHECK (isfinite("startedAt") AND ("endedAt" IS NULL OR (isfinite("endedAt") AND "endedAt" > "startedAt")));
ALTER TABLE "AttendanceBreak" ADD CONSTRAINT "attendance_break_times"
    CHECK (isfinite("startedAt") AND ("endedAt" IS NULL OR (isfinite("endedAt") AND "endedAt" > "startedAt")));
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "attendance_audit_values"
    CHECK (length(trim("reason")) > 0 AND length(trim("action")) > 0 AND length(trim("entityId")) > 0
        AND "entityType" IN ('AttendancePolicy', 'AttendancePolicyDay', 'AttendancePolicyAssignment', 'AttendanceWorkday', 'AttendanceWorkSession', 'AttendanceBreak'));

-- READ COMMITTED refreshes queries after the lock wait; SERIALIZABLE detects stale
-- decisions. REPEATABLE READ would allow write skew with trigger-based range checks.
CREATE FUNCTION attendance_write_isolation() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('transaction_isolation') = 'repeatable read' THEN
        RAISE EXCEPTION 'Attendance writes require ReadCommitted or Serializable transactions' USING ERRCODE = '23514';
    END IF;
END $$;

CREATE FUNCTION attendance_lock_employee(employee_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    PERFORM attendance_write_isolation();
    PERFORM 1 FROM "Employee" WHERE id = employee_id FOR UPDATE;
END $$;

CREATE FUNCTION attendance_policy_timezone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."timeZone") THEN
        RAISE EXCEPTION 'Invalid attendance timezone' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_policy_timezone BEFORE INSERT OR UPDATE ON "AttendancePolicy"
    FOR EACH ROW EXECUTE FUNCTION attendance_policy_timezone();

-- Assigned policies are immutable versions. New requirements use a new policy and
-- an adjacent [effectiveFrom, effectiveUntil) assignment; no existing HR data changes.
CREATE FUNCTION attendance_policy_preserve() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_id text;
BEGIN
    PERFORM attendance_write_isolation();
    IF TG_TABLE_NAME = 'AttendancePolicy' THEN
        policy_id := OLD.id;
    ELSIF TG_OP = 'INSERT' THEN
        policy_id := NEW."policyId";
    ELSE
        policy_id := OLD."policyId";
        IF TG_OP = 'UPDATE' AND NEW."policyId" <> OLD."policyId" THEN
            RAISE EXCEPTION 'Create a new weekday rule instead of moving it' USING ERRCODE = '23514';
        END IF;
    END IF;
    PERFORM 1 FROM "AttendancePolicy" WHERE id = policy_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM "AttendancePolicyAssignment" WHERE "policyId" = policy_id) THEN
        RAISE EXCEPTION 'Assigned attendance policy is immutable; create a new version' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_policy_preserve BEFORE UPDATE OR DELETE ON "AttendancePolicy"
    FOR EACH ROW EXECUTE FUNCTION attendance_policy_preserve();
CREATE TRIGGER attendance_rule_preserve BEFORE INSERT OR UPDATE OR DELETE ON "AttendancePolicyDay"
    FOR EACH ROW EXECUTE FUNCTION attendance_policy_preserve();

CREATE FUNCTION attendance_assignment_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    PERFORM 1 FROM "AttendancePolicy" WHERE id = NEW."policyId" FOR UPDATE;
    IF (SELECT count(*) FROM "AttendancePolicyDay" WHERE "policyId" = NEW."policyId") <> 7 THEN
        RAISE EXCEPTION 'Configure all seven weekdays before assigning a policy' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW."employeeId" <> OLD."employeeId" OR NEW."policyId" <> OLD."policyId" OR NEW."effectiveFrom" <> OLD."effectiveFrom") THEN
        RAISE EXCEPTION 'Create a new policy assignment instead' USING ERRCODE = '23514';
    END IF;
    IF NEW."effectiveUntil" IS NOT NULL AND NEW."effectiveUntil" <= NEW."effectiveFrom" THEN
        RAISE EXCEPTION 'Assignment end must follow its start' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendancePolicyAssignment" a
        WHERE a."employeeId" = NEW."employeeId" AND a.id <> NEW.id
        AND daterange(a."effectiveFrom", a."effectiveUntil", '[)') && daterange(NEW."effectiveFrom", NEW."effectiveUntil", '[)')) THEN
        RAISE EXCEPTION 'Attendance assignments overlap' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendanceWorkday" WHERE "assignmentId" = NEW.id
        AND NEW."effectiveUntil" IS NOT NULL AND "workDate" >= NEW."effectiveUntil") THEN
        RAISE EXCEPTION 'Assignment would exclude recorded workdays' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_assignment_valid BEFORE INSERT OR UPDATE ON "AttendancePolicyAssignment"
    FOR EACH ROW EXECUTE FUNCTION attendance_assignment_check();

CREATE FUNCTION attendance_day_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment "AttendancePolicyAssignment"%ROWTYPE; rule "AttendancePolicyDay"%ROWTYPE;
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    SELECT * INTO STRICT assignment FROM "AttendancePolicyAssignment"
        WHERE id = NEW."assignmentId" AND "employeeId" = NEW."employeeId" FOR SHARE;
    IF NEW."workDate" < assignment."effectiveFrom" OR (assignment."effectiveUntil" IS NOT NULL AND NEW."workDate" >= assignment."effectiveUntil") THEN
        RAISE EXCEPTION 'Workday outside policy assignment' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT rule FROM "AttendancePolicyDay"
        WHERE "policyId" = assignment."policyId" AND weekday = extract(dow FROM NEW."workDate");
    SELECT "timeZone" INTO NEW."timeZone" FROM "AttendancePolicy" WHERE id = assignment."policyId";
    NEW."requiredMinutes" := rule."requiredMinutes";
    NEW."isWorkingDay" := rule."isWorkingDay";
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_day_defaults BEFORE INSERT ON "AttendanceWorkday"
    FOR EACH ROW EXECUTE FUNCTION attendance_day_snapshot();

CREATE FUNCTION attendance_day_preserve() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Attendance workday snapshots are immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER attendance_day_preserve BEFORE UPDATE ON "AttendanceWorkday"
    FOR EACH ROW EXECUTE FUNCTION attendance_day_preserve();

CREATE FUNCTION attendance_session_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate record; assignment_id text; local_day date; found_candidates integer := 0;
BEGIN
    PERFORM attendance_lock_employee(NEW."employeeId");
    IF TG_OP = 'UPDATE' AND (NEW."workdayId" <> OLD."workdayId" OR NEW."employeeId" <> OLD."employeeId") THEN
        RAISE EXCEPTION 'Session employee and workday are immutable' USING ERRCODE = '23514';
    END IF;
    -- No fixed start window. Default attribution follows the start instant in the
    -- effective policy zone, retaining both complete timestamps unchanged.
    IF NEW."workdayId" IS NULL THEN
        FOR candidate IN SELECT a.id, (NEW."startedAt" AT TIME ZONE p."timeZone")::date AS day
            FROM "AttendancePolicyAssignment" a JOIN "AttendancePolicy" p ON p.id = a."policyId"
            WHERE a."employeeId" = NEW."employeeId"
            AND (NEW."startedAt" AT TIME ZONE p."timeZone")::date >= a."effectiveFrom"
            AND (a."effectiveUntil" IS NULL OR (NEW."startedAt" AT TIME ZONE p."timeZone")::date < a."effectiveUntil")
        LOOP
            found_candidates := found_candidates + 1;
            assignment_id := candidate.id;
            local_day := candidate.day;
        END LOOP;
        IF found_candidates <> 1 THEN
            RAISE EXCEPTION 'A unique effective policy is required; specify a workday for ambiguous timezone transitions' USING ERRCODE = '23514';
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
CREATE TRIGGER attendance_session_valid BEFORE INSERT OR UPDATE ON "AttendanceWorkSession"
    FOR EACH ROW EXECUTE FUNCTION attendance_session_check();

CREATE FUNCTION attendance_break_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session "AttendanceWorkSession"%ROWTYPE;
BEGIN
    PERFORM attendance_write_isolation();
    IF TG_OP = 'UPDATE' AND NEW."sessionId" <> OLD."sessionId" THEN
        RAISE EXCEPTION 'Break session is immutable' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO STRICT session FROM "AttendanceWorkSession" WHERE id = NEW."sessionId" FOR UPDATE;
    IF NEW."startedAt" < session."startedAt" OR (session."endedAt" IS NOT NULL AND (NEW."endedAt" IS NULL OR NEW."endedAt" > session."endedAt")) THEN
        RAISE EXCEPTION 'Break outside session' USING ERRCODE = '23514';
    END IF;
    IF NEW."endedAt" IS NOT NULL AND NEW."endedAt" <= NEW."startedAt" THEN
        RAISE EXCEPTION 'Break end must follow its start' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM "AttendanceBreak" b WHERE b."sessionId" = NEW."sessionId" AND b.id <> NEW.id
        AND tstzrange(b."startedAt", b."endedAt", '[)') && tstzrange(NEW."startedAt", NEW."endedAt", '[)')) THEN
        RAISE EXCEPTION 'Attendance breaks overlap' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_break_valid BEFORE INSERT OR UPDATE ON "AttendanceBreak"
    FOR EACH ROW EXECUTE FUNCTION attendance_break_check();

-- Audit snapshots are automatic even for database-level writes. Future services
-- can supply actor/reason through transaction-local app.attendance_* settings.
CREATE FUNCTION attendance_record_audit() RETURNS trigger LANGUAGE plpgsql AS $$
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
    INSERT INTO "AttendanceAudit" (id, "entityType", "entityId", "employeeId", "workdayId", "actorId", action, reason, before, after, "actionId")
        VALUES (gen_random_uuid()::text, TG_TABLE_NAME, entity_id, employee_id, workday_id,
            nullif(current_setting('app.attendance_actor_id', true), ''), TG_OP,
            coalesce(nullif(current_setting('app.attendance_reason', true), ''), 'Database change'), previous, following, gen_random_uuid()::text);
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER attendance_policy_audit AFTER INSERT OR UPDATE OR DELETE ON "AttendancePolicy" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();
CREATE TRIGGER attendance_rule_audit AFTER INSERT OR UPDATE OR DELETE ON "AttendancePolicyDay" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();
CREATE TRIGGER attendance_assignment_audit AFTER INSERT OR UPDATE OR DELETE ON "AttendancePolicyAssignment" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();
CREATE TRIGGER attendance_workday_audit AFTER INSERT OR UPDATE ON "AttendanceWorkday" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();
CREATE TRIGGER attendance_session_audit AFTER INSERT OR UPDATE OR DELETE ON "AttendanceWorkSession" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();
CREATE TRIGGER attendance_break_audit AFTER INSERT OR UPDATE OR DELETE ON "AttendanceBreak" FOR EACH ROW EXECUTE FUNCTION attendance_record_audit();

CREATE FUNCTION attendance_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Attendance audit history is append-only' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER attendance_audit_preserve BEFORE UPDATE OR DELETE ON "AttendanceAudit"
    FOR EACH ROW EXECUTE FUNCTION attendance_audit_immutable();
