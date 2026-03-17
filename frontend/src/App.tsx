import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import LoanForm from './components/LoanForm';
import LoanList from './components/LoanList';
import { useDarkMode } from './hooks/useDarkMode';
import { useServiceWakeup } from './hooks/useServiceWakeup';
import WakingUpOverlay from './components/WakingUpOverlay';

const FLOW_ITEMS = [
  'Loan Service',
  'loan-application-submitted',
  'Credit Service',
  'credit-check-completed',
  'Risk Service',
  'risk-assessment-completed',
  'Approval Service',
  'loan-decision-made',
  'Account Service',
];

// const TECH_STACK = [
//   { label: 'Services', value: 'Node.js + TypeScript' },
//   { label: 'Messaging', value: 'Apache Kafka (KRaft)' },
//   { label: 'Database', value: 'PostgreSQL (per service)' },
//   { label: 'Auth', value: 'JWT + bcrypt' },
//   { label: 'Patterns', value: 'Outbox · DLQ · Idempotency' },
//   { label: 'Observability', value: 'Prometheus + Grafana' },
//   { label: 'Frontend', value: 'React + Vite + Tailwind' },
//   { label: 'Gateway', value: 'nginx reverse proxy' },
//   { label: 'Deploy', value: 'Docker Compose' },
// ];

function Dashboard({ onToggleDark, dark }: { onToggleDark: () => void; dark: boolean }) {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar onToggleDark={onToggleDark} dark={dark} />

      {/* Architecture banner */}
      <div className="bg-blue-600 dark:bg-slate-800 text-white text-xs py-2">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          <span className="opacity-60">{t('appFlow.label')}</span>
          {FLOW_ITEMS.map((item, i) => (
            <span
              key={i}
              className={
                i % 2 === 0
                  ? 'bg-blue-500 dark:bg-slate-700 px-2 py-0.5 rounded font-medium'
                  : 'opacity-70'
              }
            >
              {i % 2 !== 0 ? '→ ' : ''}
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <LoanForm onSubmitted={() => setRefreshKey((k) => k + 1)} />

            {/* Stack info - Collapsible */}
            {/* <details className="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <summary className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100">
                {t('techStack.title')}
              </summary>
              <div className="space-y-2 mt-3">
                {TECH_STACK.map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{t(`techStack.items.${label}`, label)}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{value}</span>
                  </div>
                ))}
              </div>
            </details> */}
          </div>

          <div className="lg:col-span-2">
            <LoanList refreshKey={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { dark, toggle } = useDarkMode();
  const wakeupStatus = useServiceWakeup();

  return (
    <BrowserRouter>
      <AuthProvider>
        <WakingUpOverlay status={wakeupStatus} />
        <Routes>
          <Route path="/login" element={<LoginPage dark={dark} onToggleDark={toggle} />} />
          <Route path="/register" element={<RegisterPage dark={dark} onToggleDark={toggle} />} />
          <Route path="/verify-email" element={<VerifyEmailPage dark={dark} onToggleDark={toggle} />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard onToggleDark={toggle} dark={dark} />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
