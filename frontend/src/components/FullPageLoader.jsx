import { LoaderCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

/** Full-screen "Loading…". Uses a built-in text, because it also shows while the admin code is still downloading. */
export default function FullPageLoader({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh items-center justify-center px-4" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-lg text-slate-600">
        <LoaderCircle className="size-6 animate-spin text-brand-600" aria-hidden="true" />
        {label ?? t('common.loading')}
      </div>
    </div>
  );
}
