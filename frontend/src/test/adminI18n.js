// Test helper: admin pages need the language provider and the admin texts, as in AdminApp.
import '../i18n/admin';
import I18nProvider from '../i18n/I18nProvider';
import { LANGUAGE_STORAGE_KEY } from '../i18n/languages';

/** Chooses the language the next render starts in (the admin opens in Hindi when nothing is chosen). */
export function setTestLanguage(lang) {
  window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export { I18nProvider };
