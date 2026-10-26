export async function sendEmailCode(
  email: string,
  code: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error("Email verification is unavailable")
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Verify your EXP email",
      text: `Your EXP verification code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`,
    }),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error("Email verification is unavailable")
}
