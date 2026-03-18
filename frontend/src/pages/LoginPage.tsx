import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { login, resendVerification, googleAuth } from '../api';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export default function LoginPage({ dark, onToggleDark }: Props) {
  const { t } = useTranslation();
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSuccess = async (credential: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      const data = await googleAuth({ credential });
      setAuth(data!.token, data!.user);
      navigate('/');
    } catch (err: any) {
      setError(t(`auth.errors.${err.errorCode ?? 'GOOGLE_AUTH_FAILED'}`, { defaultValue: err.message }));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login({ email, password });
      setAuth(data!.token, data!.user);
      navigate('/');
    } catch (err: any) {
      const errorCode: string = err.errorCode ?? 'LOGIN_FAILED';
      if (errorCode === 'EMAIL_NOT_VERIFIED') {
        setShowVerifyDialog(true);
      } else {
        setError(t(`auth.errors.${errorCode}`, { defaultValue: err.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    setResendError('');
    try {
      await resendVerification(email);
      setResendMessage(t('auth.verify.resendSuccess'));
    } catch {
      setResendError(t('auth.verify.resendFailed'));
    } finally {
      setResendLoading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      {/* Email not verified dialog */}
      {showVerifyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('auth.verify.dialogTitle')}</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('auth.verify.dialogBody', { email })}</p>

            {resendMessage && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
                {resendMessage}
              </div>
            )}
            {resendError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                {resendError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || !!resendMessage}
                className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {resendLoading ? t('auth.verify.resending') : t('auth.verify.resendButton')}
              </button>
              <button
                onClick={() => { setShowVerifyDialog(false); setResendMessage(''); setResendError(''); }}
                className="flex-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-2 rounded-lg text-sm transition-colors"
              >
                {t('auth.verify.cancelButton')}
              </button>
            </div>
          </div>
        </div>
      )}
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
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('auth.login.title')}</h2>

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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
            <span className="text-xs text-slate-400 dark:text-slate-500">{t('auth.orContinueWith')}</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
          </div>

          {/* Google Sign-In */}
          <div className={`flex justify-center transition-opacity ${googleLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <GoogleLogin
              onSuccess={(res) => res.credential && handleGoogleSuccess(res.credential)}
              onError={() => setError(t('auth.errors.GOOGLE_AUTH_FAILED'))}
              text="signin_with"
              shape="rectangular"
              width="100%"
            />
          </div>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {t('auth.login.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
