import nodemailer from 'nodemailer';
import { logger } from './logger';

// Brevo HTTP API — works on any platform (no SMTP port required), no domain needed
// Free tier: 300 emails/day. Set BREVO_API_KEY to enable.
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'LendStream';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '';

let smtpTransporter: nodemailer.Transporter | null = null;

export async function initEmailTransport(): Promise<void> {
  if (BREVO_API_KEY) {
    logger.info('Email transport: Brevo HTTP API');
    return;
  }

  if (process.env.EMAIL_HOST) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    logger.info('Email transport: SMTP', { host: process.env.EMAIL_HOST });
    return;
  }

  // Local dev fallback — preview emails at ethereal.email
  const testAccount = await nodemailer.createTestAccount();
  smtpTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  logger.info('Email transport: Ethereal (dev)', {
    user: testAccount.user,
    previewUrl: 'https://ethereal.email',
  });
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  try {
    if (BREVO_API_KEY) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS },
          to: [{ email: options.to }],
          subject: options.subject,
          textContent: options.text,
          ...(options.html ? { htmlContent: options.html } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Brevo ${res.status}: ${JSON.stringify(body)}`);
      }

      logger.info('Email sent via Brevo', { to: options.to, subject: options.subject });
      return;
    }

    if (!smtpTransporter) throw new Error('Email transporter not initialised');

    const info = await smtpTransporter.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM_ADDRESS || 'noreply@lendstream.io'}>`,
      ...options,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info('Email sent', {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      ...(previewUrl ? { previewUrl } : {}),
    });
  } catch (err) {
    logger.error('Failed to send email', { to: options.to, message: (err as Error).message });
    throw err;
  }
}
