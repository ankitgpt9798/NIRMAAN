import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import FullPageLoader from './FullPageLoader';

/** Shows nested admin routes only to a logged-in admin; everyone else goes to the login page. */
export default function ProtectedRoute() {
  const { status, notice, retry } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (status === 'checking') return <FullPageLoader label={t('admin.login.checking')} />;

  if (status === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <CircleAlert className="size-10 text-amber-600" aria-hidden="true" />
        <p className="mt-3 text-lg">{t(notice || 'admin.error.generic')}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-700 px-6 text-lg font-semibold text-white hover:bg-brand-800"
        >
          <RefreshCw className="size-5" aria-hidden="true" />
          {t('admin.common.tryAgain')}
        </button>
      </div>
    );
  }

  if (status !== 'signed-in') {
    return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
