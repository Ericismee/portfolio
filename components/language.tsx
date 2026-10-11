'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Language } from '../lib/schema';
const LanguageContext = createContext<{
  language: Language;
  t: (vi: string, en: string) => string;
  toggle: () => void;
}>({
  language: 'en',
  t: (_vi, en) => en,
  toggle: () => {},
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('profile-language');
      if (saved === 'vi' || saved === 'en') setLanguage(saved);
    } catch {
      /* English remains available without browser storage. */
    }
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
            try {
              localStorage.setItem('profile-language', next);
            } catch {
              /* Keep the selection for this visit. */
            }
            return next;
          }),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
