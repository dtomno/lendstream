import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

export default function Navbar({ dark, onToggleDark }: Props) {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <header className="bg-blue-700 dark:bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">LendStream</h1>
          <p className="text-blue-200 dark:text-slate-400 text-xs mt-0.5">
            Event-Driven Loan Processing · Apache Kafka + Microservices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ServiceBadge label="Kafka UI" href="http://localhost:8080" />
          <ServiceBadge label="Grafana" href="http://localhost:3007" />
          <ServiceBadge label="API Docs" href="http://localhost:3001/api/docs" />

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            <span>{dark ? '☀️' : '🌙'}</span>
            <span className="hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
          </button>

          {user && (
            <div className="flex items-center gap-3 ml-1 border-l border-blue-500 dark:border-slate-700 pl-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium">{user.email}</p>
                <p className="text-blue-300 dark:text-slate-400 text-xs">{user.role.replace('_', ' ')}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs bg-white/10 hover:bg-red-600 border border-white/20 hover:border-red-500 px-2.5 py-1 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ServiceBadge({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 rounded-lg transition-colors"
    >
      {label} ↗
    </a>
  );
}
