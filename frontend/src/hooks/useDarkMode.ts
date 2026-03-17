import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => {
    document.documentElement.classList.add('theme-transition');
    setDark((d) => !d);
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  };

  return { dark, toggle };
}
