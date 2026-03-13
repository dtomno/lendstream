import { z } from 'zod';

export const createLoanSchema = z.object({
  applicantName: z.string().min(2).max(100),
  email: z.string().email(),
  amount: z.number().positive().min(100).max(500000),
  purpose: z.string().min(3).max(200),
  income: z.number().positive(),
  employmentStatus: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED']),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
