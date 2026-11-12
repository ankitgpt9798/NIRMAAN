import { Link, useOutletContext } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

/** Unknown address on the customer website (shown inside the normal page frame, in the chosen language). */
export default function NotFoundPage() {
  const { t } = useI18n();
  const { siteName } = useOutletContext() ?? {};

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <title>{siteName ? `${t('notFound.title')} – ${siteName}` : t('notFound.title')}</title>
      <meta name="robots" content="noindex" />
      <SearchX className="mx-auto size-12 text-slate-400" aria-hidden="true" />
      <h1 className="mt-3 text-2xl font-bold text-brand-800">{t('notFound.title')}</h1>
      <p className="mt-1 text-slate-600">{t('notFound.body')}</p>
      <Link to="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-6 text-lg font-semibold text-white hover:bg-brand-800">
        {t('catalog.showAll')}
      </Link>
    </div>
  );
}
