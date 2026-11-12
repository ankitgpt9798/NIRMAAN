import en from './en';
import hi from './hi';

/**
 * All loaded texts, per language. The customer texts are built in; the admin
 * area adds its own texts when its code is loaded (see i18n/admin.js), so
 * customers never download them.
 */
export const dictionaries = { en: { ...en }, hi: { ...hi } };

export function addTranslations(extra) {
  for (const [lang, texts] of Object.entries(extra)) {
    dictionaries[lang] = { ...dictionaries[lang], ...texts };
  }
}
