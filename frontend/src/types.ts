export type UserRole = 'APPLICANT' | 'LOAN_OFFICER';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export type EmploymentStatus = 'EMPLOYED' | 'SELF_EMPLOYED' | 'UNEMPLOYED' | 'RETIRED';
export type LoanStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';

export interface LoanApplication {
  id: string;
  applicant_name: string;
  email: string;
  amount: number;
  purpose: string;
  income: number;
  employment_status: EmploymentStatus;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
}

export interface CreditAssessment {
  id: string;
  loan_id: string;
  credit_score: number;
  credit_grade: string;
  existing_debts: number;
  payment_history: string;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  loan_id: string;
  credit_score: number;
  risk_level: string;
  risk_score: number;
  debt_to_income_ratio: number;
  created_at: string;
}

export interface LoanDecision {
  id: string;
  loan_id: string;
  decision: 'APPROVED' | 'REJECTED';
  interest_rate: number;
  approved_amount: number;
  reason: string;
  risk_level: string;
  credit_score: number;
  created_at: string;
}

export interface LoanAccount {
  id: string;
  loan_id: string;
  account_number: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  monthly_payment: number;
  status: string;
  created_at: string;
}

export interface Notification {
  id: string;
  loan_id: string;
  recipient_email: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface LoanPipeline {
  loan: LoanApplication;
  credit?: CreditAssessment;
  risk?: RiskAssessment;
  decision?: LoanDecision;
  account?: LoanAccount;
  notifications: Notification[];
}
