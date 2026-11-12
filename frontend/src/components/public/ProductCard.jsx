import { Link } from 'react-router-dom';
import { ChevronRight, Truck } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { rememberScroll } from '../../services/catalogCache';
import { formatPrice } from '../../utils/format';
import AvailabilityTag from './AvailabilityTag';
import ProductImage from './ProductImage';

/**
 * One product in the catalogue. The whole card is one large tap target that opens
 * the product page (which also shows the description). Phones: photo on the left;
 * larger screens: photo on top. The price sits in its own highlighted panel so it is
 * the first thing seen.
 */
export default function ProductCard({ product }) {
  const { t, lang, pick, formatDate } = useI18n();
  const name = pick(product, 'name');
  const categoryName = pick(product.category, 'name');
  const unit = product.unitLabel?.[lang] ?? product.unitLabel?.en;
  const showMrp = typeof product.mrp === 'number' && product.mrp > product.sellingPrice;
  const saving = showMrp ? Math.round((product.mrp - product.sellingPrice) * 100) / 100 : 0;
  // Out-of-stock and unavailable products stay listed, just visually quieter.
  const inStock = product.availability === 'in_stock';

  return (
    <li className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow has-[a:hover]:border-brand-300 has-[a:hover]:shadow-md">
      <Link
        to={`/products/${product.id}`}
        onClick={() => rememberScroll(window.scrollY)}
        className="group flex flex-1 gap-3 p-3 focus-visible:outline-offset-[-3px] sm:flex-col sm:gap-0 sm:p-0"
      >
        <ProductImage
          image={product.image}
          alt={name}
          noImageLabel={t('product.noImage')}
          className={`size-24 shrink-0 rounded-xl sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none ${inStock ? '' : 'opacity-70'}`}
        />

        <div className="flex min-w-0 flex-1 flex-col sm:p-4">
          {categoryName && (
            <span className="self-start rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{categoryName}</span>
          )}
          <h2 className="mt-1 line-clamp-2 text-lg leading-snug font-semibold text-slate-900 group-hover:text-brand-800">{name}</h2>
          {product.brand && <p className="text-sm text-slate-500">{product.brand}</p>}

          <div className={`mt-2 rounded-xl px-3 py-2 ${inStock ? 'bg-brand-50' : 'bg-slate-50'}`}>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className={`text-2xl font-bold ${inStock ? 'text-brand-800' : 'text-slate-700'}`}>{formatPrice(product.sellingPrice)}</span>
              <span className="text-slate-700">{unit}</span>
            </p>
            {showMrp && (
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="text-slate-600">
                  {t('product.mrp')} <span className="line-through">{formatPrice(product.mrp)}</span>
                </span>
                <span className="font-semibold text-brand-700">{t('product.save', { amount: formatPrice(saving) })}</span>
              </p>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AvailabilityTag value={product.availability} />
            {product.category?.showDeliveryNote && (
              <span className="inline-flex items-center gap-1 text-sm text-amber-900">
                <Truck className="size-4" aria-hidden="true" />
                {t('product.deliveryShort')}
              </span>
            )}
          </div>

          <div className="mt-auto pt-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-500">{t('product.priceUpdated', { date: formatDate(product.priceUpdatedAt) })}</span>
              <span className="inline-flex items-center font-semibold text-accent-700 group-hover:underline">
                {t('product.viewDetails')}
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
