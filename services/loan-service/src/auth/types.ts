export type UserRole = 'APPLICANT' | 'LOAN_OFFICER';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
