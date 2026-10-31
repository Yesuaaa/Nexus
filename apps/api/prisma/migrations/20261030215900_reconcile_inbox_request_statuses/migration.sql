-- The inbox migration can introduce UNDER_REVIEW before the client portal
-- renames IN_PROGRESS to that label. Reconcile that combined history first,
-- without changing either branch's existing migrations.
DO $migration$
DECLARE
  status_column RECORD;
  saved_default TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND lower(enumlabel) = 'in_progress'
  ) AND EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = to_regtype('"ServiceRequestStatus"')
      AND enumlabel = 'UNDER_REVIEW'
  ) THEN
    ALTER TYPE "ServiceRequestStatus" RENAME TO "InboxLegacyRequestStatus";
    CREATE TYPE "ServiceRequestStatus" AS ENUM (
      'SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CLIENT_INFO',
      'READY_FOR_QUOTATION', 'CLOSED', 'CANCELLED'
    );

    -- Include history columns when they exist, preserving nulls and defaults.
    FOR status_column IN
      SELECT n.nspname AS schema_name, c.relname AS table_name,
             a.attname AS column_name, pg_get_expr(d.adbin, d.adrelid) AS default_expression
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.atttypid = to_regtype('"InboxLegacyRequestStatus"')
        AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind = 'r'
    LOOP
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT',
        status_column.schema_name, status_column.table_name, status_column.column_name);
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN %I TYPE "ServiceRequestStatus" USING
         (CASE lower(%I::text) WHEN ''pending'' THEN ''SUBMITTED''
          WHEN ''in_progress'' THEN ''UNDER_REVIEW'' WHEN ''completed'' THEN ''CLOSED''
          ELSE upper(%I::text) END)::"ServiceRequestStatus"',
        status_column.schema_name, status_column.table_name, status_column.column_name,
        status_column.column_name, status_column.column_name);
      IF status_column.default_expression IS NOT NULL THEN
        saved_default := replace(status_column.default_expression, '"InboxLegacyRequestStatus"', '"ServiceRequestStatus"');
        saved_default := replace(saved_default, '''PENDING''', '''SUBMITTED''');
        saved_default := replace(saved_default, '''IN_PROGRESS''', '''UNDER_REVIEW''');
        saved_default := replace(saved_default, '''COMPLETED''', '''CLOSED''');
        saved_default := replace(saved_default, '''pending''', '''SUBMITTED''');
        saved_default := replace(saved_default, '''in_progress''', '''UNDER_REVIEW''');
        saved_default := replace(saved_default, '''completed''', '''CLOSED''');
        saved_default := replace(saved_default, '''cancelled''', '''CANCELLED''');
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
          status_column.schema_name, status_column.table_name, status_column.column_name, saved_default);
      END IF;
    END LOOP;
    DROP TYPE "InboxLegacyRequestStatus";
  END IF;
END
$migration$;
