import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { pool } from '../db';
import { logger } from '../logger';
import type { UserRole } from './types';
import { JWT_SECRET } from './jwtSecret';
import { sendVerificationEmail } from '../email';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [APPLICANT, LOAN_OFFICER]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, role } = req.body;

  // Validate email
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error_code: 'INVALID_EMAIL', error: 'A valid email address is required' });
    return;
  }

  // Validate password
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error_code: 'INVALID_PASSWORD', error: 'Password must be at least 8 characters long' });
    return;
  }

  // Validate role if provided
  const validRoles: UserRole[] = ['APPLICANT', 'LOAN_OFFICER'];
  const userRole: UserRole = role && validRoles.includes(role) ? role : 'APPLICANT';

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const normalizedEmail = email.toLowerCase().trim();

    await client.query('BEGIN');

    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await client.query(
      `INSERT INTO users (id, email, password_hash, role, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, normalizedEmail, passwordHash, userRole, verificationToken, verificationTokenExpires],
    );

    await client.query(
      `INSERT INTO outbox_events (id, aggregate_id, topic, payload, published)
       VALUES ($1, $2, $3, $4, false)`,
      [
        uuidv4(),
        userId,
        'user-registered',
        JSON.stringify({
          userId,
          email: normalizedEmail,
          role: userRole,
          verificationToken,
          verificationUrl,
          correlationId: userId,
          timestamp: new Date().toISOString(),
        }),
      ],
    );

    await client.query('COMMIT');

    logger.info('User registered – verification email queued', { userId, email: normalizedEmail, role: userRole });
    res.status(201).json({ message: 'User registered successfully. Please check your email to verify your account.', userId });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      // Unique constraint violation – email already exists
      res.status(409).json({ error_code: 'EMAIL_ALREADY_EXISTS', error: 'An account with this email address already exists' });
      return;
    }
    logger.error('Error registering user', { email, err });
    res.status(500).json({ error_code: 'INTERNAL_ERROR', error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful – returns JWT token
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error_code: 'MISSING_CREDENTIALS', error: 'Email and password are required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, role, email_verified FROM users WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error_code: 'INVALID_CREDENTIALS', error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ error_code: 'INVALID_CREDENTIALS', error: 'Invalid email or password' });
      return;
    }

    if (!user.email_verified) {
      res.status(403).json({ error_code: 'EMAIL_NOT_VERIFIED', error: 'Please verify your email address before logging in' });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30m' });

    logger.info('User logged in', { userId: user.id, email: user.email });
    res.json({
      token,
      user: { userId: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error('Error during login', { email, err });
    res.status(500).json({ error_code: 'INTERNAL_ERROR', error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     summary: Verify email address using a token
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
authRouter.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error_code: 'INVALID_TOKEN', error: 'Verification token is required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, email, email_verified, verification_token_expires FROM users WHERE verification_token = $1`,
      [token],
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error_code: 'INVALID_TOKEN', error: 'Invalid or expired verification link' });
      return;
    }

    const user = result.rows[0];

    if (user.email_verified) {
      res.json({ message: 'Email already verified. You can now log in.' });
      return;
    }

    if (new Date(user.verification_token_expires) < new Date()) {
      res.status(400).json({ error_code: 'TOKEN_EXPIRED', error: 'Verification link has expired. Please request a new one.' });
      return;
    }

    await pool.query(
      `UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE id = $1`,
      [user.id],
    );

    logger.info('Email verified', { userId: user.id, email: user.email });
    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    logger.error('Error verifying email', { err });
    res.status(500).json({ error_code: 'INTERNAL_ERROR', error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already verified or invalid
 */
authRouter.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error_code: 'INVALID_EMAIL', error: 'Email is required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      `SELECT id, email_verified FROM users WHERE email = $1`,
      [normalizedEmail],
    );

    // Always respond with the same message to avoid revealing whether an account exists
    if (result.rows.length === 0 || result.rows[0].email_verified) {
      res.json({ message: 'If an unverified account exists with that email, a verification email has been sent.' });
      return;
    }

    const userId = result.rows[0].id;
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Persist the new token first
    await pool.query(
      `UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3`,
      [verificationToken, verificationTokenExpires, userId],
    );

    // Send directly and synchronously — so we can confirm delivery before responding
    await sendVerificationEmail(normalizedEmail, verificationUrl);

    logger.info('Verification email resent', { userId, email: normalizedEmail });
    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (err) {
    logger.error('Error resending verification email', { email: normalizedEmail, err });
    res.status(500).json({ error_code: 'EMAIL_SEND_FAILED', error: 'Failed to send verification email. Please try again.' });
  }
});

/**
 * @openapi
 * /auth/google:
 *   post:
 *     summary: Sign in or sign up with Google
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential:
 *                 type: string
 *                 description: Google ID token from the client
 *               role:
 *                 type: string
 *                 enum: [APPLICANT, LOAN_OFFICER]
 *                 description: Role for new accounts only (defaults to APPLICANT)
 *     responses:
 *       200:
 *         description: JWT token issued
 *       400:
 *         description: Missing or invalid credential
 *       500:
 *         description: Internal error
 */
authRouter.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { credential, role } = req.body;

  if (!credential || typeof credential !== 'string') {
    res.status(400).json({ error_code: 'MISSING_CREDENTIAL', error: 'Google credential is required' });
    return;
  }

  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error_code: 'GOOGLE_NOT_CONFIGURED', error: 'Google sign-in is not configured on this server' });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(400).json({ error_code: 'INVALID_CREDENTIAL', error: 'Could not retrieve email from Google token' });
      return;
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    // Check if user already exists
    const existing = await pool.query(
      `SELECT id, email, role, email_verified FROM users WHERE email = $1`,
      [email],
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      // Link google_id if not already linked
      await pool.query(
        `UPDATE users SET google_id = $1, email_verified = true WHERE id = $2 AND google_id IS NULL`,
        [googleId, user.id],
      );
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '30m' },
      );
      logger.info('User signed in via Google', { userId: user.id, email });
      res.json({ token, user: { userId: user.id, email: user.email, role: user.role } });
      return;
    }

    // New user — create account (email already verified by Google)
    const userId = uuidv4();
    const validRoles: UserRole[] = ['APPLICANT', 'LOAN_OFFICER'];
    const userRole: UserRole = role && validRoles.includes(role) ? role : 'APPLICANT';

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, email_verified, google_id)
       VALUES ($1, $2, NULL, $3, true, $4)`,
      [userId, email, userRole, googleId],
    );

    const token = jwt.sign(
      { userId, email, role: userRole },
      JWT_SECRET,
      { expiresIn: '30m' },
    );
    logger.info('New user registered via Google', { userId, email, role: userRole });
    res.status(201).json({ token, user: { userId, email, role: userRole } });
  } catch (err) {
    logger.error('Google auth error', { err });
    res.status(500).json({ error_code: 'GOOGLE_AUTH_FAILED', error: 'Google sign-in failed. Please try again.' });
  }
});
