import { createContext, useContext } from 'react';

/** Language state for the customer website and the admin, provided by <I18nProvider>. */
export const I18nContext = createContext(null);

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
