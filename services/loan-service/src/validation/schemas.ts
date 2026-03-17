import { z } from 'zod';

export const createLoanSchema = z.object({
  applicantName: z.string().min(2).max(100),
  email: z.string().email(),
  amount: z.number().positive().min(100).max(500000),
  purpose: z.string().min(3).max(200),
  income: z.number().min(0),
  employmentStatus: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED']),
}).refine(
  (data) => data.employmentStatus === 'UNEMPLOYED' ? data.income === 0 : data.income > 0,
  (data) => ({
    message: data.employmentStatus === 'UNEMPLOYED'
      ? 'Income must be 0 for unemployed applicants'
      : 'Income must be greater than 0',
    path: ['income'],
  }),
);

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
