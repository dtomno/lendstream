import { logger } from './logger';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'LendStream';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '';

/**
 * Send a verification email directly (synchronous — used by the resend-verification endpoint
 * so the HTTP response reflects whether the email was actually delivered).
 */
export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  const subject = 'Verify your LendStream email address';
  const text = `Hello,\n\nClick the link below to verify your email address:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this email.\n\nLendStream`;
  const html = `<p>Hello,</p><p>Click the button below to verify your email address:</p><p><a href="${verificationUrl}" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Verify Email</a></p><p>Or copy this link:<br><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 24 hours.</p><p>LendStream</p>`;

  if (BREVO_API_KEY) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Brevo ${res.status}: ${JSON.stringify(body)}`);
    }

    logger.info('Verification email sent via Brevo', { to });
    return;
  }

  // Local dev: no email service configured — log the URL so devs can click it
  logger.info('[DEV] Verification email (no BREVO_API_KEY set). Use this link to verify:', {
    to,
    verificationUrl,
  });
}
