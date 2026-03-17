import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import fr from './locales/fr';
import es from './locales/es';
import de from './locales/de';
import sw from './locales/sw';

const SUPPORTED = ['en', 'fr', 'es', 'de', 'sw'];

function detectLang(): string {
  const saved = localStorage.getItem('language');
  if (saved && SUPPORTED.includes(saved)) return saved;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    de: { translation: de },
    sw: { translation: sw },
  },
  lng: detectLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// When the device/browser language changes, follow it — but only if the
// user has not explicitly chosen a language via the UI (no saved preference).
window.addEventListener('languagechange', () => {
  if (localStorage.getItem('language')) return; // respect manual selection
  const browser = navigator.language.slice(0, 2).toLowerCase();
  const next = SUPPORTED.includes(browser) ? browser : 'en';
  i18n.changeLanguage(next);
});

export default i18n;
