import axios from 'axios';
import type {
  LoanApplication,
  CreditAssessment,
  RiskAssessment,
  LoanDecision,
  LoanAccount,
  Notification,
  LoanPipeline,
  AuthResponse,
} from './types';

// In production each service has its own Railway URL (set via VITE_ env vars).
// In dev (vite proxy / docker nginx) these are undefined so axios uses the current origin.
const SERVICE_BASES: Array<[string, string]> = [
  ['/api/credit',        import.meta.env.VITE_CREDIT_SERVICE_URL       ?? ''],
  ['/api/risk',          import.meta.env.VITE_RISK_SERVICE_URL          ?? ''],
  ['/api/decisions',     import.meta.env.VITE_APPROVAL_SERVICE_URL      ?? ''],
  ['/api/accounts',      import.meta.env.VITE_ACCOUNT_SERVICE_URL       ?? ''],
  ['/api/notifications', import.meta.env.VITE_NOTIFICATION_SERVICE_URL  ?? ''],
];

const http = axios.create({ baseURL: import.meta.env.VITE_LOAN_SERVICE_URL ?? '' });

// Attach JWT + route to the correct service base URL
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const url = config.url ?? '';
  for (const [prefix, base] of SERVICE_BASES) {
    if (url.startsWith(prefix) && base) {
      config.baseURL = base;
      break;
    }
  }
  return config;
});

// On 401, clear token and redirect to login — but not for auth endpoints
// (a failed login/register returns 401 and should show an inline error, not redirect)
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? '';
    const isAuthEndpoint = url.includes('/api/auth/');
    if (err.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

function throwApiError(err: unknown, fallback: string): never {
  const axiosErr = err as { response?: { data?: { error_code?: string; error?: string } } };
  const errorCode: string = axiosErr.response?.data?.error_code ?? 'LOGIN_FAILED';
  const message: string = axiosErr.response?.data?.error ?? fallback;
  const e = new Error(message);
  (e as Error & { errorCode: string }).errorCode = errorCode;
  throw e;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const register = (data: { email: string; password: string; role: string }) =>
  http.post<{ message: string; userId: string }>('/api/auth/register', data).then((r) => r.data).catch((err) => {
    throwApiError(err, 'Registration failed. Please try again.');
  });

export const resendVerification = (email: string) =>
  http.post<{ message: string }>('/api/auth/resend-verification', { email }).then((r) => r.data).catch((err) => {
    throwApiError(err, 'Failed to resend verification email. Please try again.');
  });

export const verifyEmail = (token: string) =>
  http.get<{ message: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`).then((r) => r.data).catch((err) => {
    throwApiError(err, 'Email verification failed. Please try again.');
  });

export const login = (data: { email: string; password: string }) =>
  http.post<AuthResponse>('/api/auth/login', data).then((r) => r.data).catch((err) => {
    throwApiError(err, 'Login failed. Please try again.');
  });

// ── Loans ───────────────────────────────────────────────────────────────────

export const submitLoan = (data: {
  applicantName: string;
  email: string;
  amount: number;
  purpose: string;
  income: number;
  employmentStatus: string;
}) => http.post<{ loan: LoanApplication }>('/api/loans', data).then((r) => r.data.loan);

export const fetchLoans = () =>
  http.get<LoanApplication[]>('/api/loans').then((r) => r.data);

const safeGet = async <T>(url: string): Promise<T | undefined> => {
  try {
    const res = await http.get<T>(url);
    return res.data;
  } catch {
    return undefined;
  }
};

export const fetchPipeline = async (loanId: string): Promise<LoanPipeline> => {
  const [loan, credit, risk, decision, account, notifications] = await Promise.all([
    http.get<LoanApplication>(`/api/loans/${loanId}`).then((r) => r.data),
    safeGet<CreditAssessment>(`/api/credit/${loanId}`),
    safeGet<RiskAssessment>(`/api/risk/${loanId}`),
    safeGet<LoanDecision>(`/api/decisions/${loanId}`),
    safeGet<LoanAccount>(`/api/accounts/${loanId}`),
    safeGet<Notification[]>(`/api/notifications/${loanId}`),
  ]);

  return { loan, credit, risk, decision, account, notifications: notifications ?? [] };
};
