import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

const LOAN_SERVICE_URL = import.meta.env.VITE_LOAN_SERVICE_URL ?? '';
const IS_LOCAL = !LOAN_SERVICE_URL;

const DEV_LINKS = [
  { key: 'kafkaUI',  href: 'http://localhost:8080' },
  { key: 'grafana',  href: 'http://localhost:3007' },
];
const API_DOCS_HREF = IS_LOCAL
  ? 'http://localhost:3001/api/docs'
  : `${LOAN_SERVICE_URL}/api/docs`;

export default function Navbar({ dark, onToggleDark }: Props) {
  const { t } = useTranslation();
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <header className="bg-blue-700 dark:bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t('app.name')}</h1>
          <p className="text-blue-200 dark:text-slate-400 text-xs mt-0.5 hidden sm:block">
            {t('app.taglineFull')}
          </p>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Service badges — only on larger screens */}
          <div className="hidden lg:flex items-center gap-1.5">
            {IS_LOCAL && DEV_LINKS.map(({ key, href }) => (
              <ServiceBadge key={key} label={t(`nav.${key}`)} href={href} />
            ))}
            <ServiceBadge label={t('nav.apiDocs')} href={API_DOCS_HREF} />
          </div>

          {/* Language switcher */}
          <LanguageSwitcher variant="dark-nav" />

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            title={dark ? t('auth.switchToLight') : t('auth.switchToDark')}
            className="flex items-center gap-1 text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 px-2 sm:px-2.5 py-1 rounded-lg transition-colors"
          >
            <span>{dark ? '☀️' : '🌙'}</span>
            <span className="hidden sm:inline">{dark ? t('nav.light') : t('nav.dark')}</span>
          </button>

          {user && (
            <>
              {/* Desktop user info + logout */}
              <div className="hidden sm:flex items-center gap-2 ml-1 border-l border-blue-500 dark:border-slate-700 pl-3">
                <div className="text-right">
                  <p className="text-xs font-medium max-w-[140px] truncate">{user.email}</p>
                  <p className="text-blue-300 dark:text-slate-400 text-xs">{user.role.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-white/10 hover:bg-red-600 border border-white/20 hover:border-red-500 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                >
                  {t('nav.logout')}
                </button>
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="sm:hidden flex items-center justify-center w-8 h-8 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
                aria-label="Menu"
              >
                {menuOpen ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && user && (
        <div className="sm:hidden border-t border-blue-600 dark:border-slate-700 bg-blue-800 dark:bg-slate-800 px-4 py-3 space-y-3">
          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-slate-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-blue-300 dark:text-slate-400 text-xs">{user.role.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Service links */}
          <div className="flex flex-wrap gap-2">
            {IS_LOCAL && DEV_LINKS.map(({ key, href }) => (
              <MobileServiceBadge key={key} label={t(`nav.${key}`)} href={href} />
            ))}
            <MobileServiceBadge label={t('nav.apiDocs')} href={API_DOCS_HREF} />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full text-sm font-medium bg-red-600/80 hover:bg-red-600 border border-red-500/50 py-2 rounded-lg transition-colors text-left px-3"
          >
            {t('nav.logout')}
          </button>
        </div>
      )}
    </header>
  );
}

function ServiceBadge({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
    >
      {label} ↗
    </a>
  );
}

function MobileServiceBadge({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1.5 rounded-lg transition-colors"
    >
      {label} ↗
    </a>
  );
}
