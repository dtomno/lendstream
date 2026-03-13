export type Decision = 'APPROVED' | 'REJECTED';

export interface LoanDecision {
  id: string;
  loan_id: string;
  decision: Decision;
  interest_rate: number;
  approved_amount: number;
  reason: string;
  risk_level: string;
  credit_score: number;
  created_at: Date;
}

// ── Kafka Event Payloads ──────────────────────────────────────────────────────

export interface RiskAssessmentCompletedEvent {
  loanId: string;
  applicantName: string;
  email: string;
  amount: number;
  income: number;
  employmentStatus: string;
  creditScore: number;
  creditGrade: string;
  riskLevel: string;
  riskScore: number;
  debtToIncomeRatio: number;
  correlationId: string;
  timestamp: string;
}

export interface LoanDecisionMadeEvent {
  loanId: string;
  decision: Decision;
  interestRate: number;
  approvedAmount: number;
  reason: string;
  applicantEmail: string;
  applicantName: string;
  riskLevel: string;
  creditScore: number;
  correlationId: string;
  timestamp: string;
}
