-- Append-only management history. Keep existing INSERT/SELECT and all identity
-- scalars unchanged; do not guess deployment-specific runtime/browser roles.
BEGIN;

CREATE FUNCTION public.reject_management_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Management history is append-only' USING ERRCODE = '23514';
END $$;
REVOKE ALL ON FUNCTION public.reject_management_history_mutation() FROM PUBLIC;

-- Statement triggers also reject empty UPDATE/DELETE and cover TRUNCATE,
-- which cannot be protected by the row triggers used by older history tables.
CREATE TRIGGER account_management_history_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public."AccountManagementChange"
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_management_history_mutation();

CREATE TRIGGER workforce_management_history_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public."WorkforceManagementChange"
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_management_history_mutation();

-- Do not let replication-role settings silently bypass these guards.
ALTER TABLE public."AccountManagementChange"
  ENABLE ALWAYS TRIGGER account_management_history_immutable;
ALTER TABLE public."WorkforceManagementChange"
  ENABLE ALWAYS TRIGGER workforce_management_history_immutable;

-- Owners/superusers can still disable/drop guards. The deployment runtime must
-- not own these tables/functions or inherit/SET ROLE to their owner. Effective
-- grants, RLS, browser access and privileged functions require Phase 2D.1B review.
COMMIT;
