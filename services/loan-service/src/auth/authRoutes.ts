import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';
import { logger } from '../logger';
import type { UserRole } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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
    res.status(400).json({ error: 'A valid email address is required' });
    return;
  }

  // Validate password
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long' });
    return;
  }

  // Validate role if provided
  const validRoles: UserRole[] = ['APPLICANT', 'LOAN_OFFICER'];
  const userRole: UserRole = role && validRoles.includes(role) ? role : 'APPLICANT';

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
      [userId, email.toLowerCase().trim(), passwordHash, userRole],
    );

    logger.info('User registered', { userId, email, role: userRole });
    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (err: any) {
    if (err.code === '23505') {
      // Unique constraint violation – email already exists
      res.status(409).json({ error: 'An account with this email address already exists' });
      return;
    }
    logger.error('Error registering user', { email, err });
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, role FROM users WHERE email = $1`,
      [email.toLowerCase().trim()],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });

    logger.info('User logged in', { userId: user.id, email: user.email });
    res.json({
      token,
      user: { userId: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error('Error during login', { email, err });
    res.status(500).json({ error: 'Internal server error' });
  }
});
