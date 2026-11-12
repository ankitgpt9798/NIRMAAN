import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { resizedImageUrl } from '../../utils/media';

/**
 * Full-screen photo viewer for the gallery. Close with ✕ or Escape; move with the
 * arrow buttons, the keyboard arrows or a finger swipe.
 * Focus stays inside while open and returns to the tapped photo afterwards.
 */
export default function PhotoViewer({ photos, index, onIndexChange, onClose }) {
  const { t, pick } = useI18n();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const touchStart = useRef(null);
  const photo = photos[index];
  const total = photos.length;
  const caption = pick(photo, 'caption');

  const go = (step) => onIndexChange((index + step + total) % total);

  useEffect(() => {
    const opener = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden'; // the page behind does not scroll
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowLeft' && total > 1) go(-1);
    else if (event.key === 'ArrowRight' && total > 1) go(1);
    else if (event.key === 'Tab') {
      // Keep keyboard focus inside the viewer.
      const buttons = [...dialogRef.current.querySelectorAll('button:not([disabled])')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function handleTouchEnd(event) {
    if (touchStart.current === null || total < 2) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) > 50) go(distance < 0 ? 1 : -1);
  }

  const navButton = 'flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25';

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery.viewer')}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-white/80" aria-live="polite">
          {t('gallery.position', { number: index + 1, total })}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className={navButton} aria-label={t('gallery.close')}>
          <X className="size-6" aria-hidden="true" />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 sm:px-4"
        onTouchStart={(event) => (touchStart.current = event.touches[0].clientX)}
        onTouchEnd={handleTouchEnd}
      >
        {total > 1 && (
          <button type="button" onClick={() => go(-1)} className={`${navButton} hidden sm:flex`} aria-label={t('gallery.previous')}>
            <ChevronLeft className="size-7" aria-hidden="true" />
          </button>
        )}
        <img
          key={photo.id}
          src={resizedImageUrl(photo.image.url, 1600)}
          alt={caption || t('gallery.photoAlt', { number: index + 1 })}
          decoding="async"
          className="max-h-full min-h-0 max-w-full rounded-lg object-contain"
        />
        {total > 1 && (
          <button type="button" onClick={() => go(1)} className={`${navButton} hidden sm:flex`} aria-label={t('gallery.next')}>
            <ChevronRight className="size-7" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {caption && <p className="mb-3 text-center text-lg">{caption}</p>}
        {total > 1 && (
          <div className="flex justify-center gap-4 sm:hidden">
            <button type="button" onClick={() => go(-1)} className={navButton} aria-label={t('gallery.previous')}>
              <ChevronLeft className="size-7" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} className={navButton} aria-label={t('gallery.next')}>
              <ChevronRight className="size-7" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
