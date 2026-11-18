import { ActivityLogWriteError } from "../../shared/activity-log-write-error.js"

export class ServiceOperationLogWriteError extends ActivityLogWriteError {
  constructor(cause: unknown) {
    super("Service Operations", cause)
  }
}
