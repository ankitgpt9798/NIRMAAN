import { useEffect, useState } from 'react';
import { Info, LoaderCircle, Truck } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

/** "Prices may change…" message shown on the catalogue and on every product page. */
export function PriceNotice() {
  const { t } = useI18n();
  return (
    <p className="flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50 p-3 text-accent-700">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>{t('notice.prices')}</span>
    </p>
  );
}

/** Transport note for sand, gravel, aggregates, etc. (category setting). */
export function DeliveryNotice() {
  const { t } = useI18n();
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <Truck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>{t('notice.delivery')}</span>
    </p>
  );
}

/**
 * Shown only if loading takes more than a few seconds: free hosting can need up
 * to a minute to wake up after being idle. Mount it only while loading.
 */
export function SlowLoadingNotice({ delay = 4000 }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  if (!show) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-slate-700" role="status">
      <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-brand-600" aria-hidden="true" />
      <span>{t('catalog.slow')}</span>
    </p>
  );
}
