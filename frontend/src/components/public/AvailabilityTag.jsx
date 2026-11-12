import { CheckCircle2, CircleSlash, Clock } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

const STYLES = {
  in_stock: { icon: CheckCircle2, className: 'bg-brand-50 text-brand-800 ring-brand-200' },
  out_of_stock: { icon: CircleSlash, className: 'bg-red-50 text-red-800 ring-red-200' },
  unavailable: { icon: Clock, className: 'bg-amber-50 text-amber-900 ring-amber-200' },
};

/** Colour + icon + text, so the status is clear even without colour vision. */
export default function AvailabilityTag({ value, size = 'md' }) {
  const { t } = useI18n();
  const { icon: Icon, className } = STYLES[value] ?? STYLES.unavailable;
  const sizing = size === 'lg' ? 'px-3 py-1 text-base' : 'px-2.5 py-0.5 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${sizing} ${className}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {t(`availability.${value}`)}
    </span>
  );
}
