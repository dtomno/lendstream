export interface LoanAccount {
  id: string;
  loan_id: string;
  account_number: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  status: 'ACTIVE' | 'CLOSED' | 'DEFAULTED';
  created_at: Date;
}

// ── Kafka Event Payloads ──────────────────────────────────────────────────────

export interface LoanDecisionMadeEvent {
  loanId: string;
  decision: 'APPROVED' | 'REJECTED';
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

export interface LoanAccountCreatedEvent {
  loanId: string;
  accountNumber: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  correlationId: string;
  timestamp: string;
}
