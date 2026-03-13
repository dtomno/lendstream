import nodemailer from 'nodemailer';
import { logger } from './logger';

let transporter: nodemailer.Transporter;

export async function initEmailTransport(): Promise<void> {
  if (process.env.EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    logger.info('Email transport configured with SMTP');
  } else {
    // Use Ethereal free test account - no signup needed
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info('Email transport using Ethereal test account', {
      user: testAccount.user,
      pass: testAccount.pass,
      webUrl: 'https://ethereal.email',
    });
  }
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: '"LendStream" <noreply@lendstream.io>',
      ...options,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info('Email sent', {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      previewUrl: previewUrl || 'N/A (real SMTP)',
    });
  } catch (err) {
    logger.error('Failed to send email', { to: options.to, error: err });
  }
}
