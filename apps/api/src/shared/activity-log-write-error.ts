export class ActivityLogWriteError extends Error {
  constructor(module: string, cause: unknown) {
    super(`${module} activity log could not be saved`, { cause })
    this.name = new.target.name
  }
}
