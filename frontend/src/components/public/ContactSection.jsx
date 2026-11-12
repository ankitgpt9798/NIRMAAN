import { MapPin, MessageCircle, Navigation, Phone, Store } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { mapsHref, telHref, whatsappHref } from '../../utils/catalog';
import { resizedImageUrl } from '../../utils/media';

const card = 'rounded-2xl border border-slate-200 bg-slate-50 p-5';
const cardTitle = 'flex items-center gap-2 font-semibold text-slate-800';

/**
 * "Contact the shop" in the footer: three balanced sections on larger screens
 * (shop, call/WhatsApp, address), stacked on phones. Only filled-in details are
 * shown; nothing at all until the owner fills in Shop Settings.
 */
export default function ContactSection({ shop }) {
  const { t, lang, pick } = useI18n();
  const name = pick(shop, 'name');
  const otherName = lang === 'hi' ? shop?.nameEn : shop?.nameHi;
  const address = pick(shop, 'address');
  const description = pick(shop, 'description');
  const phoneLink = telHref(shop?.phone);
  const chatLink = whatsappHref(shop?.whatsapp);

  if (!name && !address && !phoneLink && !chatLink && !description) return null;

  const logoUrl = resizedImageUrl(shop?.logo?.url, 96);
  // Search by the shop's name and address (English first, as maps find it more reliably).
  const mapLink = address ? mapsHref(shop.nameEn || shop.nameHi, shop.addressEn || shop.addressHi) : '';

  return (
    <section aria-labelledby="contact-title" className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h2 id="contact-title" className="text-xl font-bold text-slate-800">
        {t('contact.title')}
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-3 md:gap-5">
        {(name || description) && (
          <div className={card}>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" width="48" height="48" loading="lazy" className="size-12 shrink-0 rounded-xl border border-slate-200 bg-white object-contain" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-forest text-white">
                  <Store className="size-6" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                {name && <p className="leading-tight font-bold text-forest">{name}</p>}
                {otherName && otherName !== name && (
                  <p className="text-sm text-slate-500" lang={lang === 'hi' ? 'en' : 'hi'}>
                    {otherName}
                  </p>
                )}
              </div>
            </div>
            {description && <p className="mt-3 line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-slate-600">{description}</p>}
          </div>
        )}

        {(phoneLink || chatLink) && (
          <div className={card}>
            <h3 className={cardTitle}>
              <Phone className="size-4 text-construction" aria-hidden="true" />
              {t('contact.reachUs')}
            </h3>
            <ul className="mt-3 space-y-3">
              {phoneLink && (
                <li>
                  <a href={phoneLink} className="flex min-h-13 items-center gap-3 rounded-xl bg-forest px-4 py-2 text-white hover:bg-forest-dark">
                    <Phone className="size-5 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="block text-sm text-white/80">{t('contact.callLabel')}</span>{' '}
                      <span className="block text-lg leading-tight font-bold">{shop.phone}</span>
                    </span>
                  </a>
                </li>
              )}
              {chatLink && (
                <li>
                  <a
                    href={chatLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-13 items-center gap-3 rounded-xl bg-whatsapp px-4 py-2 font-semibold text-slate-900 hover:bg-whatsapp-dark"
                  >
                    <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
                    {t('contact.chat')}
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        {address && (
          <div className={card}>
            <h3 className={cardTitle}>
              <MapPin className="size-4 text-construction" aria-hidden="true" />
              {t('contact.address')}
            </h3>
            <p className="mt-3 leading-relaxed text-slate-700">{address}</p>
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-forest bg-white px-4 font-semibold text-forest hover:bg-forest-50"
              >
                <Navigation className="size-4" aria-hidden="true" />
                {t('contact.openMap')}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
