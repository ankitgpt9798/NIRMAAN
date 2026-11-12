import { Languages } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '../../i18n/languages';

const TONES = {
  // Dark green top bar of the customer website
  dark: { icon: 'text-brand-100', label: 'text-brand-100', group: 'bg-white/10', active: 'bg-white text-brand-800', idle: 'text-white hover:bg-white/10' },
  // Light customer header: forest green marks the chosen language
  brand: { icon: 'text-slate-500', label: 'text-slate-600', group: 'bg-slate-100', active: 'bg-forest text-white', idle: 'text-slate-700 hover:bg-white' },
  // White admin header
  light: { icon: 'text-slate-500', label: 'text-slate-600', group: 'bg-slate-100', active: 'bg-white text-brand-800 shadow-sm', idle: 'text-slate-700 hover:bg-white/60' },
};

/**
 * Always-visible "हिंदी | English" switch, shared by the customer website and the
 * admin (one language choice for the whole session). The label is written in both
 * languages so everyone can find it.
 * `compact`: on narrow phones the label is visually hidden (still read by screen readers).
 */
export default function LanguageSwitcher({ compact = false, tone = 'dark', id = 'language-label' }) {
  const { lang, setLang, t } = useI18n();
  const style = TONES[tone];
  return (
    <div className="flex items-center gap-2">
      <Languages className={`size-4 shrink-0 ${style.icon} ${compact ? 'hidden sm:block' : ''}`} aria-hidden="true" />
      <span id={id} className={`text-sm ${style.label} ${compact ? 'sr-only sm:not-sr-only' : ''}`}>
        {t('language.label')}
      </span>
      <div role="group" aria-labelledby={id} className={`flex rounded-lg p-0.5 ${style.group}`}>
        {SUPPORTED_LANGUAGES.map((code) => {
          const active = code === lang;
          return (
            <button
              key={code}
              type="button"
              lang={code}
              onClick={() => setLang(code)}
              aria-pressed={active}
              className={`min-h-10 min-w-14 rounded-md px-2.5 font-semibold sm:min-w-16 sm:px-3 ${active ? style.active : style.idle}`}
            >
              {LANGUAGE_NAMES[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
