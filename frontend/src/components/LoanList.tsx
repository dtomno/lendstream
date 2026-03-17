import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchLoans } from '../api';
import type { LoanApplication } from '../types';
import PipelineModal from './PipelineModal';

interface Props {
  refreshKey: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PROCESSING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function LoanList({ refreshKey }: Props) {
  const { t } = useTranslation();
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchLoans();
      setLoans(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Auto-refresh when there are pending/processing loans
  useEffect(() => {
    const hasPending = loans.some((l) => l.status === 'PENDING' || l.status === 'PROCESSING');
    if (!hasPending) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [loans, load]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('loanList.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('loanList.subtitle', { count: loans.length })}
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
        >
          {t('loanList.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">{t('loanList.loading')}</div>
      ) : loans.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">{t('loanList.empty')}</p>
          <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">{t('loanList.emptyHint')}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {loans.map((loan) => (
            <button
              key={loan.id}
              onClick={() => setSelectedId(loan.id)}
              className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{loan.applicant_name}</p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_STYLES[loan.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}
                    >
                      {loan.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {loan.email} · {loan.purpose}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    ${Number(loan.amount).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{timeAgo(loan.created_at)}</p>
                </div>
              </div>

              {/* Mini pipeline progress bar */}
              <div className="mt-2 flex gap-1">
                {['Submitted', 'Credit', 'Risk', 'Decision', 'Account'].map((stage, i) => {
                  const stageReached =
                    loan.status === 'APPROVED'
                      ? true
                      : loan.status === 'REJECTED'
                      ? i < 4
                      : i === 0;
                  return (
                    <div
                      key={stage}
                      className={`flex-1 h-1 rounded-full ${stageReached ? 'bg-blue-400 dark:bg-blue-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                    />
                  );
                })}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <PipelineModal loanId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
