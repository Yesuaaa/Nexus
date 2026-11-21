import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

import pg from "pg"
import { databasePoolConfig } from "./postgres-connection.js"

const guardMigration = "20261118160000_payroll_approved_snapshot_guard"
const expectedTriggers = [
  {
    name: "payroll_approved_run_guard",
    table: "PayrollRun",
    functionName: "guard_approved_payroll_run",
    eventType: 27,
  },
  {
    name: "payroll_approved_calculation_guard",
    table: "PayrollRunCalculation",
    functionName: "guard_approved_payroll_snapshot",
    eventType: 31,
  },
  {
    name: "payroll_approved_item_guard",
    table: "PayrollRunItem",
    functionName: "guard_approved_payroll_snapshot",
    eventType: 31,
  },
  {
    name: "payroll_approved_component_guard",
    table: "PayrollRunItemComponent",
    functionName: "guard_approved_payroll_snapshot",
    eventType: 31,
  },
] as const

const protectedTables = expectedTriggers.map(({ table }) => table)

export type PayrollAuditStatus =
  "PASS" | "FAIL" | "UNVERIFIED" | "NOT APPLICABLE"

export type PayrollAuditCheck = {
  id: string
  status: PayrollAuditStatus
  summary: string
  evidence: string[]
}

export type PayrollAuditReport = {
  generatedAt: string
  identity?: {
    currentUser: string
    sessionUser: string
    database: string
    serverVersion: string
    serverVersionNumber: number
  }
  checks: PayrollAuditCheck[]
  verdict: "PASS" | "FAIL" | "UNVERIFIED"
}

export interface PayrollAuditQueryClient {
  query(text: string): Promise<{ rows: Record<string, unknown>[] }>
}

type AuditRole = {
  rolname: string
  rolsuper: boolean
  rolbypassrls: boolean
  rolcreaterole: boolean
  rolcreatedb: boolean
  rolinherit: boolean
  rolreplication: boolean
}

type PayrollTable = {
  schema_name: string
  table_name: string
  owner_name: string
  row_security: boolean
  force_row_security: boolean
  can_select: boolean
  can_insert: boolean
  can_update: boolean
  can_delete: boolean
  can_truncate: boolean
  can_trigger: boolean
}

type TriggerRow = {
  schema_name: string
  table_name: string
  trigger_name: string
  enabled_state: string
  event_type: number
  function_name: string
  function_source: string
  function_owner: string
  security_definer: boolean
}

function check(
  id: string,
  status: PayrollAuditStatus,
  summary: string,
  evidence: string[] = [],
): PayrollAuditCheck {
  return { id, status, summary, evidence }
}

function codeOf(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9]{2,5}$/.test(error.code)
  ) {
    return error.code
  }
  return "unavailable"
}

function normalizeFunctionSource(source: string): string {
  return source.replace(/\r\n/g, "\n").trim()
}

function readExpectedGuardMigration(): {
  functions: Map<string, string>
  checksum?: string
} {
  try {
    const path = new URL(
      `../../prisma/migrations/${guardMigration}/migration.sql`,
      import.meta.url,
    )
    const migration = readFileSync(path, "utf8")
    const functions = new Map<string, string>()
    for (const name of [
      "guard_approved_payroll_run",
      "guard_approved_payroll_snapshot",
    ]) {
      const pattern = new RegExp(
        `CREATE\\s+FUNCTION\\s+${name}\\s*\\(\\s*\\)[\\s\\S]*?AS\\s+\\$\\$([\\s\\S]*?)\\$\\$\\s*;`,
        "i",
      )
      const body = migration.match(pattern)?.[1]
      if (!body) throw new Error("guard function missing from migration")
      functions.set(name, normalizeFunctionSource(body))
    }
    return {
      functions,
      checksum: createHash("sha256").update(migration).digest("hex"),
    }
  } catch {
    return { functions: new Map() }
  }
}

export function expectedPayrollGuardMigrationChecksum(): string | undefined {
  return readExpectedGuardMigration().checksum
}

