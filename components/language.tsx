'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Language } from '../lib/schema';
const LanguageContext = createContext<{
  language: Language;
  t: (vi: string, en: string) => string;
  toggle: () => void;
}>({
  language: 'vi',
  t: (vi) => vi,
  toggle: () => {},
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('vi');
  useEffect(() => {
    if (localStorage.getItem('profile-language') === 'en') setLanguage('en');
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider
      value={{
        language,
        t: (vi, en) => (language === 'en' ? en : vi),
        toggle: () =>
          setLanguage((value) => {
            const next = value === 'vi' ? 'en' : 'vi';
            localStorage.setItem('profile-language', next);
            return next;
          }),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
