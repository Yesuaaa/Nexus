export class ServiceOperationLogWriteError extends Error {
  constructor(cause: unknown) {
    super("Service Operations activity log could not be saved", { cause })
    this.name = "ServiceOperationLogWriteError"
  }
}
