import nodemailer from 'nodemailer';
import { logger } from './logger';

// Resend HTTP API — works on any platform (no SMTP port required)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'LendStream <onboarding@resend.dev>';

let smtpTransporter: nodemailer.Transporter | null = null;

export async function initEmailTransport(): Promise<void> {
  if (RESEND_API_KEY) {
    logger.info('Email transport: Resend HTTP API');
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
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: options.to,
          subject: options.subject,
          text: options.text,
          ...(options.html ? { html: options.html } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);
      }

      logger.info('Email sent via Resend', { to: options.to, subject: options.subject });
      return;
    }

    if (!smtpTransporter) throw new Error('Email transporter not initialised');

    const info = await smtpTransporter.sendMail({
      from: EMAIL_FROM,
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
