/**
 * Dispatcher for outbound emails (such as password recovery links).
 * In development and test environments, this logs the reset link to stdout/console.
 * In production, it can be extended with an SMTP transporter, Resend, or AWS SES.
 */
export interface SendPasswordResetEmailParams {
  email: string
  token: string
}

export async function sendPasswordResetEmail({
  email,
  token,
}: SendPasswordResetEmailParams): Promise<void> {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

  // In test or local development, logging provides instantaneous visibility.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[AUTH] Password reset requested for ${email}. Reset URL: ${resetUrl}`,
    )
  }
}

