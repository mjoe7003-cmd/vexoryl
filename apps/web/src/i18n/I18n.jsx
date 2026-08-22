import React, { createContext, useContext, useMemo, useState } from 'react';
import { dictionaries } from './translations.js';

const I18nContext = createContext(null);

export function I18nProvider({ children, defaultLocale = import.meta.env.VITE_DEFAULT_LOCALE || 'en' }) {
  const [locale, setLocale] = useState(dictionaries[defaultLocale] ? defaultLocale : 'en');
  const value = useMemo(() => ({ locale, setLocale, languages: Object.keys(dictionaries), t: (key) => dictionaries[locale][key] || dictionaries.en[key] || key }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useTranslation must be used inside I18nProvider');
  return value;
}