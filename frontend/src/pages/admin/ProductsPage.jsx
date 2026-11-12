import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EyeOff, Eye, ImageOff, IndianRupee, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import { AvailabilityBadge, Badge } from '../../components/admin/Badges';
import Pagination from '../../components/admin/Pagination';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnDanger, btnPrimary, btnSecondary, card, inputClass } from '../../components/admin/styles';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { deleteProduct, getMeta, listCategories, listProducts, updateProduct } from '../../services/adminApi';
import { formatPrice } from '../../utils/format';
import { resizedImageUrl } from '../../utils/media';

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const { t, lang, pick } = useI18n();
  const location = useLocation();
  // Messages are kept as text keys (or the error itself) and translated when shown.
  const [message, setMessage] = useState(() =>
    location.state?.flashKey ? { tone: location.state.flashTone || 'success', key: location.state.flashKey, vars: location.state.flashVars } : null,
  );
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ category: '', availability: '', status: 'all' });
  const debouncedSearch = useDebouncedValue(search.trim());

  // Going back to page 1 whenever the search or a filter changes.
  const filterKey = JSON.stringify({ search: debouncedSearch, ...filters });
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const query = { search: debouncedSearch, ...filters, page, limit: PAGE_SIZE };
  const products = useFetch(JSON.stringify(query), () => listProducts(query));
  const categories = useFetch('categories', listCategories);
  const meta = useFetch('meta', getMeta);
  const [busyId, setBusyId] = useState(null);

  const setFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }));

  async function runAction(product, action, success) {
    setBusyId(product.id);
    setMessage(null);
    try {
      const updated = await action();
      if (updated?.id) {
        products.mutate((list) => list && { ...list, items: list.items.map((item) => (item.id === updated.id ? updated : item)) });
      } else {
        products.reload();
      }
      if (success) setMessage({ tone: 'success', ...success });
    } catch (error) {
      setMessage({ tone: 'error', failure: error });
    } finally {
      setBusyId(null);
    }
  }

  const handleAvailability = (product, availability) => runAction(product, () => updateProduct(product.id, { availability }));

  const handleToggleActive = (product) =>
    runAction(product, () => updateProduct(product.id, { isActive: !product.isActive }), {
      key: product.isActive ? 'admin.products.nowHidden' : 'admin.products.nowShown',
      vars: { name: pick(product, 'name') },
    });

  const handleDelete = (product) => {
    const name = pick(product, 'name');
    if (!window.confirm(t('admin.products.confirmDelete', { name }))) return;
    runAction(product, () => deleteProduct(product.id), { key: 'admin.common.deletedName', vars: { name } });
  };

  const list = products.data;
  const hasFilters = Boolean(debouncedSearch || filters.category || filters.availability || filters.status !== 'all');

  return (
    <div>
      <title>{`${t('admin.nav.products')} · ${t('admin.brand')}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.products')}</h1>
        <Link to="/admin/products/new" className={btnPrimary}>
          <Plus className="size-5" aria-hidden="true" />
          {t('admin.products.add')}
        </Link>
      </div>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone} onClose={() => setMessage(null)}>
            {message.failure ? apiErrorMessage(message.failure, t) : t(message.key, message.vars)}
          </Alert>
        </div>
      )}

      <div className={`${card} mt-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="relative sm:col-span-2 lg:col-span-1">
          <label htmlFor="product-search" className="sr-only">
            {t('admin.common.searchProducts')}
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.common.searchPlaceholder')}
            className={`${inputClass(false)} pl-10`}
          />
        </div>
        <FilterSelect id="filter-category" label={t('admin.form.category')} value={filters.category} onChange={setFilter('category')}>
          <option value="">{t('admin.common.allCategories')}</option>
          {categories.data?.items.map((category) => (
            <option key={category.id} value={category.id}>
              {pick(category, 'name')}
              {category.isActive ? '' : t('admin.common.hiddenSuffix')}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="filter-availability" label={t('admin.products.stock')} value={filters.availability} onChange={setFilter('availability')}>
          <option value="">{t('admin.products.anyStock')}</option>
          {meta.data?.availability.map((option) => (
            <option key={option.value} value={option.value}>
              {option[lang]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="filter-status" label={t('admin.products.visibility')} value={filters.status} onChange={setFilter('status')}>
          <option value="all">{t('admin.products.shownAndHidden')}</option>
          <option value="active">{t('admin.products.shownOnly')}</option>
          <option value="inactive">{t('admin.products.hiddenOnly')}</option>
        </FilterSelect>
      </div>

      <div className="mt-4" aria-busy={products.loading}>
        {products.failure && <ErrorBlock message={apiErrorMessage(products.failure, t)} onRetry={products.reload} />}
        {!list && products.loading && <LoadingBlock label={t('admin.products.loading')} />}

        {list && list.items.length === 0 && (
          <EmptyState icon={Package} title={hasFilters ? t('admin.products.noMatch') : t('admin.products.empty')}>
            {hasFilters ? t('admin.products.noMatchHint') : t('admin.products.emptyHint')}
          </EmptyState>
        )}

        {list && list.items.length > 0 && (
          <>
            <p className="mb-2 text-sm text-slate-500">
              {t('admin.common.itemCount', { count: list.total })}
              {products.loading && ` · ${t('admin.products.updating')}`}
            </p>
            <ul className="space-y-3">
              {list.items.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  availabilityOptions={meta.data?.availability ?? []}
                  busy={busyId === product.id}
                  onAvailability={handleAvailability}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
            <Pagination
              page={list.page}
              totalPages={list.totalPages}
              total={list.total}
              disabled={products.loading}
              onChange={(next) => setPageState({ key: filterKey, page: next })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ id, label, children, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} className={inputClass(false)} {...props}>
        {children}
      </select>
    </div>
  );
}

function ProductRow({ product, availabilityOptions, busy, onAvailability, onToggleActive, onDelete }) {
  const { t, lang, pick } = useI18n();
  const name = pick(product, 'name');
  const otherName = lang === 'hi' ? product.nameEn : product.nameHi;
  const secondName = otherName && otherName !== name ? otherName : '';
  const imageUrl = resizedImageUrl(product.image?.url, 160); // 64px thumbnail

  return (
    <li className={`${card} p-4 ${product.isActive ? '' : 'bg-slate-50'}`}>
      <div className="flex gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <ImageOff className="size-6 text-slate-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{name}</p>
          {secondName && (
            <p className="text-slate-600" lang={lang === 'hi' ? 'en' : 'hi'}>
              {secondName}
            </p>
          )}
          <p className="text-sm text-slate-500">{[product.brand, pick(product.category, 'name')].filter(Boolean).join(' · ')}</p>
          <p className="mt-1">
            <span className="text-lg font-bold text-brand-800">{formatPrice(product.sellingPrice)}</span>{' '}
            <span className="text-slate-600">{product.unitLabel[lang] ?? product.unitLabel.en}</span>
            {product.mrp > product.sellingPrice && (
              <span className="ml-2 text-sm text-slate-500 line-through">
                {t('admin.label.mrp')} {formatPrice(product.mrp)}
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <AvailabilityBadge value={product.availability} />
            {!product.isActive && <Badge>{t('admin.common.hiddenFromWebsite')}</Badge>}
            {product.category && !product.category.isActive && <Badge tone="amber">{t('admin.common.categoryHidden')}</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <label htmlFor={`availability-${product.id}`} className="sr-only">
          {t('admin.products.stockFor', { name })}
        </label>
        <select
          id={`availability-${product.id}`}
          value={product.availability}
          onChange={(event) => onAvailability(product, event.target.value)}
          disabled={busy}
          className={`${inputClass(false)} min-h-11 w-full sm:w-auto`}
        >
          {availabilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option[lang]}
            </option>
          ))}
        </select>
        <Link to={`/admin/prices?q=${encodeURIComponent(name)}`} className={btnSecondary} aria-label={t('admin.products.changePriceOf', { name })}>
          <IndianRupee className="size-4" aria-hidden="true" />
          {t('admin.products.price')}
        </Link>
        <Link to={`/admin/products/${product.id}/edit`} className={btnSecondary}>
          <Pencil className="size-4" aria-hidden="true" />
          {t('admin.common.edit')}
        </Link>
        <button type="button" className={btnSecondary} onClick={() => onToggleActive(product)} disabled={busy}>
          {product.isActive ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          {product.isActive ? t('admin.common.hide') : t('admin.common.show')}
        </button>
        <button type="button" className={btnDanger} onClick={() => onDelete(product)} disabled={busy} aria-label={t('admin.products.deleteOf', { name })}>
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('admin.common.delete')}</span>
        </button>
      </div>
    </li>
  );
}
