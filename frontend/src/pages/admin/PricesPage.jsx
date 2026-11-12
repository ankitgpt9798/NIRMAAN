import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, History, IndianRupee, LoaderCircle, Save, Search } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import { Badge } from '../../components/admin/Badges';
import Pagination from '../../components/admin/Pagination';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnPrimary, btnSecondary, card, inputClass } from '../../components/admin/styles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage, messageText, translateServerText } from '../../i18n/apiErrors';
import { fillTemplate } from '../../i18n/fill';
import { listCategories, listProducts, updateProductPrice } from '../../services/adminApi';
import { formatPrice, isLargePriceChange } from '../../utils/format';
import { confirmLargeChanges, describeDraftError, evaluateDraft } from '../../utils/priceDraft';

const PAGE_SIZE = 50;

/** Row result text: a description { key, vars } or a server error, translated when shown. */
function rowMessageText(row, t) {
  if (!row) return '';
  if (row.failure) {
    const detail = row.failure?.response?.data?.error?.details?.[0]?.message;
    return detail ? translateServerText(detail, t) : apiErrorMessage(row.failure, t, 'admin.prices.saveFailed');
  }
  return messageText(row.message, t);
}

export default function PricesPage() {
  const { t, pick } = useI18n();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [category, setCategory] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const filterKey = JSON.stringify({ debouncedSearch, category });
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const query = { search: debouncedSearch, category, status: 'all', page, limit: PAGE_SIZE };
  const products = useFetch(JSON.stringify(query), () => listProducts(query));
  const categories = useFetch('categories', listCategories);

  const [drafts, setDrafts] = useState({}); // productId → { price, mrp } (typed text)
  const [rows, setRows] = useState({}); // productId → { status, message? , failure? }
  const [summary, setSummary] = useState(null); // { tone, key, vars }
  const [savingAll, setSavingAll] = useState(false);
  const nameOf = (product) => pick(product, 'name');

  const items = products.data?.items ?? [];
  const pending = items
    .map((product) => ({ product, plan: evaluateDraft(product, drafts[product.id]) }))
    .filter(({ product, plan }) => drafts[product.id] && (plan.error || plan.hasChanges));
  const savable = pending.filter(({ plan }) => !plan.error);

  const setDraft = (id, field, value) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
    setRows((current) => ({ ...current, [id]: undefined }));
    setSummary(null);
  };

  /** Saves one row. Returns true when saved. */
  async function saveRow(product, plan) {
    setRows((current) => ({ ...current, [product.id]: { status: 'saving' } }));
    const body = { sellingPrice: plan.sellingPrice, expectedPrice: product.sellingPrice };
    if (plan.mrpChanged) body.mrp = plan.mrp;
    try {
      const result = await updateProductPrice(product.id, body);
      products.mutate((list) => list && { ...list, items: list.items.map((item) => (item.id === product.id ? result.product : item)) });
      setDrafts((current) => ({ ...current, [product.id]: undefined }));
      const message = result.changed
        ? { key: 'admin.prices.saved', vars: { from: formatPrice(result.previousPrice), to: formatPrice(result.product.sellingPrice) } }
        : { key: 'admin.prices.mrpSaved' };
      setRows((current) => ({ ...current, [product.id]: { status: 'saved', message } }));
      return true;
    } catch (error) {
      if (error?.response?.status === 409) {
        const current = error.response.data?.error?.details?.[0]?.currentPrice;
        const message = typeof current === 'number'
          ? { key: 'admin.prices.changedMeanwhileTo', vars: { price: formatPrice(current) } }
          : { key: 'admin.prices.changedMeanwhile' };
        setRows((all) => ({ ...all, [product.id]: { status: 'error', message } }));
        products.reload();
      } else {
        setRows((all) => ({ ...all, [product.id]: { status: 'error', failure: error } }));
      }
      return false;
    }
  }

  async function handleSaveRow(product) {
    const plan = evaluateDraft(product, drafts[product.id]);
    if (plan.error || !plan.hasChanges) return;
    if (!confirmLargeChanges([{ product, plan }], t, nameOf)) return;
    setSummary(null);
    await saveRow(product, plan);
  }

  async function handleSaveAll() {
    if (!savable.length || !confirmLargeChanges(savable, t, nameOf)) return;
    setSavingAll(true);
    setSummary(null);
    let saved = 0;
    for (const { product, plan } of savable) {
      if (await saveRow(product, plan)) saved += 1;
    }
    const failed = savable.length - saved;
    setSummary(
      failed
        ? { tone: 'warning', key: 'admin.prices.summaryPartial', vars: { saved, failed } }
        : { tone: 'success', key: saved === 1 ? 'admin.prices.summary.one' : 'admin.prices.summary.other', vars: { count: saved } },
    );
    setSavingAll(false);
  }

  return (
    <div className="max-w-4xl pb-24">
      <title>{`${t('admin.nav.prices')} · ${t('admin.brand')}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.prices')}</h1>
        <Link to="/admin/price-history" className={btnSecondary}>
          <History className="size-4" aria-hidden="true" />
          {t('admin.nav.priceHistory')}
        </Link>
      </div>
      <p className="mt-1 text-slate-600">{fillTemplate(t('admin.prices.intro'), { save: <strong>{t('admin.common.save')}</strong> })}</p>

      {summary && (
        <div className="mt-4">
          <Alert tone={summary.tone} onClose={() => setSummary(null)}>
            {t(summary.key, summary.vars)}
          </Alert>
        </div>
      )}

      <div className={`${card} mt-4 grid gap-3 p-4 sm:grid-cols-2`}>
        <div className="relative">
          <label htmlFor="price-search" className="sr-only">
            {t('admin.common.searchProducts')}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="price-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.common.searchPlaceholder')}
            className={`${inputClass(false)} pl-10`}
          />
        </div>
        <div>
          <label htmlFor="price-category" className="sr-only">
            {t('admin.form.category')}
          </label>
          <select id="price-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass(false)}>
            <option value="">{t('admin.common.allCategories')}</option>
            {categories.data?.items.map((item) => (
              <option key={item.id} value={item.id}>
                {pick(item, 'name')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4" aria-busy={products.loading}>
        {products.failure && <ErrorBlock message={apiErrorMessage(products.failure, t)} onRetry={products.reload} />}
        {!products.data && products.loading && <LoadingBlock label={t('admin.products.loading')} />}
        {products.data && items.length === 0 && (
          <EmptyState icon={IndianRupee} title={debouncedSearch || category ? t('admin.products.noMatch') : t('admin.products.empty')}>
            {debouncedSearch || category ? (
              t('admin.history.tryDifferent')
            ) : (
              <Link to="/admin/products/new" className="text-accent-700 underline">
                {t('admin.prices.addFirst')}
              </Link>
            )}
          </EmptyState>
        )}
        {items.length > 0 && (
          <>
            <ul className="space-y-3">
              {items.map((product) => (
                <PriceRow
                  key={product.id}
                  product={product}
                  draft={drafts[product.id]}
                  row={rows[product.id]}
                  disabled={savingAll}
                  onChange={setDraft}
                  onSave={handleSaveRow}
                />
              ))}
            </ul>
            <Pagination
              page={products.data.page}
              totalPages={products.data.totalPages}
              total={products.data.total}
              disabled={products.loading || savingAll}
              onChange={(next) => setPageState({ key: filterKey, page: next })}
            />
          </>
        )}
      </div>

      {pending.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <p className="text-slate-700">
              {pending.length === 1 ? t('admin.prices.unsaved.one') : t('admin.prices.unsaved.other', { count: pending.length })}
              {pending.length !== savable.length && (
                <span className="text-red-700"> {t('admin.prices.needCorrecting', { count: pending.length - savable.length })}</span>
              )}
            </p>
            <button type="button" className={btnPrimary} onClick={handleSaveAll} disabled={savingAll || savable.length === 0}>
              {savingAll ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
              {savingAll ? t('admin.common.saving') : t('admin.prices.saveAll', { count: savable.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceRow({ product, draft, row, disabled, onChange, onSave }) {
  const { t, lang, pick, formatDate } = useI18n();
  const name = pick(product, 'name');
  const otherName = lang === 'hi' ? product.nameEn : product.nameHi;
  const unit = product.unitLabel[lang] ?? product.unitLabel.en;
  const plan = evaluateDraft(product, draft);
  const touched = Boolean(draft);
  const saving = row?.status === 'saving';
  const priceId = `price-${product.id}`;
  const mrpId = `mrp-${product.id}`;
  const messageId = `price-msg-${product.id}`;
  const showError = touched && plan.error;
  const message = showError ? describeDraftError(plan.error, t) : rowMessageText(row, t);
  const isError = Boolean(showError) || row?.status === 'error';

  return (
    <li className={`${card} p-4 ${touched && plan.hasChanges && !plan.error ? 'border-accent-400 ring-1 ring-accent-200' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{name}</p>
          {otherName && otherName !== name && (
            <p className="text-slate-600" lang={lang === 'hi' ? 'en' : 'hi'}>
              {otherName}
            </p>
          )}
          <p className="text-sm text-slate-500">{[pick(product.category, 'name'), unit].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="w-full sm:w-auto sm:text-right">
          <p>
            <span className="text-xl font-bold text-brand-800">{formatPrice(product.sellingPrice)}</span>{' '}
            <span className="text-sm text-slate-600">{unit}</span>
          </p>
          <p className="text-sm text-slate-500">
            {product.mrp !== null && (
              <>
                {t('admin.label.mrp')} {formatPrice(product.mrp)} ·{' '}
              </>
            )}
            {t('admin.common.since', { date: formatDate(product.priceUpdatedAt) })}
          </p>
          {!product.isActive && <Badge>{t('admin.common.hiddenFromWebsite')}</Badge>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor={priceId} className="block text-sm font-medium text-slate-700">
            {t('admin.prices.newPrice')}
          </label>
          <input
            id={priceId}
            inputMode="decimal"
            autoComplete="off"
            value={draft?.price ?? ''}
            placeholder={String(product.sellingPrice)}
            onChange={(event) => onChange(product.id, 'price', event.target.value)}
            disabled={saving || disabled}
            aria-invalid={Boolean(showError)}
            aria-describedby={message ? messageId : undefined}
            className={`${inputClass(Boolean(showError))} mt-1 text-lg font-semibold`}
          />
        </div>
        <div>
          <label htmlFor={mrpId} className="block text-sm font-medium text-slate-700">
            {t('admin.form.mrp')}
          </label>
          <input
            id={mrpId}
            inputMode="decimal"
            autoComplete="off"
            value={draft?.mrp ?? (product.mrp ?? '')}
            placeholder={t('admin.prices.none')}
            onChange={(event) => onChange(product.id, 'mrp', event.target.value)}
            disabled={saving || disabled}
            className={`${inputClass(false)} mt-1`}
          />
        </div>
        <button
          type="button"
          className={`${btnPrimary} col-span-2 sm:col-span-1`}
          onClick={() => onSave(product)}
          disabled={saving || disabled || !touched || Boolean(plan.error) || !plan.hasChanges}
          aria-label={t('admin.prices.saveFor', { name })}
        >
          {saving ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
          {saving ? t('admin.common.saving') : t('admin.common.save')}
        </button>
      </div>

      {touched && !plan.error && plan.priceChanged && (
        <p className="mt-2 text-sm text-accent-700">
          {formatPrice(product.sellingPrice)} → <strong>{formatPrice(plan.sellingPrice)}</strong>
          {isLargePriceChange(product.sellingPrice, plan.sellingPrice) && <span className="text-amber-800"> · {t('admin.prices.bigChange')}</span>}
        </p>
      )}
      {message && (
        <p
          id={messageId}
          className={`mt-2 flex items-start gap-1.5 text-sm font-medium ${isError ? 'text-red-700' : 'text-brand-700'}`}
          role={isError ? 'alert' : 'status'}
        >
          {isError ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          {message}
        </p>
      )}
    </li>
  );
}
