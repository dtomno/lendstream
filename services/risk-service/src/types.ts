export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface RiskAssessment {
  id: string;
  loan_id: string;
  credit_score: number;
  risk_level: RiskLevel;
  risk_score: number;
  debt_to_income_ratio: number;
  created_at: Date;
}

// ── Kafka Event Payloads ──────────────────────────────────────────────────────

export interface CreditCheckCompletedEvent {
  loanId: string;
  applicantName: string;
  email: string;
  amount: number;
  income: number;
  employmentStatus: string;
  creditScore: number;
  creditGrade: string;
  existingDebts: number;
  paymentHistory: string;
  correlationId: string;
  timestamp: string;
}

export interface RiskAssessmentCompletedEvent {
  loanId: string;
  applicantName: string;
  email: string;
  amount: number;
  income: number;
  employmentStatus: string;
  creditScore: number;
  creditGrade: string;
  riskLevel: RiskLevel;
  riskScore: number;
  debtToIncomeRatio: number;
  correlationId: string;
  timestamp: string;
}
