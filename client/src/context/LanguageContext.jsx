import { createContext, useContext } from 'react';

export const LanguageContext = createContext({ lang: 'vi', setLang: () => {} });
export const useLanguage = () => useContext(LanguageContext);
