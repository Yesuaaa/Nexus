"use client"

import { useAsyncResource } from "@/lib/use-async-resource"
import {
  listDepartments,
  listProjectManagementDepartments,
  type Department,
} from "../api/departments-api"

const noDepartments: Department[] = []

/**
 * The department list for pickers and filters, with loading/error state.
 * Pass a changing `revision` to reload it after a mutation.
 */
export function useDepartments({
  enabled = true,
  revision = 0,
  projectManagement = false,
}: {
  enabled?: boolean
  revision?: number
  projectManagement?: boolean
} = {}) {
  const resource = useAsyncResource<Department[]>(
    (signal) =>
      projectManagement
        ? listProjectManagementDepartments(signal)
        : listDepartments(signal),
    [revision, projectManagement],
    { enabled, fallbackError: "Couldn't load departments." },
  )
  return { ...resource, departments: resource.data ?? noDepartments }
}
