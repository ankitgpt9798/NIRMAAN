import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, History, IndianRupee, Search, X } from 'lucide-react';
import { Badge } from '../../components/admin/Badges';
import Pagination from '../../components/admin/Pagination';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnSecondary, card, inputClass } from '../../components/admin/styles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { fillTemplate } from '../../i18n/fill';
import { listPriceHistory } from '../../services/adminApi';
import { formatPrice, formatPriceChange } from '../../utils/format';

const PAGE_SIZE = 30;

/** Every recorded price change, newest first. */
export default function PriceHistoryPage() {
  const { t, pick } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const productId = searchParams.get('product') ?? '';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const filterKey = JSON.stringify({ productId, debouncedSearch });
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const query = { product: productId, search: debouncedSearch, page, limit: PAGE_SIZE };
  const history = useFetch(JSON.stringify(query), () => listPriceHistory(query));
  const items = history.data?.items ?? [];
  const filtered = Boolean(productId || debouncedSearch);
  const total = history.data?.total ?? 0;

  return (
    <div className="max-w-4xl">
      <title>{`${t('admin.nav.priceHistory')} · ${t('admin.brand')}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.priceHistory')}</h1>
        <Link to="/admin/prices" className={btnSecondary}>
          <IndianRupee className="size-4" aria-hidden="true" />
          {t('admin.nav.prices')}
        </Link>
      </div>
      <p className="mt-1 text-slate-600">{t('admin.history.intro')}</p>

      <div className={`${card} mt-4 space-y-3 p-4`}>
        <div className="relative">
          <label htmlFor="history-search" className="sr-only">
            {t('admin.history.searchLabel')}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="history-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.history.searchPlaceholder')}
            className={`${inputClass(false)} pl-10`}
          />
        </div>
        {productId && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {items[0] ? t('admin.history.oneProductNamed', { name: pick(items[0].product, 'name') }) : t('admin.history.oneProduct')}
            <button type="button" onClick={() => setSearchParams({}, { replace: true })} className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline">
              <X className="size-4" aria-hidden="true" />
              {t('admin.history.showAll')}
            </button>
          </p>
        )}
      </div>

      <div className="mt-4" aria-busy={history.loading}>
        {history.failure && <ErrorBlock message={apiErrorMessage(history.failure, t)} onRetry={history.reload} />}
        {!history.data && history.loading && <LoadingBlock label={t('admin.history.loading')} />}
        {history.data && items.length === 0 && (
          <EmptyState icon={History} title={filtered ? t('admin.history.noneFound') : t('admin.history.none')}>
            {filtered
              ? t('admin.history.tryDifferent')
              : fillTemplate(t('admin.history.noneHint'), {
                  link: (
                    <Link to="/admin/prices" className="text-accent-700 underline">
                      {t('admin.nav.prices')}
                    </Link>
                  ),
                })}
          </EmptyState>
        )}
        {items.length > 0 && (
          <>
            <p className="mb-2 text-sm text-slate-500">
              {total === 1 ? t('admin.history.count.one') : t('admin.history.count.other', { count: total })}
              {history.loading && ` · ${t('admin.products.updating')}`}
            </p>
            <ul className="space-y-2">
              {items.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </ul>
            <Pagination
              page={history.data.page}
              totalPages={history.data.totalPages}
              total={total}
              countKey="admin.history.count.other"
              disabled={history.loading}
              onChange={(next) => setPageState({ key: filterKey, page: next })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ entry }) {
  const { t, lang, pick, formatDateTime } = useI18n();
  const up = entry.difference > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = up ? 'text-red-700' : 'text-brand-700'; // price up = costlier for customers
  const name = pick(entry.product, 'name');
  const otherName = lang === 'hi' ? entry.product.nameEn : entry.product.nameHi;
  return (
    <li className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}>
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">
          {entry.product.deleted ? (
            name
          ) : (
            <Link to={`/admin/price-history?product=${entry.product.id}`} className="hover:underline">
              {name}
            </Link>
          )}{' '}
          {entry.product.deleted && <Badge>{t('admin.common.productDeleted')}</Badge>}
        </p>
        {otherName && otherName !== name && (
          <p className="text-sm text-slate-600" lang={lang === 'hi' ? 'en' : 'hi'}>
            {otherName}
          </p>
        )}
        <p className="text-sm text-slate-500">
          <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
          {entry.updatedBy && <> · {t('admin.common.by', { name: entry.updatedBy.name })}</>}
        </p>
      </div>
      <div className="text-right">
        <p className="flex items-center justify-end gap-2 text-lg">
          <span className="text-slate-500 line-through" aria-label={t('admin.history.oldPrice', { price: formatPrice(entry.previousPrice) })}>
            {formatPrice(entry.previousPrice)}
          </span>
          <ArrowRight className="size-4 text-slate-400" aria-hidden="true" />
          <span className="font-bold text-slate-900" aria-label={t('admin.history.newPrice', { price: formatPrice(entry.newPrice) })}>
            {formatPrice(entry.newPrice)}
          </span>
        </p>
        <p className={`flex items-center justify-end gap-1 text-sm font-semibold ${tone}`}>
          <Icon className="size-4" aria-hidden="true" />
          {formatPriceChange(entry.difference, entry.percentChange, t('admin.history.noChange'))}
        </p>
      </div>
    </li>
  );
}
