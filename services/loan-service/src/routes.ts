import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from './db';
import { logger } from './logger';
import { validate } from './validation/middleware';
import { createLoanSchema } from './validation/schemas';
import { authenticate } from './auth/middleware';

export const router = Router();

/**
 * @openapi
 * /loans:
 *   post:
 *     summary: Submit a new loan application
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [applicantName, email, amount, purpose, income, employmentStatus]
 *             properties:
 *               applicantName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               amount:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 500000
 *               purpose:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               income:
 *                 type: number
 *                 minimum: 1
 *               employmentStatus:
 *                 type: string
 *                 enum: [EMPLOYED, SELF_EMPLOYED, UNEMPLOYED, RETIRED]
 *     responses:
 *       201:
 *         description: Loan application submitted successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', validate(createLoanSchema), authenticate, async (req: Request, res: Response): Promise<void> => {
  const { applicantName, email, amount, purpose, income, employmentStatus } = req.body;
  const correlationId = uuidv4();
  const loanId = uuidv4();
  const userId = req.user!.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loanResult = await client.query(
      `INSERT INTO loan_applications (id, applicant_name, email, amount, purpose, income, employment_status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [loanId, applicantName, email, amount, purpose, income, employmentStatus, userId],
    );
    const loan = loanResult.rows[0];

    const outboxPayload = {
      loanId,
      applicantName,
      email,
      amount,
      purpose,
      income,
      employmentStatus,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    await client.query(
      `INSERT INTO outbox_events (aggregate_id, topic, payload)
       VALUES ($1, $2, $3)`,
      [loanId, 'loan-application-submitted', JSON.stringify(outboxPayload)],
    );

    await client.query('COMMIT');

    logger.info('Loan application created and outbox event queued', {
      loanId,
      correlationId,
      userId,
    });

    res.status(201).json({
      message: 'Loan application submitted – processing started',
      loan,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error submitting loan application', { correlationId, userId, err });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /loans:
 *   get:
 *     summary: List loan applications
 *     description: LOAN_OFFICERs see all applications; APPLICANTs see only their own.
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of loan applications
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    let result;

    if (req.user!.role === 'LOAN_OFFICER') {
      result = await pool.query('SELECT * FROM loan_applications ORDER BY created_at DESC');
    } else {
      result = await pool.query(
        'SELECT * FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user!.userId],
      );
    }

    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching loan applications', { userId: req.user?.userId, err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @openapi
 * /loans/{id}:
 *   get:
 *     summary: Get a single loan application by ID
 *     description: APPLICANTs can only access their own applications; LOAN_OFFICERs can access any.
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Loan application details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – cannot access another applicant's loan
 *       404:
 *         description: Loan not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM loan_applications WHERE id = $1',
      [req.params.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Loan not found' });
      return;
    }

    const loan = result.rows[0];

    if (req.user!.role === 'APPLICANT' && loan.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You do not have permission to view this loan' });
      return;
    }

    res.json(loan);
  } catch (err) {
    logger.error('Error fetching loan by id', { loanId: req.params.id, userId: req.user?.userId, err });
    res.status(500).json({ error: 'Internal server error' });
  }
});