function roleFlags(role: AuditRole): string[] {
  return [
    role.rolsuper && "SUPERUSER",
    role.rolbypassrls && "BYPASSRLS",
    role.rolcreaterole && "CREATEROLE",
    role.rolcreatedb && "CREATEDB",
    role.rolreplication && "REPLICATION",
  ].filter((flag): flag is string => Boolean(flag))
}

function effectivePrivilegesQuery(serverVersionNumber: number): string {
  const setRoleTest =
    serverVersionNumber >= 160000
      ? "pg_has_role(current_user, r.oid, 'SET')"
      : "pg_has_role(current_user, r.oid, 'MEMBER')"
  const sessionSetRoleTest =
    serverVersionNumber >= 160000
      ? "pg_has_role(session_user, r.oid, 'SET')"
      : "pg_has_role(session_user, r.oid, 'MEMBER')"
  return `
    SELECT r.rolname,
      pg_has_role(current_user, r.oid, 'MEMBER') AS current_is_member,
      ${setRoleTest} AS current_can_set_role,
      pg_has_role(current_user, r.oid, 'USAGE') AS current_inherits_privileges,
      pg_has_role(session_user, r.oid, 'MEMBER') AS session_is_member,
      ${sessionSetRoleTest} AS session_can_set_role,
      pg_has_role(session_user, r.oid, 'USAGE') AS session_inherits_privileges,
      r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb,
      r.rolreplication
    FROM pg_catalog.pg_roles r
    WHERE r.oid <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
      AND (
        pg_has_role(current_user, r.oid, 'MEMBER')
        OR pg_has_role(session_user, r.oid, 'MEMBER')
      )
    ORDER BY r.rolname
  `
}

/**
 * Audits only PostgreSQL catalogs inside a read-only transaction. The caller
 * owns connection creation and must provide an explicitly selected database.
 */
