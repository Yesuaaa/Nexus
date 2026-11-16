-- OPERATOR-ONLY catalog inspection; never an application startup/migration hook.
-- Read the Phase 2D.1B report before running. Use an explicitly authorized,
-- credential-managed psql connection, never a connection URL on the command line.
-- Inputs are ROLE NAMES, not passwords/keys. Outputs use aliases and object OIDs.
-- PostgreSQL 16 only: validated in disposable PostgreSQL 16.15. Other versions
-- require an adapted/revalidated pack; do not interpret missing output as a pass.
\set ON_ERROR_STOP on
\set VERBOSITY sqlstate
\set ECHO none
\pset pager off
\pset format unaligned
\pset tuples_only on
\if :{?runtime_role}
\else
  \set runtime_role ''
\endif
\if :{?migration_role}
\else
  \set migration_role ''
\endif
\if :{?history_owner_role}
\else
  \set history_owner_role ''
\endif
\if :{?database_owner_role}
\else
  \set database_owner_role ''
\endif
\if :{?service_role}
\else
  \set service_role ''
\endif
\if :{?browser_anon_role}
\else
  \set browser_anon_role ''
\endif
\if :{?browser_authenticated_role}
\else
  \set browser_authenticated_role ''
\endif

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL search_path = pg_catalog;
SELECT current_setting('server_version_num')::integer / 10000 = 16 AS supported_version \gset
\if :supported_version
WITH RECURSIVE
requested(alias, supplied_name) AS (VALUES
  ('runtime', :'runtime_role'), ('migration', :'migration_role'),
  ('history_owner', :'history_owner_role'), ('database_owner', :'database_owner_role'),
  ('service', :'service_role'), ('browser_anon', :'browser_anon_role'),
  ('browser_authenticated', :'browser_authenticated_role')
),
aliases AS (
  SELECT q.alias, CASE WHEN q.supplied_name = '' THEN 'not-supplied'
    WHEN r.oid IS NULL THEN 'not-found' ELSE 'found' END AS status,
    r.oid AS role_oid, r.rolsuper, r.rolinherit, r.rolcreaterole, r.rolcreatedb,
    r.rolcanlogin, r.rolreplication, r.rolbypassrls
  FROM requested q LEFT JOIN pg_roles r ON r.rolname = q.supplied_name
),
db AS (SELECT oid, datdba, datacl FROM pg_database WHERE datname = current_database()),
ns AS (SELECT oid, nspowner, nspacl FROM pg_namespace WHERE nspname = 'public'),
targets AS (
  SELECT c.oid, c.relname AS source_table, c.relowner, c.relacl, c.relkind,
    c.relrowsecurity, c.relforcerowsecurity, c.relispartition
  FROM pg_class c JOIN ns ON c.relnamespace = ns.oid
  WHERE c.relname IN ('AccountManagementChange', 'WorkforceManagementChange')
),
guard AS (
  SELECT p.oid, p.proowner, p.proacl, p.prosecdef,
    EXISTS (SELECT 1 FROM unnest(p.proconfig) config
      WHERE config IN ('search_path=', 'search_path=""')) AS empty_search_path
  FROM pg_proc p JOIN ns ON p.pronamespace = ns.oid
  WHERE p.proname = 'reject_management_history_mutation' AND p.pronargs = 0
),
contexts AS (
  SELECT a.alias, a.role_oid AS login_oid, r.oid AS context_oid,
    pg_has_role(a.role_oid, r.oid, 'USAGE') AS immediately_inherited,
    pg_has_role(a.role_oid, r.oid, 'SET') AS can_set_role,
    r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls, r.rolreplication,
    CASE WHEN r.rolname IN ('pg_database_owner', 'pg_read_all_data', 'pg_write_all_data',
      'pg_read_server_files', 'pg_write_server_files', 'pg_execute_server_program')
      THEN r.rolname::text ELSE NULL END AS known_capability
  FROM aliases a JOIN pg_roles r ON a.role_oid IS NOT NULL
    AND pg_has_role(a.role_oid, r.oid, 'MEMBER')
),
dependent_relations(root_oid, relation_oid) AS (
  SELECT oid, oid FROM targets
  UNION
  SELECT v.root_oid, c.oid FROM dependent_relations v
  JOIN pg_depend d ON d.refclassid = 'pg_class'::regclass AND d.refobjid = v.relation_oid
    AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_rewrite w ON w.oid = d.objid
  JOIN pg_class c ON c.oid = w.ev_class AND c.relkind IN ('v', 'm')
  WHERE c.oid <> v.relation_oid
),
rows(section, item) AS (
  SELECT 'roles', to_jsonb(a) FROM aliases a
  UNION ALL
  SELECT 'role_contexts', to_jsonb(c) FROM contexts c
  UNION ALL
  SELECT 'memberships', jsonb_build_object('alias', c.alias, 'member_oid', m.member,
    'role_oid', m.roleid, 'grantor_oid', m.grantor, 'admin_option', m.admin_option,
    'inherit_option', m.inherit_option, 'set_option', m.set_option)
  FROM contexts c JOIN pg_auth_members m ON m.member = c.context_oid
  UNION ALL
  SELECT 'ownership', jsonb_build_object('database_owner_oid', db.datdba,
    'public_schema_owner_oid', ns.nspowner) FROM db CROSS JOIN ns
  UNION ALL
  SELECT 'tables', to_jsonb(t) - 'relacl' FROM targets t
  UNION ALL
  SELECT 'guard_function', to_jsonb(g) - 'proacl' FROM guard g
  UNION ALL
  SELECT 'guards', jsonb_build_object('source_table', t.source_table,
    'trigger_oid', tr.oid, 'expected_name', tr.tgname,
    'enabled', tr.tgenabled, 'event_bits', tr.tgtype, 'has_condition', tr.tgqual IS NOT NULL,
    'argument_count', tr.tgnargs, 'expected_function', tr.tgfoid IN (SELECT oid FROM guard))
  FROM targets t JOIN pg_trigger tr ON tr.tgrelid = t.oid
  WHERE (t.source_table = 'AccountManagementChange' AND tr.tgname = 'account_management_history_immutable')
    OR (t.source_table = 'WorkforceManagementChange' AND tr.tgname = 'workforce_management_history_immutable')
  UNION ALL
  SELECT 'effective_table_access', jsonb_build_object('alias', c.alias, 'context_oid', c.context_oid,
    'immediately_inherited', c.immediately_inherited, 'can_set_role', c.can_set_role,
    'source_table', t.source_table,
    'select', has_table_privilege(c.context_oid, t.oid, 'SELECT'),
    'insert', has_table_privilege(c.context_oid, t.oid, 'INSERT'),
    'update', has_table_privilege(c.context_oid, t.oid, 'UPDATE'),
    'delete', has_table_privilege(c.context_oid, t.oid, 'DELETE'),
    'truncate', has_table_privilege(c.context_oid, t.oid, 'TRUNCATE'),
    'trigger', has_table_privilege(c.context_oid, t.oid, 'TRIGGER'),
    'references', has_table_privilege(c.context_oid, t.oid, 'REFERENCES'),
    'any_column_select', has_any_column_privilege(c.context_oid, t.oid, 'SELECT'),
    'any_column_insert', has_any_column_privilege(c.context_oid, t.oid, 'INSERT'),
    'any_column_update', has_any_column_privilege(c.context_oid, t.oid, 'UPDATE'),
    'inherits_table_owner', pg_has_role(c.context_oid, t.relowner, 'USAGE'),
    'can_set_table_owner', pg_has_role(c.context_oid, t.relowner, 'SET'))
  FROM contexts c CROSS JOIN targets t
  UNION ALL
  SELECT 'effective_infrastructure_access', jsonb_build_object('alias', c.alias,
    'context_oid', c.context_oid, 'immediately_inherited', c.immediately_inherited,
    'can_set_role', c.can_set_role,
    'schema_usage', has_schema_privilege(c.context_oid, ns.oid, 'USAGE'),
    'schema_create', has_schema_privilege(c.context_oid, ns.oid, 'CREATE'),
    'database_connect', has_database_privilege(c.context_oid, db.oid, 'CONNECT'),
    'database_create', has_database_privilege(c.context_oid, db.oid, 'CREATE'),
    'inherits_schema_owner', pg_has_role(c.context_oid, ns.nspowner, 'USAGE'),
    'can_set_schema_owner', pg_has_role(c.context_oid, ns.nspowner, 'SET'),
    'inherits_database_owner', pg_has_role(c.context_oid, db.datdba, 'USAGE'),
    'can_set_database_owner', pg_has_role(c.context_oid, db.datdba, 'SET'),
    'set_replication_role', has_parameter_privilege(c.context_oid, 'session_replication_role', 'SET'),
    'alter_system_replication_role', has_parameter_privilege(c.context_oid, 'session_replication_role', 'ALTER SYSTEM'))
  FROM contexts c CROSS JOIN db CROSS JOIN ns
  UNION ALL
  SELECT 'effective_guard_execute', jsonb_build_object('alias', c.alias,
    'context_oid', c.context_oid, 'function_oid', g.oid,
    'execute', has_function_privilege(c.context_oid, g.oid, 'EXECUTE'),
    'inherits_function_owner', pg_has_role(c.context_oid, g.proowner, 'USAGE'),
    'can_set_function_owner', pg_has_role(c.context_oid, g.proowner, 'SET'))
  FROM contexts c CROSS JOIN guard g
  UNION ALL
  SELECT 'object_acls', jsonb_build_object('kind', o.kind, 'object_oid', o.oid,
    'grantor_oid', a.grantor, 'grantee_oid', a.grantee, 'public', a.grantee = 0,
    'privilege', a.privilege_type, 'grantable', a.is_grantable)
  FROM (SELECT 'table' AS kind, oid, coalesce(relacl, acldefault('r', relowner)) acl FROM targets
    UNION ALL SELECT 'schema', oid, coalesce(nspacl, acldefault('n', nspowner)) FROM ns
    UNION ALL SELECT 'database', oid, coalesce(datacl, acldefault('d', datdba)) FROM db
    UNION ALL SELECT 'guard_function', oid, coalesce(proacl, acldefault('f', proowner)) FROM guard) o
  CROSS JOIN LATERAL aclexplode(o.acl) a
  UNION ALL
  SELECT 'column_acls', jsonb_build_object('source_table', t.source_table, 'column_number', col.attnum,
    'grantor_oid', a.grantor, 'grantee_oid', a.grantee, 'public', a.grantee = 0,
    'privilege', a.privilege_type, 'grantable', a.is_grantable)
  FROM targets t JOIN pg_attribute col ON col.attrelid = t.oid AND col.attnum > 0 AND NOT col.attisdropped
  CROSS JOIN LATERAL aclexplode(col.attacl) a
  UNION ALL
  SELECT 'default_acls', jsonb_build_object('creator_oid', d.defaclrole, 'schema_oid', d.defaclnamespace,
    'object_type', d.defaclobjtype, 'grantor_oid', a.grantor, 'grantee_oid', a.grantee,
    'public', a.grantee = 0, 'privilege', a.privilege_type, 'grantable', a.is_grantable)
  FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclnamespace = 0 OR d.defaclnamespace IN (SELECT oid FROM ns)
  UNION ALL
  SELECT 'policies', jsonb_build_object('source_table', t.source_table, 'policy_oid', p.oid,
    'command', p.polcmd, 'permissive', p.polpermissive, 'role_oids', p.polroles,
    'has_using', p.polqual IS NOT NULL, 'has_check', p.polwithcheck IS NOT NULL)
  FROM targets t JOIN pg_policy p ON p.polrelid = t.oid
  UNION ALL
  SELECT 'dependent_views', jsonb_build_object('source_table', t.source_table,
    'view_oid', v.oid, 'schema_oid', v.relnamespace, 'owner_oid', v.relowner,
    'kind', v.relkind, 'security_invoker', coalesce('security_invoker=true' = ANY(v.reloptions), false),
    'alias', c.alias, 'context_oid', c.context_oid,
    'select', has_table_privilege(c.context_oid, v.oid, 'SELECT'),
    'any_column_select', has_any_column_privilege(c.context_oid, v.oid, 'SELECT'))
  FROM dependent_relations d JOIN targets t ON t.oid = d.root_oid
  JOIN pg_class v ON v.oid = d.relation_oid AND v.oid <> t.oid CROSS JOIN contexts c
  UNION ALL
  SELECT 'callable_security_definers', jsonb_build_object('alias', c.alias,
    'context_oid', c.context_oid, 'function_oid', p.oid, 'schema_oid', p.pronamespace,
    'owner_oid', p.proowner, 'kind', p.prokind)
  FROM contexts c CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND has_schema_privilege(c.context_oid, n.oid, 'USAGE')
    AND has_function_privilege(c.context_oid, p.oid, 'EXECUTE')
  UNION ALL
  SELECT 'publications', jsonb_build_object('source_table', t.source_table, 'publication_oid', p.oid,
    'all_tables', p.puballtables, 'insert', p.pubinsert, 'update', p.pubupdate,
    'delete', p.pubdelete, 'truncate', p.pubtruncate)
  FROM targets t CROSS JOIN pg_publication p
  WHERE p.puballtables OR EXISTS (SELECT 1 FROM pg_publication_tables pt
    WHERE pt.pubname = p.pubname AND pt.schemaname = 'public' AND pt.tablename = t.source_table)
  UNION ALL
  SELECT 'locks', jsonb_build_object('source_table', t.source_table,
    'mode', l.mode, 'granted', l.granted, 'count', count(*))
  FROM targets t JOIN pg_locks l ON l.relation = t.oid AND l.database = (SELECT oid FROM db)
  GROUP BY t.source_table, l.mode, l.granted
),
ranked AS (SELECT section, item, row_number() OVER (PARTITION BY section ORDER BY item::text) position FROM rows),
sections(section) AS (VALUES ('roles'), ('role_contexts'), ('memberships'), ('ownership'),
  ('tables'), ('guard_function'), ('guards'), ('effective_table_access'), ('effective_infrastructure_access'),
  ('effective_guard_execute'), ('object_acls'), ('column_acls'), ('default_acls'), ('policies'),
  ('dependent_views'), ('callable_security_definers'), ('publications'), ('locks')),
