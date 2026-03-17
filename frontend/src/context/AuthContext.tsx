import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function loadFromStorage(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    const user = raw ? (JSON.parse(raw) as AuthUser) : null;
    if (token) {
      const expMs = getTokenExpiry(token);
      if (expMs !== null && expMs < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return { token: null, user: null };
      }
    }
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadFromStorage();
  const [token, setToken] = useState<string | null>(stored.token);
  const [user, setUser] = useState<AuthUser | null>(stored.user);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAuth = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const scheduleExpiry = useCallback(
    (tok: string) => {
      const expMs = getTokenExpiry(tok);
      if (expMs === null) return;
      const delay = expMs - Date.now();
      if (delay <= 0) {
        clearAuth();
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        clearAuth();
        window.location.href = '/login';
      }, delay);
    },
    [clearAuth],
  );

  // Schedule expiry for any token already in storage on mount
  useEffect(() => {
    if (stored.token) scheduleExpiry(stored.token);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAuth = useCallback(
    (newToken: string, newUser: AuthUser) => {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
      scheduleExpiry(newToken);
    },
    [scheduleExpiry],
  );

  return (
    <AuthContext.Provider value={{ user, token, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
