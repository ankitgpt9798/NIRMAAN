import { Link, Outlet } from 'react-router-dom';
import { ArrowUp, LayoutDashboard, MapPin, Phone, Store } from 'lucide-react';
import ContactSection from '../components/public/ContactSection';
import LanguageSwitcher from '../components/public/LanguageSwitcher';
import { useAdminDevice } from '../hooks/useAdminDevice';
import { useFetch } from '../hooks/useFetch';
import { useI18n } from '../i18n/I18nContext';
import { getCachedShop, loadShop } from '../services/catalogCache';
import { telHref } from '../utils/catalog';
import { resizedImageUrl } from '../utils/media';

/** Back to the top of the page (instantly for people who prefer less motion). */
function scrollToTop() {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

/**
 * Customer website frame: shop header, page content and contact footer.
 * The header is part of the normal page flow (never sticky or fixed): it is fully
 * visible at the top and simply scrolls away with the page.
 */
export default function PublicLayout() {
  const { t, pick } = useI18n();
  const shop = useFetch('shop', loadShop, { initialData: getCachedShop() });
  const data = shop.data;
  const adminDevice = useAdminDevice(); // only the owner's devices show the Admin button

  const name = pick(data, 'name') || t('site.defaultTitle');
  const address = pick(data, 'address');
  const phoneLink = telHref(data?.phone);
  const logoUrl = resizedImageUrl(data?.logo?.url, 96); // shown at 48px; 96px stays sharp on phones

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Each page sets its own <title> using siteName from the outlet context. */}
      <meta name="description" content={`${name} – ${t('site.tagline')}`} />

      <header className="border-b border-header-line bg-white">
        {/* Small top row: Admin (owner's devices only) and the language switch. */}
        <div className="border-b border-header-line bg-header-top">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-1.5">
            {adminDevice && (
              <Link
                to="/admin"
                className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-header-line bg-header-admin px-3 text-sm font-semibold text-slate-700 hover:border-header-brand hover:text-header-brand"
              >
                <LayoutDashboard className="size-4" aria-hidden="true" />
                {t('header.admin')}
              </Link>
            )}
            <LanguageSwitcher tone="brand" compact={adminDevice} />
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" width="48" height="48" className="size-12 shrink-0 rounded-xl border border-header-line bg-white object-contain" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-forest text-white">
                <Store className="size-6" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-lg leading-tight font-bold text-header-brand sm:text-xl">{name}</span>
              {address ? (
                <span className="mt-1 flex items-start gap-1 text-sm leading-snug text-header-muted">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>{address}</span>
                </span>
              ) : (
                <span className="mt-0.5 block text-sm text-header-muted">{t('site.tagline')}</span>
              )}
            </span>
          </Link>
          {phoneLink && (
            <a href={phoneLink} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-header-brand px-4 font-semibold text-white hover:bg-header-brand-dark">
              <Phone className="size-4" aria-hidden="true" />
              {t('header.call')}
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:py-6">
        <Outlet context={{ shop: data, siteName: name }} />
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white">
        <ContactSection shop={data} />
        <div className="bg-forest text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
            <p className="text-white/85">
              © {new Date().getFullYear()} {name}
            </p>
            <button type="button" onClick={scrollToTop} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-semibold hover:bg-white/10">
              <ArrowUp className="size-4" aria-hidden="true" />
              {t('footer.backToTop')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
