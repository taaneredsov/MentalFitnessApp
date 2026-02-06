import nodemailer from "nodemailer"
import { loadSecrets } from "./secrets.js"

// Load Docker Swarm secrets (will override env vars if files exist)
loadSecrets()

// Create SMTP transporter using environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
})

/**
 * Send a magic link email with login link and 6-digit code
 */
export async function sendMagicLinkEmail(
  to: string,
  magicLink: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.sendMail({
      from: `"Mental Fitness" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: "Je login link voor Mental Fitness",
      html: getMagicLinkEmailTemplate(magicLink, code),
      text: getMagicLinkEmailText(magicLink, code)
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to send email:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email"
    }
  }
}

/**
 * HTML email template for magic link
 */
function getMagicLinkEmailTemplate(link: string, code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
      Inloggen bij Mental Fitness
    </h1>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      Klik op de knop hieronder om in te loggen:
    </p>

    <a href="${link}"
       style="display: inline-block; background-color: #2563eb; color: white; font-weight: 500; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-size: 16px;">
      Inloggen
    </a>

    <div style="margin: 32px 0; border-top: 1px solid #e5e7eb; padding-top: 24px;">
      <p style="color: #4b5563; font-size: 14px; margin: 0 0 12px 0;">
        Of voer deze code in de app in:
      </p>

      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">
          ${code}
        </span>
      </div>
    </div>

    <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
      Deze link en code zijn 15 minuten geldig.<br>
      Als je deze email niet hebt aangevraagd, kun je hem veilig negeren.
    </p>
  </div>

  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
    Mental Fitness App
  </p>
</body>
</html>
`
}

/**
 * Send a verification code email for first-time password setup
 */
export async function sendVerificationCodeEmail(
  to: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.sendMail({
      from: `"Mental Fitness" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: "Je verificatiecode voor Mental Fitness",
      html: getVerificationCodeEmailTemplate(code),
      text: getVerificationCodeEmailText(code)
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to send verification email:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email"
    }
  }
}

function getVerificationCodeEmailTemplate(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
      Verificatiecode
    </h1>

    <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      Gebruik deze code om je wachtwoord in te stellen:
    </p>

    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">
        ${code}
      </span>
    </div>

    <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
      Deze code is 15 minuten geldig.<br>
      Als je deze email niet hebt aangevraagd, kun je hem veilig negeren.
    </p>
  </div>

  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
    Mental Fitness App
  </p>
</body>
</html>
`
}

function getVerificationCodeEmailText(code: string): string {
  return `
Verificatiecode voor Mental Fitness

Gebruik deze code om je wachtwoord in te stellen:
${code}

Deze code is 15 minuten geldig.
Als je deze email niet hebt aangevraagd, kun je hem veilig negeren.

Mental Fitness App
`.trim()
}

/**
 * Plain text fallback for email clients that don't support HTML
 */
function getMagicLinkEmailText(link: string, code: string): string {
  return `
Inloggen bij Mental Fitness

Klik op deze link om in te loggen:
${link}

Of voer deze code in de app in:
${code}

Deze link en code zijn 15 minuten geldig.
Als je deze email niet hebt aangevraagd, kun je hem veilig negeren.

Mental Fitness App
`.trim()
}
