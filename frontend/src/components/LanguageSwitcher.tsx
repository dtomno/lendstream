import i18n from '../i18n';

const LANGUAGES = [
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'fr', label: '🇫🇷 FR' },
  { code: 'es', label: '🇪🇸 ES' },
  { code: 'de', label: '🇩🇪 DE' },
  { code: 'sw', label: '🇰🇪 SW' },
];

interface Props {
  variant?: 'light' | 'dark-nav';
}

export default function LanguageSwitcher({ variant = 'light' }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const isNav = variant === 'dark-nav';

  return (
    <select
      value={i18n.language}
      onChange={handleChange}
      className={
        isNav
          ? 'text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 text-white px-2 py-1 rounded-lg transition-colors cursor-pointer appearance-none'
          : 'text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer appearance-none'
      }
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
          {label}
        </option>
      ))}
    </select>
  );
}
