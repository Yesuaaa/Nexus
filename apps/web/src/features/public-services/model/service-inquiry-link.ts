export function parseInquiryService(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value)
    ? value
    : undefined
}

export function withInquiryService(path: string, serviceId?: string): string {
  return serviceId
    ? `${path}?${new URLSearchParams({ service: serviceId })}`
    : path
}
