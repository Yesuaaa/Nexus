"use client"

import { Button } from "@/components/ui/button"
import type { ProjectWorkPlan } from "../api/project-workspace-api"

export function emptyPlan(): ProjectWorkPlan {
  return { phases: [{ id: crypto.randomUUID(), title: "Planning", tasks: [] }] }
}

export function PlanEditor({
  plan,
  onChange,
  disabled = false,
}: {
  plan: ProjectWorkPlan
  onChange: (plan: ProjectWorkPlan) => void
  disabled?: boolean
}) {
  const inputClass =
    "min-w-0 rounded-md border border-[#dfe4ec] bg-background px-3 py-2 text-xs"
  return (
    <fieldset disabled={disabled} className="m-0 space-y-4 border-0 p-0">
      <legend className="sr-only">Edit phases and tasks</legend>
      {plan.phases.map((phase, index) => (
        <section
          key={phase.id}
          className="rounded-lg border border-[#dfe4ec] p-4"
        >
          <div className="flex gap-2">
            <input
              aria-label={`Phase ${index + 1} name`}
              maxLength={120}
              value={phase.title}
              className={`${inputClass} flex-1 font-semibold`}
              onChange={(event) =>
                onChange({
                  phases: plan.phases.map((item) =>
                    item.id === phase.id
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                })
              }
            />
            <Button
              variant="outline"
              className="text-xs"
              disabled={plan.phases.length === 1}
              onClick={() =>
                onChange({
                  phases: plan.phases.filter((item) => item.id !== phase.id),
                })
              }
            >
              Remove phase
            </Button>
          </div>
          {phase.tasks.map((task) => (
            <div key={task.id} className="mt-3 flex flex-wrap gap-2">
              <input
                aria-label="Task name"
                maxLength={180}
                value={task.title}
                className={`${inputClass} flex-[2]`}
                placeholder="Task name"
                onChange={(event) =>
                  onChange({
                    phases: plan.phases.map((item) =>
                      item.id === phase.id
                        ? {
                            ...item,
                            tasks: item.tasks.map((row) =>
                              row.id === task.id
                                ? { ...row, title: event.target.value }
                                : row,
                            ),
                          }
                        : item,
                    ),
                  })
                }
              />
              <input
                aria-label="Suggested task role"
                maxLength={80}
                value={task.role}
                className={`${inputClass} flex-1`}
                placeholder="Suggested role"
                onChange={(event) =>
                  onChange({
                    phases: plan.phases.map((item) =>
                      item.id === phase.id
                        ? {
                            ...item,
                            tasks: item.tasks.map((row) =>
                              row.id === task.id
                                ? { ...row, role: event.target.value }
                                : row,
                            ),
                          }
                        : item,
                    ),
                  })
                }
              />
              <Button
                variant="outline"
                className="text-xs"
                onClick={() =>
                  onChange({
                    phases: plan.phases.map((item) =>
                      item.id === phase.id
                        ? {
                            ...item,
                            tasks: item.tasks.filter(
                              (row) => row.id !== task.id,
                            ),
                          }
                        : item,
                    ),
                  })
                }
              >
                Remove task
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="mt-3 text-xs"
            disabled={phase.tasks.length >= 50}
            onClick={() =>
              onChange({
                phases: plan.phases.map((item) =>
                  item.id === phase.id
                    ? {
                        ...item,
                        tasks: [
                          ...item.tasks,
                          {
                            id: crypto.randomUUID(),
                            title: "",
                            role: "Project team",
                            status: "NOT_STARTED",
                          },
                        ],
                      }
                    : item,
                ),
              })
            }
          >
            + Add task
          </Button>
        </section>
      ))}
      <Button
        variant="outline"
        className="text-xs"
        disabled={plan.phases.length >= 20}
        onClick={() =>
          onChange({
            phases: [
              ...plan.phases,
              { id: crypto.randomUUID(), title: "", tasks: [] },
            ],
          })
        }
      >
        + Add phase
      </Button>
    </fieldset>
  )
}
