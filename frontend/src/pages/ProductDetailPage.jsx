import { useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, PackageX, Phone, RefreshCw } from 'lucide-react';
import AvailabilityTag from '../components/public/AvailabilityTag';
import { DeliveryNotice, PriceNotice, SlowLoadingNotice } from '../components/public/Notices';
import ProductImage from '../components/public/ProductImage';
import { useFetch } from '../hooks/useFetch';
import { useI18n } from '../i18n/I18nContext';
import { findCachedProduct } from '../services/catalogCache';
import { getPublicProduct } from '../services/publicApi';
import { telHref, whatsappHref } from '../utils/catalog';
import { formatPrice } from '../utils/format';

/** Product details. Shows the copy from the list instantly (if any) while fresh data loads. */
export default function ProductDetailPage() {
  const { id } = useParams();
  const { t, lang, pick, formatDate } = useI18n();
  const { shop, siteName } = useOutletContext() ?? {};
  const product = useFetch(`product:${id}`, () => getPublicProduct(id), { initialData: findCachedProduct(id) });

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const notFound = product.errorStatus === 404;
  const data = notFound ? null : product.data;

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink label={t('product.back')} />

      {!data && !notFound && <title>{siteName || t('site.defaultTitle')}</title>}
      {!data && product.loading && (
        <div className="mt-4 space-y-3">
          <p className="text-slate-600" role="status">
            {t('product.loading')}
          </p>
          <SlowLoadingNotice />
        </div>
      )}

      {notFound && (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <title>{t('product.notFound.title')}</title>
          <PackageX className="mx-auto size-10 text-slate-400" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-semibold">{t('product.notFound.title')}</h1>
          <p className="mt-1 text-slate-600">{t('product.notFound.body')}</p>
          <Link to="/" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800">
            {t('catalog.showAll')}
          </Link>
        </div>
      )}

      {product.error && !notFound && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <p>{data ? t('catalog.staleWarning') : t('catalog.error')}</p>
          <button type="button" onClick={product.reload} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 font-semibold text-white">
            <RefreshCw className="size-5" aria-hidden="true" />
            {t('catalog.retry')}
          </button>
        </div>
      )}

      {data && <ProductDetails product={data} shop={shop} siteName={siteName} t={t} lang={lang} pick={pick} formatDate={formatDate} />}
    </div>
  );
}

function BackLink({ label }) {
  const navigate = useNavigate();
  const location = useLocation();
  const className = 'inline-flex min-h-11 items-center gap-2 font-semibold text-accent-700 hover:underline';
  // Came from the list: go back (keeps search, filter and scroll). Opened directly: go to the list.
  if (location.key !== 'default') {
    return (
      <button type="button" onClick={() => navigate(-1)} className={className}>
        <ArrowLeft className="size-5" aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <Link to="/" className={className}>
      <ArrowLeft className="size-5" aria-hidden="true" />
      {label}
    </Link>
  );
}

function ProductDetails({ product, shop, siteName, t, lang, pick, formatDate }) {
  const name = pick(product, 'name');
  const otherName = lang === 'hi' ? product.nameEn : product.nameHi;
  const description = pick(product, 'description');
  const categoryName = pick(product.category, 'name');
  const unit = product.unitLabel?.[lang] ?? product.unitLabel?.en;
  const showMrp = typeof product.mrp === 'number' && product.mrp > product.sellingPrice;
  const phoneLink = telHref(shop?.phone);
  const chatLink = whatsappHref(shop?.whatsapp, t('product.whatsappMessage', { product: name }));

  return (
    <article className="mt-3 grid gap-5 md:grid-cols-2">
      <title>{siteName ? `${name} – ${siteName}` : name}</title>
      {/* Shorter on phones so the price is visible without scrolling. */}
      <ProductImage
        image={product.image}
        alt={name}
        eager
        sizes="(min-width: 768px) 50vw, 100vw"
        noImageLabel={t('product.noImage')}
        className={`w-full rounded-2xl border border-slate-200 md:aspect-[4/3] md:max-h-none ${product.image ? 'aspect-[4/3] max-h-64' : 'h-32'}`}
      />

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl leading-tight font-bold text-slate-900">{name}</h1>
          {otherName && otherName !== name && (
            <p className="text-lg text-slate-600" lang={lang === 'hi' ? 'en' : 'hi'}>
              {otherName}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-medium text-brand-800">{t('product.price')}</p>
          <p>
            <span className="text-4xl font-bold text-brand-800">{formatPrice(product.sellingPrice)}</span>{' '}
            <span className="text-lg text-slate-700">{unit}</span>
          </p>
          {showMrp && (
            <p className="text-slate-600">
              {t('product.mrp')} <span className="line-through">{formatPrice(product.mrp)}</span>
            </p>
          )}
          <p className="mt-1 text-sm text-slate-600">{t('product.priceUpdated', { date: formatDate(product.priceUpdatedAt) })}</p>
        </div>

        <AvailabilityTag value={product.availability} size="lg" />

        <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {product.brand && <DetailRow label={t('product.brand')} value={product.brand} />}
          {categoryName && <DetailRow label={t('product.category')} value={categoryName} />}
          <DetailRow label={t('product.unit')} value={unit} />
        </dl>

        {product.category?.showDeliveryNote && <DeliveryNotice />}

        {description && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800">{t('product.description')}</h2>
            <p className="mt-1 whitespace-pre-line text-slate-700">{description}</p>
          </section>
        )}

        <PriceNotice />

        {(phoneLink || chatLink) && (
          <div className="flex flex-col gap-3 sm:flex-row">
            {phoneLink && (
              <a href={phoneLink} className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 text-lg font-bold text-white hover:bg-brand-800">
                <Phone className="size-5" aria-hidden="true" />
                {t('product.callToConfirm')}
              </a>
            )}
            {chatLink && (
              <a
                href={chatLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-13 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-brand-700 bg-white px-5 text-lg font-bold text-brand-800 hover:bg-brand-50"
              >
                <MessageCircle className="size-5" aria-hidden="true" />
                {t('product.whatsapp')}
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
