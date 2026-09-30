import { Email } from "@convex-dev/auth/providers/Email"

function generateOTP(length: number): string {
  const digits = "0123456789"
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (num) => digits[num % digits.length]).join("")
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error("RESEND_NOT_CONFIGURED")

  const fromName = process.env.RESEND_FROM_NAME?.trim()
  const sender = fromName ? `${fromName} <${from}>` : from
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: sender, to: [to], subject, html }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`RESEND_SEND_FAILED:${response.status}:${detail.slice(0, 200)}`)
  }
}

function verificationHtml(token: string, purpose: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#111">
    <h1 style="font-size:22px">EVARA-LUX</h1>
    <p>Your ${purpose} verification code is:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px">${token}</p>
    <p>This code expires in 15 minutes. If you did not request it, you can ignore this email.</p>
  </div>`
}

export const ResendOTP = Email({
  id: "resend-otp",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    return generateOTP(6)
  },
  async sendVerificationRequest({ identifier: email, token }) {
    await sendResendEmail(email, "Your EVARA-LUX verification code", verificationHtml(token, "account"))
  },
})

export const PasswordResetEmail = Email({
  id: "password-reset",
  maxAge: 15 * 60,
  async generateVerificationToken() {
    return generateOTP(6)
  },
  async sendVerificationRequest({ identifier: email, token }) {
    await sendResendEmail(email, "Reset your EVARA-LUX password", verificationHtml(token, "password reset"))
  },
})
