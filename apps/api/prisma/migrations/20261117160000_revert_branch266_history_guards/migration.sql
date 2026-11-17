-- Compensate branch 266's deployed migration without deleting history data.
-- Keep the original migration immutable so Prisma retains its deployed lineage.
DROP TRIGGER IF EXISTS account_management_history_immutable ON public."AccountManagementChange";
DROP TRIGGER IF EXISTS workforce_management_history_immutable ON public."WorkforceManagementChange";
-- RESTRICT is intentional: unexpected dependencies must stop this rollback.
DROP FUNCTION IF EXISTS public.reject_management_history_mutation();
