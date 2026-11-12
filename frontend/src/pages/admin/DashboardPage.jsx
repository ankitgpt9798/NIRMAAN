import { Link } from 'react-router-dom';
import { CircleOff, EyeOff, History, IndianRupee, MessageSquareText, Package, PackageCheck, PackageX, Plus, ShieldCheck, Tags } from 'lucide-react';
import { ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { getDashboardStats } from '../../services/adminApi';
import { formatPrice } from '../../utils/format';

export default function DashboardPage() {
  const { admin } = useAuth();
  const { t, pick, formatDateTime } = useI18n();
  const stats = useFetch('dashboard', getDashboardStats);
  const data = stats.data;

  const cards = data
    ? [
        { labelKey: 'admin.dashboard.totalProducts', value: data.products.total, icon: Package, tone: 'text-brand-700', to: '/admin/products' },
        { labelKey: 'admin.dashboard.categories', value: data.categories.total, icon: Tags, tone: 'text-accent-600', to: '/admin/categories' },
        { labelKey: 'admin.dashboard.inStock', value: data.products.inStock, icon: PackageCheck, tone: 'text-brand-600' },
        { labelKey: 'admin.dashboard.outOfStock', value: data.products.outOfStock, icon: PackageX, tone: 'text-red-600' },
        { labelKey: 'admin.dashboard.unavailable', value: data.products.unavailable, icon: CircleOff, tone: 'text-amber-600' },
        { labelKey: 'admin.dashboard.hidden', value: data.products.inactive, icon: EyeOff, tone: 'text-slate-500' },
      ]
    : [];

  return (
    <div>
      <title>{`${t('admin.nav.dashboard')} · ${t('admin.brand')}`}</title>
      <h1 className="text-2xl font-bold text-brand-800">{t('admin.dashboard.welcome', { name: admin?.name ?? '' })}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-600">
        <ShieldCheck className="size-5 text-brand-600" aria-hidden="true" />
        {t('admin.dashboard.loggedInAs', { email: admin?.email ?? '' })}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/admin/products/new" className={btnPrimary}>
          <Plus className="size-5" aria-hidden="true" />
          {t('admin.products.add')}
        </Link>
        <Link to="/admin/prices" className={btnSecondary}>
          <IndianRupee className="size-5" aria-hidden="true" />
          {t('admin.nav.prices')}
        </Link>
        <Link to="/admin/products" className={btnSecondary}>
          <Package className="size-5" aria-hidden="true" />
          {t('admin.dashboard.allProducts')}
        </Link>
      </div>

      <div className="mt-5">
        {stats.failure && <ErrorBlock message={apiErrorMessage(stats.failure, t)} onRetry={stats.reload} />}
        {!data && stats.loading && <LoadingBlock label={t('admin.dashboard.loading')} />}
        {data?.pendingReviews > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900" role="status">
            <p className="flex items-center gap-2 font-semibold">
              <MessageSquareText className="size-5 shrink-0" aria-hidden="true" />
              {data.pendingReviews === 1 ? t('admin.dashboard.pendingReviews.one') : t('admin.dashboard.pendingReviews.other', { count: data.pendingReviews })}
            </p>
            <Link to="/admin/reviews" className={btnPrimary}>
              {t('admin.dashboard.checkReviews')}
            </Link>
          </div>
        )}
        {data && (
          <>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {cards.map(({ labelKey, value, icon: Icon, tone, to }) => {
                const content = (
                  <>
                    <Icon className={`size-6 ${tone}`} aria-hidden="true" />
                    <span className="mt-2 block text-3xl font-bold text-slate-900">{value}</span>
                    <span className="block text-slate-600">{t(labelKey)}</span>
                  </>
                );
                return (
                  <li key={labelKey}>
                    {to ? (
                      <Link to={to} className={`${card} block p-4 hover:border-brand-300 hover:bg-brand-50`}>
                        {content}
                      </Link>
                    ) : (
                      <div className={`${card} p-4`}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-sm text-slate-500">{t('admin.dashboard.stockNote')}</p>

            <section className={`${card} mt-5 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <History className="size-5 text-accent-600" aria-hidden="true" />
                  {t('admin.dashboard.recent')}
                </h2>
                <Link to="/admin/price-history" className="font-semibold text-accent-700 hover:underline">
                  {t('admin.dashboard.allChanges')}
                </Link>
              </div>
              {data.recentPriceUpdates.length === 0 ? (
                <p className="mt-2 text-slate-500">
                  {t('admin.dashboard.noChanges')}{' '}
                  <Link to="/admin/prices" className="text-accent-700 underline">
                    {t('admin.nav.prices')}
                  </Link>
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.recentPriceUpdates.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="font-medium">{pick(entry, 'productName')}</span>
                      <span>
                        <span className="text-slate-500 line-through">{formatPrice(entry.previousPrice)}</span>{' '}
                        <span className="font-semibold text-brand-800">{formatPrice(entry.newPrice)}</span>
                        <span className="block text-right text-sm text-slate-500">{formatDateTime(entry.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
