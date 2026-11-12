import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { imageSrcSet, resizedImageUrl } from '../../utils/media';

/** Big photo of the shop (set in Shop Settings). Nothing is shown until the owner adds one. */
export default function ShopPhotoSection({ shop }) {
  const { t, pick } = useI18n();
  const [failed, setFailed] = useState(false);
  if (!shop?.photo?.url || failed) return null;

  const name = pick(shop, 'name') || t('site.defaultTitle');
  const address = pick(shop, 'address');
  const srcSet = imageSrcSet(shop.photo.url, [480, 800, 1200, 1600]);

  return (
    <section aria-labelledby="shop-photo-title" className="mt-10">
      <h2 id="shop-photo-title" className="text-xl font-bold text-brand-800">
        {t('shopPhoto.title')}
      </h2>
      <figure className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <img
          src={resizedImageUrl(shop.photo.url, 1200)}
          srcSet={srcSet}
          sizes={srcSet ? '(min-width: 1152px) 1120px, 100vw' : undefined}
          alt={t('shopPhoto.alt', { name })}
          loading="lazy"
          decoding="async"
          width="1600"
          height="900"
          onError={() => setFailed(true)}
          className="aspect-[4/3] w-full bg-slate-100 object-cover sm:aspect-[16/9]"
        />
        <figcaption className="px-4 py-3">
          <span className="block font-semibold text-slate-900">{name}</span>
          {address && (
            <span className="mt-0.5 flex items-start gap-1.5 text-slate-600">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {address}
            </span>
          )}
        </figcaption>
      </figure>
    </section>
  );
}
