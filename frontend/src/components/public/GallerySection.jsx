import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { getGallery } from '../../services/publicApi';
import { imageSrcSet, resizedImageUrl } from '../../utils/media';
import PhotoViewer from './PhotoViewer';

/**
 * Photos the owner added in the admin, newest first, in one row that scrolls
 * sideways (finger swipe on phones, arrow buttons on computers), so the gallery
 * takes the height of a single photo however many there are. Tapping a photo
 * opens it full screen. Nothing is shown when the gallery is empty (or cannot be
 * loaded – it is not essential for prices).
 */
export default function GallerySection() {
  const { t } = useI18n();
  const gallery = useFetch('gallery', getGallery);
  const [openIndex, setOpenIndex] = useState(null);
  const photos = gallery.data?.items ?? [];
  if (!photos.length) return null;

  return (
    <section aria-labelledby="gallery-title" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="gallery-title" className="text-xl font-bold text-brand-800">
          {t('gallery.title')}
        </h2>
        {photos.length > 2 && <p className="text-sm text-slate-600">{t('gallery.swipeHint', { count: photos.length })}</p>}
      </div>
      <GalleryStrip photos={photos} onOpen={setOpenIndex} />
      {openIndex !== null && (
        <PhotoViewer photos={photos} index={Math.min(openIndex, photos.length - 1)} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </section>
  );
}

function GalleryStrip({ photos, onOpen }) {
  const { t, pick } = useI18n();
  const listRef = useRef(null);
  // Which arrow buttons are useful right now (none when everything fits).
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setCanScroll({ back: list.scrollLeft > 4, forward: list.scrollLeft + list.clientWidth < list.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [measure, photos.length]);

  const scrollByPage = (direction) => {
    const list = listRef.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    list?.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const arrow = 'absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-800 shadow-md hover:bg-white sm:flex';

  return (
    <div className="relative mt-3">
      {canScroll.back && (
        <button type="button" onClick={() => scrollByPage(-1)} className={`${arrow} -left-3`} aria-label={t('gallery.showPrevious')}>
          <ChevronLeft className="size-6" aria-hidden="true" />
        </button>
      )}
      <ul
        ref={listRef}
        onScroll={measure}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:thin]"
      >
        {photos.map((photo, index) => {
          const caption = pick(photo, 'caption');
          const srcSet = imageSrcSet(photo.image.url, [200, 400, 800]);
          return (
            <li key={photo.id} className="w-40 shrink-0 snap-start sm:w-56">
              <button
                type="button"
                onClick={() => onOpen(index)}
                className="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                {/* Read aloud as "<caption or photo number>, open full size"; a visible caption is not repeated as the photo's alt text. */}
                <img
                  src={resizedImageUrl(photo.image.url, 400)}
                  srcSet={srcSet}
                  sizes={srcSet ? '(min-width: 640px) 224px, 160px' : undefined}
                  alt={caption ? '' : t('gallery.photoAlt', { number: index + 1 })}
                  loading="lazy"
                  decoding="async"
                  width="400"
                  height="400"
                  className="aspect-square w-full bg-slate-100 object-cover transition group-hover:opacity-90"
                />
                {caption && <span className="line-clamp-2 block px-2 py-1.5 text-sm text-slate-700">{caption}</span>}
                <span className="sr-only">, {t('gallery.enlarge')}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {canScroll.forward && (
        <button type="button" onClick={() => scrollByPage(1)} className={`${arrow} -right-3`} aria-label={t('gallery.showMore')}>
          <ChevronRight className="size-6" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
