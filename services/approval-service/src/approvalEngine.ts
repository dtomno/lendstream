import type { Decision } from './types';

/**
 * Makes a loan decision based on risk level and credit score.
 *
 * Rules:
 *  - LOW / MEDIUM risk → APPROVED
 *  - HIGH / VERY_HIGH risk → REJECTED
 *
 * Interest rate is determined by credit grade:
 *  A (750+) → 5.5%  |  B (700+) → 7.5%
 *  C (650+) → 10.5% |  D (600+) → 14.5%  |  F → 18.9%
 */
export function makeDecision(
  riskLevel: string,
  creditScore: number,
  amount: number,
): {
  decision: Decision;
  interestRate: number;
  approvedAmount: number;
  reason: string;
} {
  const isApproved = riskLevel === 'LOW' || riskLevel === 'MEDIUM';
  const decision: Decision = isApproved ? 'APPROVED' : 'REJECTED';

  let interestRate = 0;
  let reason = '';

  if (isApproved) {
    if (creditScore >= 750) interestRate = 5.5;
    else if (creditScore >= 700) interestRate = 7.5;
    else if (creditScore >= 650) interestRate = 10.5;
    else if (creditScore >= 600) interestRate = 14.5;
    else interestRate = 18.9;

    reason = `Application approved. Credit score of ${creditScore} and ${riskLevel.toLowerCase()} risk profile qualify for a ${interestRate}% interest rate.`;
  } else {
    reason =
      riskLevel === 'HIGH'
        ? `Application rejected. High risk profile detected (credit score: ${creditScore}). Consider improving your credit score or reducing the requested amount.`
        : `Application rejected. Very high risk profile (credit score: ${creditScore}). Applicant does not meet minimum lending criteria at this time.`;
  }

  return {
    decision,
    interestRate,
    approvedAmount: isApproved ? amount : 0,
    reason,
  };
}
