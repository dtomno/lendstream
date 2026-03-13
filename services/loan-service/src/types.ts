export type EmploymentStatus = 'EMPLOYED' | 'SELF_EMPLOYED' | 'UNEMPLOYED' | 'RETIRED';
export type LoanStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';

export interface CreateLoanDto {
  applicantName: string;
  email: string;
  amount: number;
  purpose: string;
  income: number;
  employmentStatus: EmploymentStatus;
}

export interface LoanApplication {
  id: string;
  applicant_name: string;
  email: string;
  amount: number;
  purpose: string;
  income: number;
  employment_status: EmploymentStatus;
  status: LoanStatus;
  created_at: Date;
  updated_at: Date;
}

// ── Kafka Event Payloads ──────────────────────────────────────────────────────

export interface LoanApplicationSubmittedEvent {
  loanId: string;
  applicantName: string;
  email: string;
  amount: number;
  purpose: string;
  income: number;
  employmentStatus: EmploymentStatus;
  timestamp: string;
  correlationId: string;
}

export interface LoanDecisionMadeEvent {
  loanId: string;
  decision: 'APPROVED' | 'REJECTED';
  interestRate: number;
  approvedAmount: number;
  reason: string;
  applicantEmail: string;
  applicantName: string;
  riskLevel: string;
  timestamp: string;
  correlationId: string;
}
