import { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nContext } from './I18nContext';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, LOCALES, SUPPORTED_LANGUAGES } from './languages';
import { dictionaries } from './dictionaries';

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
}

// Storage can be unavailable (private mode, blocked site data): fall back silently.
function readStoredLanguage() {
  try {
    const stored = window.sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeLanguage(lang) {
  try {
    window.sessionStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // The choice still applies to this page; it just is not remembered.
  }
}

/**
 * Provides:
 *   lang, setLang(code) – current language ('hi' by default) and a switcher; the
 *                         choice is remembered for the browsing session and applies
 *                         instantly, without reloading the page or the prices
 *   t(key, vars)        – translated text (falls back to English, then the key)
 *   pick(item, base)    – bilingual database field, e.g. pick(product, 'name') →
 *                         nameHi/nameEn, falling back to the other language when empty
 *   formatDate(value)   – "05 नवंबर 2026" / "05 November 2026"
 */
export default function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => readStoredLanguage() ?? DEFAULT_LANGUAGE);

  // Correct language for screen readers, hyphenation and font selection.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!SUPPORTED_LANGUAGES.includes(next)) return;
    setLangState(next);
    storeLanguage(next);
  }, []);

  const value = useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: 'long', year: 'numeric' });
    const dateTimeFormat = new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short' });
    const suffixes = lang === 'hi' ? ['Hi', 'En'] : ['En', 'Hi'];

    return {
      lang,
      setLang,
      // Looked up at call time, so texts added later (the admin area) are found too.
      t: (key, vars) => interpolate(dictionaries[lang][key] ?? dictionaries.en[key] ?? key, vars),
      formatDateTime: (date) => (date ? dateTimeFormat.format(new Date(date)) : ''),
      pick: (item, base) => {
        if (!item) return '';
        for (const suffix of suffixes) {
          const text = item[`${base}${suffix}`];
          if (typeof text === 'string' && text.trim()) return text;
        }
        return '';
      },
      formatDate: (date) => (date ? dateFormat.format(new Date(date)) : ''),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
