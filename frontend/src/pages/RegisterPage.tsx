import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { register } from '../api';
import type { UserRole } from '../types';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export default function RegisterPage({ dark, onToggleDark }: Props) {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('APPLICANT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ email, password, role });
      setRegistered(true);
    } catch (err: any) {
      const errorCode: string = err.errorCode ?? 'LOGIN_FAILED';
      setError(t(`auth.errors.${errorCode}`, { defaultValue: err.message }));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      {/* Controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2">
        <LanguageSwitcher />
        <button
          onClick={onToggleDark}
          title={dark ? t('auth.switchToLight') : t('auth.switchToDark')}
          className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <span>{dark ? '☀️' : '🌙'}</span>
          <span>{dark ? t('nav.light') : t('nav.dark')}</span>
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">{t('app.name')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('app.tagline')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8">
          {registered ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('auth.register.checkEmail')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.register.verifyEmailSent', { email })}</p>
              <Link
                to="/login"
                className="inline-block mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {t('auth.register.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('auth.register.title')}</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('auth.email')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('auth.password')}</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                    placeholder={t('auth.passwordPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('auth.role')}</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className={inputCls}
                  >
                    <option value="APPLICANT">{t('auth.register.roleApplicant')}</option>
                    <option value="LOAN_OFFICER">{t('auth.register.roleLoanOfficer')}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  {loading ? t('auth.register.submitting') : t('auth.register.submit')}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
                {t('auth.register.alreadyHaveAccount')}{' '}
                <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  {t('auth.register.signIn')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
