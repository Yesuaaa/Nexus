export function isPayrollSimulatorEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.PAYROLL_LOCAL_SIMULATOR === "true"
  )
}
