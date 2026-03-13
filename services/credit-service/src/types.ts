export type CreditGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type PaymentHistory = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface CreditAssessment {
  id: string;
  loan_id: string;
  credit_score: number;
  credit_grade: CreditGrade;
  existing_debts: number;
  payment_history: PaymentHistory;
  created_at: Date;
}

// ── Kafka Event Payloads ──────────────────────────────────────────────────────

export interface LoanApplicationSubmittedEvent {
  loanId: string;
  applicantName: string;
  email: string;
  amount: number;
  purpose: string;
  income: number;
  employmentStatus: string;
  correlationId: string;
  timestamp: string;
}

export interface CreditCheckCompletedEvent {
  loanId: string;
  applicantName: string;
  email: string;
  amount: number;
  income: number;
  employmentStatus: string;
  creditScore: number;
  creditGrade: CreditGrade;
  existingDebts: number;
  paymentHistory: PaymentHistory;
  correlationId: string;
  timestamp: string;
}