export async function auditPayrollDatabasePermissions(
  client: PayrollAuditQueryClient,
): Promise<PayrollAuditReport> {
  const checks: PayrollAuditCheck[] = []
  let transactionOpen = false

  try {
    await client.query("BEGIN READ ONLY")
    transactionOpen = true

    const identityResult = await client.query(`
      SELECT current_user::text AS current_user,
        session_user::text AS session_user,
        current_database()::text AS database,
        version()::text AS server_version,
        current_setting('server_version_num')::int AS server_version_number,
        current_setting('transaction_read_only')::boolean AS transaction_read_only,
        current_setting('default_transaction_read_only')::boolean AS default_read_only
    `)
    const identity = identityResult.rows[0]
    if (!identity) throw new Error("identity query returned no row")

    const currentUser = String(identity.current_user)
    const sessionUser = String(identity.session_user)
    const database = String(identity.database)
    const serverVersion = String(identity.server_version)
    const serverVersionNumber = Number(identity.server_version_number)
    const readOnly =
      identity.transaction_read_only === true &&
      identity.default_read_only === true

    checks.push(
      check(
        "connection-read-only",
        readOnly ? "PASS" : "FAIL",
        readOnly
          ? "The session default and active transaction are read-only."
          : "The connection did not confirm both read-only safeguards.",
        [
          `current_user=${currentUser}`,
          `session_user=${sessionUser}`,
          `database=${database}`,
          `postgresql=${serverVersionNumber}`,
          `transaction_read_only=${String(identity.transaction_read_only)}`,
          `default_transaction_read_only=${String(identity.default_read_only)}`,
        ],
      ),
    )
    if (!readOnly) {
      return finishReport(checks, {
        currentUser,
        sessionUser,
        database,
        serverVersion,
        serverVersionNumber,
      })
    }

    const roleResult = await safeProbe(
      client,
      "role-attributes",
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb,
          rolinherit, rolreplication
       FROM pg_catalog.pg_roles
       WHERE rolname IN (current_user, session_user)
       ORDER BY rolname`,
      checks,
    )
    const roleRows = (roleResult ?? []) as unknown as AuditRole[]
    if (!roleResult) {
      checks.push(
        check(
          "role-privileges",
          "UNVERIFIED",
          "Could not inspect active and login-role flags.",
        ),
      )
    } else {
      const activeNames = new Set([currentUser, sessionUser])
      const foundNames = new Set(roleRows.map((role) => role.rolname))
      const missing = [...activeNames].filter((name) => !foundNames.has(name))
      const elevated = roleRows.flatMap((role) =>
        roleFlags(role).map((flag) => `${role.rolname}:${flag}`),
      )
      const roleEvidence = roleRows.map(
        (role) =>
          `${role.rolname}: SUPERUSER=${role.rolsuper}; BYPASSRLS=${role.rolbypassrls}; CREATEROLE=${role.rolcreaterole}; CREATEDB=${role.rolcreatedb}; INHERIT=${role.rolinherit}; REPLICATION=${role.rolreplication}`,
      )
      const status = elevated.length
        ? "FAIL"
        : missing.length
          ? "UNVERIFIED"
          : "PASS"
      checks.push(
        check(
          "role-privileges",
          status,
          elevated.length
            ? "An active or login role has a high-risk PostgreSQL capability."
            : missing.length
              ? "Role metadata was unavailable for an active database identity."
              : "Active and login roles have no superuser, bypass, role-admin, database-admin, or replication flags.",
          [
            ...roleEvidence,
            ...elevated,
            ...missing.map((name) => `${name}: role metadata missing`),
          ],
        ),
      )
    }

    if (currentUser !== sessionUser) {
      checks.push(
        check(
          "active-role-context",
          "UNVERIFIED",
          "The active role differs from the login role; role-reset and connection-pool behavior need environment-specific review.",
          [`current_user=${currentUser}`, `session_user=${sessionUser}`],
        ),
      )
    } else {
      checks.push(
        check(
          "active-role-context",
          "PASS",
          "The active PostgreSQL role matches the login role; the audit did not switch roles.",
        ),
      )
    }

    const memberships = await safeProbe(
      client,
      "role-memberships",
      effectivePrivilegesQuery(serverVersionNumber),
      checks,
    )
    if (memberships) {
      const ownerRoles = await safeProbe(
        client,
        "payroll-owner-roles",
        `SELECT DISTINCT pg_get_userbyid(c.relowner) AS owner_name
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
           AND c.relname LIKE 'Payroll%' AND c.relkind IN ('r', 'p')
         UNION
         SELECT DISTINCT pg_get_userbyid(p.proowner) AS owner_name
         FROM pg_catalog.pg_proc p
         JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         WHERE p.proname IN ('guard_approved_payroll_run', 'guard_approved_payroll_snapshot')
         UNION
         SELECT DISTINCT pg_get_userbyid(n.nspowner) AS owner_name
         FROM pg_catalog.pg_namespace n
         JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
         WHERE c.relname LIKE 'Payroll%' AND c.relkind IN ('r', 'p')`,
        checks,
      )
      if (ownerRoles) {
        const ownerNames = new Set(
          (ownerRoles as unknown as { owner_name: string }[]).map(
            ({ owner_name }) => owner_name,
          ),
        )
        const dangerousMemberships = (
          memberships as unknown as {
            rolname: string
            current_can_set_role: boolean
            current_inherits_privileges: boolean
            session_can_set_role: boolean
            session_inherits_privileges: boolean
            rolsuper: boolean
            rolbypassrls: boolean
            rolcreaterole: boolean
            rolcreatedb: boolean
            rolreplication: boolean
          }[]
        ).filter((role) => {
          const hasHighRiskFlags =
            role.rolsuper ||
            role.rolbypassrls ||
            role.rolcreaterole ||
            role.rolcreatedb ||
            role.rolreplication
          const canAssumeOwner =
            ownerNames.has(role.rolname) &&
            (role.current_can_set_role ||
              role.current_inherits_privileges ||
              role.session_can_set_role ||
              role.session_inherits_privileges)
          const canUsePrivilegedRole =
            role.current_can_set_role ||
            role.current_inherits_privileges ||
            role.session_can_set_role ||
            role.session_inherits_privileges
          return (hasHighRiskFlags && canUsePrivilegedRole) || canAssumeOwner
        })
        checks.push(
          check(
            "privileged-memberships",
            dangerousMemberships.length ? "FAIL" : "PASS",
            dangerousMemberships.length
              ? "The active or login role can inherit or assume a privileged role or payroll object owner."
              : "No privileged or payroll-owner role membership path was found.",
            dangerousMemberships.map(({ rolname }) => rolname),
          ),
        )
      } else {
        checks.push(
          check(
            "privileged-memberships",
            "UNVERIFIED",
            "Payroll ownership paths could not be compared with role memberships.",
          ),
        )
      }
      if ((memberships as unknown[]).length === 0) {
        checks.push(
          check(
            "role-memberships",
            "PASS",
            "No other PostgreSQL role memberships are effective or assumable.",
          ),
        )
      } else {
        const roles = memberships as unknown as {
          rolname: string
          current_is_member: boolean
          current_inherits_privileges: boolean
          current_can_set_role: boolean
          session_is_member: boolean
          session_can_set_role: boolean
          session_inherits_privileges: boolean
        }[]
        checks.push(
          check(
            "role-memberships",
            "PASS",
            "Membership paths were enumerated; any high-risk or payroll-owner paths are classified separately.",
            roles.map(
              (role) =>
                `${role.rolname}: current_member=${role.current_is_member}, current_inherit=${role.current_inherits_privileges}, current_can_set=${role.current_can_set_role}, session_member=${role.session_is_member}, session_inherit=${role.session_inherits_privileges}, session_can_set=${role.session_can_set_role}`,
            ),
          ),
        )
      }
    } else {
      checks.push(
        check(
          "privileged-memberships",
          "UNVERIFIED",
          "Role membership paths could not be inspected.",
        ),
      )
    }

    const tableResult = await safeProbe(
      client,
      "payroll-tables",
      `SELECT n.nspname AS schema_name, c.relname AS table_name,
          pg_get_userbyid(c.relowner) AS owner_name,
          c.relrowsecurity AS row_security,
          c.relforcerowsecurity AS force_row_security,
          has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
          has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
          has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
          has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
          has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
          has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname LIKE 'Payroll%' AND c.relkind IN ('r', 'p')
       ORDER BY n.nspname, c.relname`,
      checks,
    )
    if (!tableResult) {
      checks.push(
        check(
          "financial-table-privileges",
          "UNVERIFIED",
          "Could not inspect Payroll table ownership and effective privileges.",
        ),
      )
      checks.push(
        check(
          "row-level-security",
          "UNVERIFIED",
          "Could not inspect Payroll table RLS state.",
        ),
      )
    } else {
      const tables = tableResult as unknown as PayrollTable[]
      const missingGuardTables = protectedTables.filter(
        (name) => !tables.some((table) => table.table_name === name),
      )
      const owners = tables.filter(
        (table) =>
          table.owner_name === currentUser || table.owner_name === sessionUser,
      )
      const truncatable = tables.filter((table) => table.can_truncate)
      const triggerCreators = tables.filter((table) => table.can_trigger)
      const schemaRows = await safeProbe(
        client,
        "payroll-schema-privileges",
        `SELECT DISTINCT n.nspname AS schema_name,
           pg_get_userbyid(n.nspowner) AS owner_name,
           has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create,
           has_schema_privilege(current_user, n.oid, 'USAGE') AS can_use,
           (n.nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
             OR n.nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = session_user)) AS owns_schema
         FROM pg_catalog.pg_namespace n
         JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid
         WHERE c.relname LIKE 'Payroll%' AND c.relkind IN ('r', 'p')
         ORDER BY n.nspname`,
        checks,
      )
      const schemaList = (schemaRows ?? []) as unknown as {
        schema_name: string
        owner_name: string
        can_create: boolean
        can_use: boolean
        owns_schema: boolean
      }[]
      const databaseCreate = await safeProbe(
        client,
        "database-create-privilege",
        `SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS can_create`,
        checks,
      )
      const canCreateDatabaseObjects =
        (databaseCreate as unknown as { can_create: boolean }[] | null)?.[0]
          ?.can_create ?? false
      const riskySchema = schemaList.filter(
        (schema) => schema.can_create || schema.owns_schema,
      )
      const ownerMemberships = (memberships ?? []) as unknown as {
        rolname: string
        current_can_set_role: boolean
        current_inherits_privileges: boolean
        session_can_set_role: boolean
        session_inherits_privileges: boolean
        rolsuper: boolean
        rolbypassrls: boolean
        rolcreaterole: boolean
        rolcreatedb: boolean
        rolreplication: boolean
      }[]
      const assumableOwners = new Set(
        ownerMemberships
          .filter(
            (role) =>
              role.current_can_set_role ||
              role.current_inherits_privileges ||
              role.session_can_set_role ||
              role.session_inherits_privileges,
          )
          .map(({ rolname }) => rolname),
      )
      const inheritedObjectOwners = tables.filter((table) =>
        assumableOwners.has(table.owner_name),
      )
      const ownershipIssue =
        owners.length > 0 || inheritedObjectOwners.length > 0
      const dangerousRights =
        missingGuardTables.length > 0 ||
        ownershipIssue ||
        truncatable.length > 0 ||
        triggerCreators.length > 0 ||
        riskySchema.length > 0 ||
        canCreateDatabaseObjects
      checks.push(
        check(
          "financial-table-privileges",
          dangerousRights ? "FAIL" : "PASS",
          dangerousRights
            ? "The role can alter protected objects, truncate Payroll records, add triggers, create objects in a protected schema/database, or required tables are missing."
            : "Payroll objects are not owned or alterable by the runtime role; no TRUNCATE or trigger-creation privilege was found.",
          [
            ...tables.map(
              (table) =>
                `${table.schema_name}.${table.table_name}: owner=${table.owner_name}; SELECT=${table.can_select}; INSERT=${table.can_insert}; UPDATE=${table.can_update}; DELETE=${table.can_delete}; TRUNCATE=${table.can_truncate}; TRIGGER=${table.can_trigger}`,
            ),
            ...missingGuardTables.map(
              (name) => `missing required table: ${name}`,
            ),
            ...owners.map(
              (table) =>
                `direct owner: ${table.schema_name}.${table.table_name}`,
            ),
            ...inheritedObjectOwners.map(
              (table) =>
                `assumable owner ${table.owner_name}: ${table.schema_name}.${table.table_name}`,
            ),
            ...truncatable.map(
              (table) =>
                `TRUNCATE granted: ${table.schema_name}.${table.table_name}`,
            ),
            ...triggerCreators.map(
              (table) =>
                `TRIGGER granted: ${table.schema_name}.${table.table_name}`,
            ),
            ...riskySchema.map(
              (schema) =>
                `schema ${schema.schema_name}: owner=${schema.owner_name}; CREATE=${schema.can_create}`,
            ),
            ...(canCreateDatabaseObjects
              ? ["CREATE privilege on database"]
              : []),
          ],
        ),
      )

      const rlsTables = tables.filter((table) => table.row_security)
      if (rlsTables.length === 0) {
        checks.push(
          check(
            "row-level-security",
            "NOT APPLICABLE",
            "Row-level security is not enabled on the inspected Payroll tables; application authorization remains the boundary.",
          ),
        )
      } else {
        const currentFlags = roleRows.find(
          (role) => role.rolname === currentUser,
        )
        const bypass =
          currentFlags?.rolbypassrls ||
          ownerMemberships.some(
            (role) =>
              role.rolbypassrls &&
              (role.current_inherits_privileges ||
                role.current_can_set_role ||
                role.session_inherits_privileges ||
                role.session_can_set_role),
          )
        const ownerNotForced = rlsTables.filter(
          (table) =>
            !table.force_row_security &&
            (table.owner_name === currentUser ||
              table.owner_name === sessionUser ||
              assumableOwners.has(table.owner_name)),
        )
        const policies = await safeProbe(
          client,
          "payroll-rls-policies",
          `SELECT schemaname, tablename, policyname, permissive, roles, cmd
           FROM pg_catalog.pg_policies
           WHERE tablename LIKE 'Payroll%'
           ORDER BY schemaname, tablename, policyname`,
          checks,
        )
        checks.push(
          check(
            "row-level-security",
            bypass || ownerNotForced.length
              ? "FAIL"
              : policies
                ? "PASS"
                : "UNVERIFIED",
            bypass
              ? "The active role or an inherited role can bypass RLS."
              : ownerNotForced.length
                ? "The role owns an RLS-protected table that is not FORCE ROW LEVEL SECURITY."
                : policies
                  ? "RLS policies were inspected and no bypass or unforced-owner path was found."
                  : "RLS is enabled but policy metadata was unavailable.",
            [
              ...rlsTables.map(
                (table) =>
                  `${table.schema_name}.${table.table_name}: forced=${table.force_row_security}`,
              ),
              ...(
                (policies ?? []) as unknown as {
                  schemaname: string
                  tablename: string
                  policyname: string
                  cmd: string
                }[]
              ).map(
                (policy) =>
                  `${policy.schemaname}.${policy.tablename}.${policy.policyname}:${policy.cmd}`,
              ),
            ],
          ),
        )
      }
    }

    const triggerRows = await safeProbe(
      client,
      "payroll-guard-triggers",
      `SELECT n.nspname AS schema_name, c.relname AS table_name,
          t.tgname AS trigger_name, t.tgenabled AS enabled_state,
          t.tgtype::int AS event_type, p.proname AS function_name,
          p.prosrc AS function_source,
          pg_get_userbyid(p.proowner) AS function_owner,
          p.prosecdef AS security_definer
       FROM pg_catalog.pg_trigger t
       JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
       WHERE t.tgname IN (
         'payroll_approved_run_guard',
         'payroll_approved_calculation_guard',
         'payroll_approved_item_guard',
         'payroll_approved_component_guard'
       ) AND NOT t.tgisinternal
       ORDER BY t.tgname`,
      checks,
    )
    const expectedMigration = readExpectedGuardMigration()
    if (!triggerRows) {
      checks.push(
        check(
          "approved-snapshot-triggers",
          "UNVERIFIED",
          "Could not inspect trigger and function catalogs.",
        ),
      )
    } else if (expectedMigration.functions.size !== 2) {
      checks.push(
        check(
          "approved-snapshot-triggers",
          "UNVERIFIED",
          "The checked-out guard migration could not be parsed for an expected definition.",
        ),
      )
    } else {
      const actual = triggerRows as unknown as TriggerRow[]
      const details: string[] = []
      const issues: string[] = []
      for (const expected of expectedTriggers) {
        const found = actual.find(
          (trigger) => trigger.trigger_name === expected.name,
        )
        if (!found) {
          issues.push(`missing trigger ${expected.name}`)
          continue
        }
        if (found.table_name !== expected.table) {
          issues.push(`${expected.name} is attached to ${found.table_name}`)
        }
        if (found.enabled_state !== "O" && found.enabled_state !== "A") {
          issues.push(
            `${expected.name} has enabled state ${found.enabled_state}`,
          )
        }
        if (found.event_type !== expected.eventType) {
          issues.push(`${expected.name} event mask is ${found.event_type}`)
        }
        if (found.function_name !== expected.functionName) {
          issues.push(`${expected.name} calls ${found.function_name}`)
        }
        if (
          normalizeFunctionSource(found.function_source) !==
          expectedMigration.functions.get(expected.functionName)
        ) {
          issues.push(`${expected.functionName} source differs from migration`)
        }
        if (found.security_definer) {
          issues.push(`${expected.functionName} is SECURITY DEFINER`)
        }
        details.push(
          `${found.schema_name}.${found.table_name}.${found.trigger_name}: enabled=${found.enabled_state}; event=${found.event_type}; function=${found.function_name}; source_match=${normalizeFunctionSource(found.function_source) === expectedMigration.functions.get(expected.functionName)}; owner=${found.function_owner}`,
        )
      }
      checks.push(
        check(
          "approved-snapshot-triggers",
          issues.length ? "FAIL" : "PASS",
          issues.length
            ? "Required approved-snapshot triggers or function definitions do not match the guard migration."
            : "All required trigger declarations, enabled states, event masks and function source match the tracked guard migration.",
          [...details, ...issues],
        ),
      )
      const functionOwners = new Set(
        actual.map(({ function_owner }) => function_owner),
      )
      const memberships = await safeProbe(
        client,
        "guard-function-owner-paths",
        `SELECT rolname,
           pg_has_role(current_user, oid, 'MEMBER') AS is_member,
           pg_has_role(current_user, oid, 'USAGE') AS inherits_privileges,
           ${serverVersionNumber >= 160000 ? "pg_has_role(current_user, oid, 'SET')" : "pg_has_role(current_user, oid, 'MEMBER')"} AS can_set_role
         FROM pg_catalog.pg_roles
         WHERE rolname <> current_user
           AND rolname IN (${
             [...functionOwners]
               .map((owner) => `'${owner.replace(/'/g, "''")}'`)
               .join(", ") || "NULL"
           })`,
        checks,
      )
      if (memberships) {
        const assumed = (
          memberships as unknown as {
            rolname: string
            inherits_privileges: boolean
            can_set_role: boolean
          }[]
        ).filter(
          ({ inherits_privileges, can_set_role }) =>
            inherits_privileges || can_set_role,
        )
        const functionOwnerMatches = actual.filter(
          (trigger) =>
            trigger.function_owner === currentUser ||
            trigger.function_owner === sessionUser,
        )
        const status =
          assumed.length || functionOwnerMatches.length ? "FAIL" : "PASS"
        checks.push(
          check(
            "trigger-alterability",
            status,
            status === "FAIL"
              ? "The runtime or login role can alter a guard function through ownership or can assume its owner role."
              : "No direct or assumable guard-function ownership path was found; table/schema alterability is checked separately.",
            [
              ...functionOwnerMatches.map(
                ({ function_name, function_owner }) =>
                  `${function_name} directly owned by ${function_owner}`,
              ),
              ...assumed.map(
                ({ rolname }) => `can assume function owner ${rolname}`,
              ),
            ],
          ),
        )
      } else {
        checks.push(
          check(
            "trigger-alterability",
            "UNVERIFIED",
            "Could not verify whether guard-function owner roles can be assumed.",
          ),
        )
      }
    }

    const migrationResult = await safeProbe(
      client,
      "guard-migration-ledger",
      `SELECT EXISTS (
         SELECT 1 FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations'
           AND c.relkind IN ('r', 'p')
       ) AS ledger_exists`,
      checks,
    )
    if (!migrationResult) {
      checks.push(
        check(
          "guard-migration-applied",
          "UNVERIFIED",
          "The Prisma migration ledger could not be inspected.",
        ),
      )
    } else if (
      !(migrationResult[0] as { ledger_exists: boolean }).ledger_exists
    ) {
      checks.push(
        check(
          "guard-migration-applied",
          "UNVERIFIED",
          "The Prisma migration ledger is absent or is not in the public schema.",
        ),
      )
    } else {
      const applied = await safeProbe(
        client,
        "guard-migration-row",
        `SELECT migration_name, checksum,
          finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied
         FROM public."_prisma_migrations"
         WHERE migration_name = '${guardMigration}'`,
        checks,
      )
      const migration = (applied ?? []) as unknown as {
        migration_name: string
        checksum: string
        applied: boolean
      }[]
      const appliedMigration = migration.find(
        (row) => row.migration_name === guardMigration && row.applied,
      )
      const checksumMatches =
        Boolean(expectedMigration.checksum) &&
        appliedMigration?.checksum.toLowerCase() ===
          expectedMigration.checksum?.toLowerCase()
      checks.push(
        check(
          "guard-migration-applied",
          !applied
            ? "UNVERIFIED"
            : !appliedMigration
              ? "FAIL"
              : !expectedMigration.checksum
                ? "UNVERIFIED"
                : checksumMatches
                  ? "PASS"
                  : "FAIL",
          !applied
            ? "The migration ledger exists but is not readable by the audit role."
            : !appliedMigration
              ? "The approved-snapshot guard migration is absent or not successfully applied."
              : !expectedMigration.checksum
                ? "The checked-out guard migration checksum is unavailable."
                : checksumMatches
                  ? "The guard migration is successfully applied and its recorded checksum matches the checked-out migration."
                  : "The applied guard migration checksum differs from the checked-out migration.",
          migration.map(
            ({ migration_name, applied: isApplied }) =>
              `${migration_name}: applied=${isApplied}; checksum_match=${migration_name === guardMigration && isApplied ? checksumMatches : "not_checked"}`,
          ),
        ),
      )
    }

    return finishReport(checks, {
      currentUser,
      sessionUser,
      database,
      serverVersion,
      serverVersionNumber,
    })
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {})
  }
}

async function safeProbe(
  client: PayrollAuditQueryClient,
  id: string,
  sql: string,
  checks: PayrollAuditCheck[],
): Promise<Record<string, unknown>[] | null> {
  await client.query("SAVEPOINT payroll_permission_audit_probe")
  try {
    const result = await client.query(sql)
    await client.query("RELEASE SAVEPOINT payroll_permission_audit_probe")
    return result.rows
  } catch (error) {
    await client
      .query("ROLLBACK TO SAVEPOINT payroll_permission_audit_probe")
      .catch(() => {})
    await client
      .query("RELEASE SAVEPOINT payroll_permission_audit_probe")
      .catch(() => {})
    checks.push(
      check(
        `${id}-catalog-access`,
        "UNVERIFIED",
        `Catalog query was unavailable (PostgreSQL code ${codeOf(error)}).`,
      ),
    )
    return null
  }
}

function finishReport(
  checks: PayrollAuditCheck[],
  identity?: PayrollAuditReport["identity"],
): PayrollAuditReport {
  const verdict = checks.some(({ status }) => status === "FAIL")
    ? "FAIL"
    : checks.some(({ status }) => status === "UNVERIFIED")
      ? "UNVERIFIED"
      : "PASS"
  return {
    generatedAt: new Date().toISOString(),
    ...(identity ? { identity } : {}),
    checks,
    verdict,
  }
}

export function requireExplicitPayrollAuditUrl(
  environment: Record<string, string | undefined>,
): string {
  const connectionString = environment.PAYROLL_DB_AUDIT_URL?.trim()
  if (!connectionString) {
    throw new Error(
      "Set PAYROLL_DB_AUDIT_URL explicitly. The audit never falls back to DATABASE_URL or DIRECT_URL.",
    )
  }
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error("PAYROLL_DB_AUDIT_URL must be a PostgreSQL URL.")
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("PAYROLL_DB_AUDIT_URL must use the PostgreSQL protocol.")
  }
  return connectionString
}

export function createPayrollAuditClient(connectionString: string): pg.Client {
  return new pg.Client({
    ...databasePoolConfig(connectionString),
    application_name: "converyn_payroll_permissions_audit_read_only",
    connectionTimeoutMillis: 5_000,
    query_timeout: 10_000,
    options:
      "-c default_transaction_read_only=on -c statement_timeout=8000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000",
  })
}