grouped AS (
  SELECT s.section, jsonb_build_object('total', count(r.item), 'truncated', count(r.item) > 200,
    'items', coalesce(jsonb_agg(r.item ORDER BY r.item::text) FILTER (WHERE r.position <= 200), '[]'::jsonb)) data
  FROM sections s LEFT JOIN ranked r USING (section) GROUP BY s.section
)
SELECT jsonb_pretty(jsonb_build_object(
  'schemaVersion', 1, 'verification', 'operator-review-required',
  'serverVersionNumber', current_setting('server_version_num')::integer,
  'isRecovery', pg_is_in_recovery(),
  'transactionReadOnly', current_setting('transaction_read_only') = 'on',
  'observedAt', CURRENT_TIMESTAMP,
  'currentUserAliases', (SELECT coalesce(jsonb_agg(alias), '[]'::jsonb) FROM aliases WHERE role_oid = current_user::regrole::oid),
  'sessionUserAliases', (SELECT coalesce(jsonb_agg(alias), '[]'::jsonb) FROM aliases WHERE role_oid = session_user::regrole::oid),
  'inspectorSuperuser', (SELECT rolsuper FROM pg_roles WHERE rolname = current_user),
  'sessionTls', (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
  'expectedTableCount', 2, 'foundTableCount', (SELECT count(*) FROM targets),
  'migrationLedgerPresent', to_regclass('public._prisma_migrations') IS NOT NULL,
  'runtimeEqualsMigration', (SELECT r.role_oid = m.role_oid FROM aliases r CROSS JOIN aliases m WHERE r.alias = 'runtime' AND m.alias = 'migration'),
  'sections', (SELECT jsonb_object_agg(section, data) FROM grouped)
));
\else
  \echo Unsupported PostgreSQL major version. No privilege report produced; verification remains blocked.
\endif
ROLLBACK;
