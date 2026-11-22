BEGIN;

CREATE FUNCTION guard_approved_payroll_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'APPROVED' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Approved payroll runs are immutable' USING ERRCODE = '23514';
        END IF;
        IF (to_jsonb(OLD) - 'updatedAt') IS DISTINCT FROM (to_jsonb(NEW) - 'updatedAt') THEN
            RAISE EXCEPTION 'Approved payroll runs are immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION guard_approved_payroll_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    snapshot jsonb;
    parent_key text;
    parent_id text;
    run_id text;
    run_status "PayrollRunStatus";
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'PayrollRunCalculation' THEN parent_key := 'runId';
        WHEN 'PayrollRunItem' THEN parent_key := 'calculationId';
        WHEN 'PayrollRunItemComponent' THEN parent_key := 'itemId';
    END CASE;
    IF TG_OP = 'INSERT' THEN snapshot := to_jsonb(NEW);
    ELSE snapshot := to_jsonb(OLD);
    END IF;
    parent_id := snapshot->>parent_key;
    IF TG_OP = 'UPDATE' AND parent_id IS DISTINCT FROM (to_jsonb(NEW)->>parent_key) THEN
        RAISE EXCEPTION 'Payroll snapshot records cannot change parent' USING ERRCODE = '23514';
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'PayrollRunCalculation' THEN run_id := parent_id;
        WHEN 'PayrollRunItem' THEN
            SELECT c."runId" INTO run_id FROM "PayrollRunCalculation" c WHERE c.id = parent_id;
        WHEN 'PayrollRunItemComponent' THEN
            SELECT c."runId" INTO run_id FROM "PayrollRunItem" i
            JOIN "PayrollRunCalculation" c ON c.id = i."calculationId"
            WHERE i.id = parent_id;
    END CASE;

    -- Approval locks the same parent row before reading the revision.
    SELECT r.status INTO run_status FROM "PayrollRun" r WHERE r.id = run_id FOR UPDATE;
    IF run_status = 'APPROVED' THEN
        RAISE EXCEPTION 'Approved payroll snapshots are immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_approved_run_guard BEFORE UPDATE OR DELETE ON "PayrollRun"
    FOR EACH ROW EXECUTE FUNCTION guard_approved_payroll_run();
CREATE TRIGGER payroll_approved_calculation_guard BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunCalculation"
    FOR EACH ROW EXECUTE FUNCTION guard_approved_payroll_snapshot();
CREATE TRIGGER payroll_approved_item_guard BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunItem"
    FOR EACH ROW EXECUTE FUNCTION guard_approved_payroll_snapshot();
CREATE TRIGGER payroll_approved_component_guard BEFORE INSERT OR UPDATE OR DELETE ON "PayrollRunItemComponent"
    FOR EACH ROW EXECUTE FUNCTION guard_approved_payroll_snapshot();

COMMIT;
