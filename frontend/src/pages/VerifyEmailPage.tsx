import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { verifyEmail } from '../api';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export default function VerifyEmailPage({ dark, onToggleDark }: Props) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('auth.verify.missingToken'));
      return;
    }

    verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data!.message);
      })
      .catch((err: any) => {
        setStatus('error');
        const errorCode: string = err.errorCode ?? 'INVALID_TOKEN';
        setMessage(t(`auth.verify.errors.${errorCode}`, { defaultValue: err.message }));
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="fixed top-4 right-4">
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

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
          {status === 'loading' && (
            <div className="space-y-3">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.verify.verifying')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('auth.verify.successTitle')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
              <Link
                to="/login"
                className="inline-block mt-2 bg-blue-700 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors"
              >
                {t('auth.verify.goToLogin')}
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('auth.verify.errorTitle')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
              <Link
                to="/login"
                className="inline-block mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {t('auth.verify.backToLogin')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
