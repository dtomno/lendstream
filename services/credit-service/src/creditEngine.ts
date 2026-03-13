import type { CreditGrade, PaymentHistory } from './types';

/**
 * Deterministic credit score simulation.
 * Uses a hash of the loanId to add controlled variance so each application
 * gets a unique (but reproducible) score.
 */
export function simulateCreditCheck(
  loanId: string,
  income: number,
  employmentStatus: string,
  amount: number,
): {
  creditScore: number;
  creditGrade: CreditGrade;
  existingDebts: number;
  paymentHistory: PaymentHistory;
} {
  // Deterministic variance from loanId characters (-40 to +40)
  const hash = loanId.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
  const variance = (hash % 80) - 40;

  let score = 600;

  // Employment factor
  if (employmentStatus === 'EMPLOYED') score += 90;
  else if (employmentStatus === 'SELF_EMPLOYED') score += 45;
  else if (employmentStatus === 'RETIRED') score += 25;
  else if (employmentStatus === 'UNEMPLOYED') score -= 130;

  // Income bracket
  if (income >= 120_000) score += 110;
  else if (income >= 80_000) score += 75;
  else if (income >= 50_000) score += 40;
  else if (income >= 30_000) score += 10;
  else score -= 60;

  // Loan-to-income ratio penalty
  const lti = amount / income;
  if (lti > 8) score -= 100;
  else if (lti > 5) score -= 65;
  else if (lti > 3) score -= 35;
  else if (lti > 1) score -= 15;

  score += variance;
  const creditScore = Math.min(850, Math.max(300, score));

  const creditGrade: CreditGrade =
    creditScore >= 750 ? 'A' :
    creditScore >= 700 ? 'B' :
    creditScore >= 650 ? 'C' :
    creditScore >= 600 ? 'D' : 'F';

  // Existing debts simulated as a fraction of annual income
  const existingDebts = parseFloat((income * 0.12 * (1 + (hash % 50) / 100)).toFixed(2));

  const paymentHistory: PaymentHistory =
    creditScore >= 750 ? 'EXCELLENT' :
    creditScore >= 700 ? 'GOOD' :
    creditScore >= 630 ? 'FAIR' : 'POOR';

  return { creditScore, creditGrade, existingDebts, paymentHistory };
}
