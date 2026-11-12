import { useI18n } from '../../i18n/I18nContext';

const AVAILABILITY_STYLES = {
  in_stock: 'bg-brand-50 text-brand-800 ring-brand-200',
  out_of_stock: 'bg-red-50 text-red-800 ring-red-200',
  unavailable: 'bg-amber-50 text-amber-900 ring-amber-200',
};

const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset';

/** Stock status in the admin's language (same wording as on the customer site). */
export function AvailabilityBadge({ value }) {
  const { t } = useI18n();
  const className = AVAILABILITY_STYLES[value] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
  return <span className={`${base} ${className}`}>{t(`availability.${value}`)}</span>;
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    blue: 'bg-accent-50 text-accent-700 ring-accent-200',
    amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  };
  return <span className={`${base} ${tones[tone]}`}>{children}</span>;
}
