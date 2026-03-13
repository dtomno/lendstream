import type { RiskLevel } from './types';

/**
 * Calculates a risk score (0–100, lower = safer) based on:
 *  - Credit score (contributes 0–50 points)
 *  - Debt-to-Income ratio (contributes 0–50 points)
 */
export function assessRisk(
  creditScore: number,
  amount: number,
  income: number,
  existingDebts: number,
): {
  riskScore: number;
  riskLevel: RiskLevel;
  debtToIncomeRatio: number;
} {
  const debtToIncomeRatio = parseFloat(((amount + existingDebts) / income).toFixed(4));

  // Credit score component (lower credit = higher risk points)
  let creditRisk: number;
  if (creditScore >= 750) creditRisk = 5;
  else if (creditScore >= 700) creditRisk = 15;
  else if (creditScore >= 650) creditRisk = 25;
  else if (creditScore >= 600) creditRisk = 37;
  else creditRisk = 50;

  // DTI component (higher DTI = higher risk points)
  let dtiRisk: number;
  if (debtToIncomeRatio < 0.3) dtiRisk = 5;
  else if (debtToIncomeRatio < 0.5) dtiRisk = 15;
  else if (debtToIncomeRatio < 0.8) dtiRisk = 30;
  else if (debtToIncomeRatio < 1.2) dtiRisk = 42;
  else dtiRisk = 50;

  const riskScore = parseFloat((creditRisk + dtiRisk).toFixed(2));

  const riskLevel: RiskLevel =
    riskScore <= 20 ? 'LOW' :
    riskScore <= 40 ? 'MEDIUM' :
    riskScore <= 65 ? 'HIGH' : 'VERY_HIGH';

  return { riskScore, riskLevel, debtToIncomeRatio };
}
