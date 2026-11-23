import { Prisma } from "../../generated/prisma/client.js"

/**
 * Validates stored work-plan JSON before analytics expand phases and tasks.
 * Callers provide an `authorized_projects` CTE with `id` and `workPlan`
 * columns, so each analytics endpoint keeps its own authorization scope.
 */
export const validProjectWorkPlansCte = Prisma.sql`
  valid_plans AS (
    SELECT p.*
    FROM authorized_projects p
    WHERE jsonb_typeof(p."workPlan") = 'object'
      AND jsonb_typeof(p."workPlan"->'phases') = 'array'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(p."workPlan"->'phases') = 'array'
              THEN p."workPlan"->'phases'
            ELSE '[]'::jsonb
          END
        ) AS phase(value)
        WHERE jsonb_typeof(phase.value) <> 'object'
          OR jsonb_typeof(phase.value->'id') <> 'string'
          OR jsonb_typeof(phase.value->'title') <> 'string'
          OR jsonb_typeof(phase.value->'tasks') <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(phase.value->'tasks') = 'array'
                  THEN phase.value->'tasks'
                ELSE '[]'::jsonb
              END
            ) AS task(value)
            WHERE jsonb_typeof(task.value) <> 'object'
              OR jsonb_typeof(task.value->'id') <> 'string'
              OR jsonb_typeof(task.value->'title') <> 'string'
              OR jsonb_typeof(task.value->'role') <> 'string'
              OR COALESCE(task.value->>'status', '') NOT IN (
                'NOT_STARTED', 'IN_PROGRESS', 'DONE'
              )
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM (
          SELECT phase.value->>'id' AS id
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(p."workPlan"->'phases') = 'array'
                THEN p."workPlan"->'phases'
              ELSE '[]'::jsonb
            END
          ) AS phase(value)
          UNION ALL
          SELECT task.value->>'id' AS id
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(p."workPlan"->'phases') = 'array'
                THEN p."workPlan"->'phases'
              ELSE '[]'::jsonb
            END
          ) AS phase(value)
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(phase.value->'tasks') = 'array'
                THEN phase.value->'tasks'
              ELSE '[]'::jsonb
            END
          ) AS task(value)
        ) AS plan_ids
        GROUP BY id
        HAVING COUNT(*) > 1
      )
  )
`
