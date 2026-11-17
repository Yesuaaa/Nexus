export function buildContentSecurityPolicy(
  nonce: string,
  apiOrigin: string,
  isDevelopment = process.env.NODE_ENV === "development",
) {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(" ")
  // DevTools injects style tags without a nonce. Do not include a style nonce
  // in development: browsers ignore unsafe-inline when a nonce is present.
  const styleSources = isDevelopment
    ? "'self' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}'`

  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    `style-src ${styleSources}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.com",
    "font-src 'self' data:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}
