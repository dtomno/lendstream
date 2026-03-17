import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchPipeline } from '../api';
import type { LoanPipeline } from '../types';

interface Props {
  loanId: string;
  onClose: () => void;
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400',
  MEDIUM: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400',
  HIGH: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400',
  VERY_HIGH: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  B: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
  D: 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
};

function StageRow({
  step,
  title,
  done,
  waiting,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  waiting: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
            ${done ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}
        >
          {done ? '✓' : step}
        </div>
        {step < 5 && (
          <div
            className={`w-0.5 flex-1 min-h-[16px] mt-1 ${
              done ? 'bg-blue-300 dark:bg-blue-700' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        )}
      </div>
      <div className="pb-5 flex-1">
        <p className={`text-sm font-semibold ${done ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
          {title}
        </p>
        {done && children && <div className="mt-2">{children}</div>}
        {!done && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{waiting}</p>}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-xs py-0.5">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

export default function PipelineModal({ loanId, onClose }: Props) {
  const { t } = useTranslation();
  const [pipeline, setPipeline] = useState<LoanPipeline | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchPipeline(loanId);
      setPipeline(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    load();
    const interval = setInterval(async () => {
      const data = await fetchPipeline(loanId);
      setPipeline(data);
      if (data.loan.status === 'APPROVED' || data.loan.status === 'REJECTED') {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [loanId, load]);

  const p = pipeline;
  const waiting = t('pipeline.waiting');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('pipeline.title')}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{loanId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {loading && !p ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">{t('pipeline.loading')}</div>
          ) : p ? (
            <div>
              {/* Stage 1: Application */}
              <StageRow step={1} title={t('pipeline.stage1')} done={true} waiting={waiting}>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
                  <KV label={t('pipeline.labels.applicant')} value={p.loan.applicant_name} />
                  <KV label={t('pipeline.labels.amount')} value={`$${Number(p.loan.amount).toLocaleString()}`} />
                  <KV label={t('pipeline.labels.income')} value={`$${Number(p.loan.income).toLocaleString()}/yr`} />
                  <KV label={t('pipeline.labels.employment')} value={t(`employment.${p.loan.employment_status}`, p.loan.employment_status.replace('_', ' '))} />
                  <KV label={t('pipeline.labels.purpose')} value={p.loan.purpose} />
                </div>
              </StageRow>

              {/* Stage 2: Credit Check */}
              <StageRow step={2} title={t('pipeline.stage2')} done={!!p.credit} waiting={waiting}>
                {p.credit && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
                    <KV
                      label={t('pipeline.labels.creditScore')}
                      value={<span className="text-base font-bold text-blue-600 dark:text-blue-400">{p.credit.credit_score}</span>}
                    />
                    <KV
                      label={t('pipeline.labels.grade')}
                      value={
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${GRADE_COLORS[p.credit.credit_grade] ?? ''}`}>
                          {p.credit.credit_grade}
                        </span>
                      }
                    />
                    <KV label={t('pipeline.labels.paymentHistory')} value={p.credit.payment_history} />
                    <KV label={t('pipeline.labels.existingDebts')} value={`$${Number(p.credit.existing_debts).toLocaleString()}`} />
                  </div>
                )}
              </StageRow>

              {/* Stage 3: Risk Assessment */}
              <StageRow step={3} title={t('pipeline.stage3')} done={!!p.risk} waiting={waiting}>
                {p.risk && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
                    <KV
                      label={t('pipeline.labels.riskLevel')}
                      value={
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${RISK_COLORS[p.risk.risk_level] ?? ''}`}>
                          {p.risk.risk_level.replace('_', ' ')}
                        </span>
                      }
                    />
                    <KV label={t('pipeline.labels.riskScore')} value={`${p.risk.risk_score} / 100`} />
                    <KV label={t('pipeline.labels.dti')} value={`${(Number(p.risk.debt_to_income_ratio) * 100).toFixed(1)}%`} />
                  </div>
                )}
              </StageRow>

              {/* Stage 4: Decision */}
              <StageRow step={4} title={t('pipeline.stage4')} done={!!p.decision} waiting={waiting}>
                {p.decision && (
                  <div
                    className={`rounded-lg p-3 space-y-1 ${
                      p.decision.decision === 'APPROVED'
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          p.decision.decision === 'APPROVED'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {p.decision.decision}
                      </span>
                    </div>
                    {p.decision.decision === 'APPROVED' && (
                      <>
                        <KV label={t('pipeline.labels.approvedAmount')} value={`$${Number(p.decision.approved_amount).toLocaleString()}`} />
                        <KV label={t('pipeline.labels.interestRate')} value={`${p.decision.interest_rate}% p.a.`} />
                      </>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{p.decision.reason}</p>
                  </div>
                )}
              </StageRow>

              {/* Stage 5: Account */}
              <StageRow step={5} title={t('pipeline.stage5')} done={!!p.account} waiting={waiting}>
                {p.account && (
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1">
                    <KV label={t('pipeline.labels.accountNumber')} value={<span className="font-mono text-xs">{p.account.account_number}</span>} />
                    <KV label={t('pipeline.labels.monthlyPayment')} value={`$${Number(p.account.monthly_payment).toLocaleString()}`} />
                    <KV label={t('pipeline.labels.term')} value={`${p.account.term_months} months`} />
                    <KV label={t('pipeline.labels.status')} value={p.account.status} />
                  </div>
                )}
                {p.decision?.decision === 'REJECTED' && !p.account && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t('pipeline.notApplicable')}</p>
                )}
              </StageRow>

              {/* Notifications */}
              {p.notifications.length > 0 && (
                <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{t('pipeline.notificationsSent')}</p>
                  {p.notifications.map((n) => (
                    <div key={n.id} className="text-xs bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 mb-2">
                      <p className="font-medium text-blue-800 dark:text-blue-300">{n.subject}</p>
                      <p className="text-blue-600 dark:text-blue-400 mt-0.5">{t('pipeline.to')}: {n.recipient_email}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
