import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import Alert from './Alert';
import { btnSecondary } from './styles';

export function LoadingBlock({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600" role="status">
      <LoaderCircle className="size-5 animate-spin text-brand-600" aria-hidden="true" />
      {label ?? t('admin.common.loading')}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <Alert
      tone="error"
      action={
        onRetry && (
          <button type="button" className={btnSecondary} onClick={onRetry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('admin.common.tryAgain')}
          </button>
        )
      }
    >
      {message}
    </Alert>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      {Icon && <Icon className="mx-auto size-10 text-slate-400" aria-hidden="true" />}
      <p className="mt-3 text-lg font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 text-slate-500">{children}</div>}
    </div>
  );
}
