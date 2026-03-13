export interface Notification {
  id: string;
  loan_id: string;
  recipient_email: string;
  recipient_name: string;
  type: string;
  subject: string;
  message: string;
  channel: string;
  status: string;
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
