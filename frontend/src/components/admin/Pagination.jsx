import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { btnSecondary } from './styles';

export default function Pagination({ page, totalPages, total, onChange, disabled, countKey = 'admin.common.itemCount' }) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('admin.common.pageOf', { page, total: totalPages })}>
      <button type="button" className={btnSecondary} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="size-5" aria-hidden="true" />
        {t('admin.common.previous')}
      </button>
      <p className="text-center text-sm text-slate-600">
        {t('admin.common.pageOf', { page, total: totalPages })}
        <span className="block text-slate-500">{t(countKey, { count: total })}</span>
      </p>
      <button type="button" className={btnSecondary} disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        {t('admin.common.next')}
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
