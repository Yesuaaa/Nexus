CREATE OR REPLACE FUNCTION guard_payroll_payslip() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payslips are retained for payroll history';
  END IF;

  IF OLD."publishedAt" IS NULL AND NEW."publishedAt" IS NULL
    AND (to_jsonb(OLD) - ARRAY['document','generatedAt','generatedBy']) =
        (to_jsonb(NEW) - ARRAY['document','generatedAt','generatedBy']) THEN
    RETURN NEW;
  END IF;

  IF OLD."publishedAt" IS NOT NULL
    OR NEW."publishedAt" IS NULL
    OR (to_jsonb(OLD) - ARRAY['publishedAt','publishedBy']) <>
       (to_jsonb(NEW) - ARRAY['publishedAt','publishedBy']) THEN
    RAISE EXCEPTION 'Payslip documents are immutable';
  END IF;
  RETURN NEW;
END;
$$;
