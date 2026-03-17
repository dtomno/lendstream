import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitLoan } from '../api';

interface Props {
  onSubmitted: () => void;
}

const PURPOSES = ['Home Renovation', 'Debt Consolidation', 'Education', 'Medical', 'Business', 'Vehicle', 'Personal'] as const;
const EMPLOYMENT_STATUSES = ['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED'] as const;

const inputCls =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function LoanForm({ onSubmitted }: Props) {
  const { t } = useTranslation();

  const [form, setForm] = useState({
    applicantName: '',
    email: '',
    amount: '',
    purpose: PURPOSES[0] as string,
    income: '',
    employmentStatus: 'EMPLOYED' as string,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const loan = await submitLoan({
        ...form,
        amount: parseFloat(form.amount),
        income: parseFloat(form.income),
      });
      setSuccess(t('loanForm.successMessage', { id: loan.id.slice(0, 8) }));
      setForm({ applicantName: '', email: '', amount: '', purpose: PURPOSES[0], income: '', employmentStatus: 'EMPLOYED' });
      onSubmitted();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('loanForm.errorDefault');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">{t('loanForm.title')}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{t('loanForm.subtitle')}</p>

      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('loanForm.fullName')}</label>
          <input
            type="text"
            value={form.applicantName}
            onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
            className={inputCls}
            placeholder={t('loanForm.fullNamePlaceholder')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('loanForm.email')}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputCls}
            placeholder={t('loanForm.emailPlaceholder')}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('loanForm.loanAmount')}</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={inputCls}
              placeholder="25000"
              min="500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('loanForm.annualIncome')}
              {form.employmentStatus === 'UNEMPLOYED' && (
                <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{t('loanForm.incomeNA')}</span>
              )}
            </label>
            <input
              type="number"
              value={form.income}
              onChange={(e) => setForm({ ...form, income: e.target.value })}
              className={`${inputCls} ${form.employmentStatus === 'UNEMPLOYED' ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="75000"
              min={form.employmentStatus === 'UNEMPLOYED' ? '0' : '1'}
              disabled={form.employmentStatus === 'UNEMPLOYED'}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('loanForm.loanPurpose')}</label>
          <select
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            className={inputCls}
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>{t(`loanForm.purposes.${p}`, p)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('loanForm.employmentStatus')}</label>
          <select
            value={form.employmentStatus}
            onChange={(e) => {
              const status = e.target.value;
              setForm({ ...form, employmentStatus: status, income: status === 'UNEMPLOYED' ? '0' : (form.income === '0' ? '' : form.income) });
            }}
            className={inputCls}
          >
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`employment.${s}`, s)}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? t('loanForm.submitting') : t('loanForm.submit')}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t('loanForm.pipelineHint')}
        </p>
      </div>
    </div>
  );
}
