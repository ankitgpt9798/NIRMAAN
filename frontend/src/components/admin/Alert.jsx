import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

const TONES = {
  success: { icon: CheckCircle2, className: 'bg-brand-50 text-brand-800 border-brand-200' },
  error: { icon: CircleAlert, className: 'bg-red-50 text-red-800 border-red-200' },
  info: { icon: Info, className: 'bg-accent-50 text-accent-700 border-accent-200' },
  warning: { icon: CircleAlert, className: 'bg-amber-50 text-amber-900 border-amber-200' },
};

export default function Alert({ tone = 'info', children, onClose, action }) {
  const { t } = useI18n();
  const { icon: Icon, className } = TONES[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} className="-m-1 rounded-lg p-1 opacity-70 hover:opacity-100" aria-label={t('admin.common.dismiss')}>
          <X className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
