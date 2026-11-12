import { useState } from 'react';
import { LoaderCircle, MessageSquareText } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { getReviews } from '../../services/publicApi';
import ReviewForm from './ReviewForm';
import StarRating from './StarRating';

const PAGE_SIZE = 5;

/**
 * Approved customer reviews (newest first) with the average rating, and a form to
 * write a new one. New reviews appear only after the owner approves them.
 * The list sits in a box of fixed height that scrolls, so many reviews never make
 * the page longer; "Show more reviews" at the end of the box loads older ones.
 */
export default function ReviewsSection() {
  const { t } = useI18n();
  const reviews = useFetch('reviews', () => getReviews(1, PAGE_SIZE));
  const [more, setMore] = useState({ items: [], page: 1, loading: false, failed: false });

  const first = reviews.data;
  const items = [...(first?.items ?? []), ...more.items];
  const total = first?.total ?? 0;
  const hasMore = first && more.page < first.totalPages;

  async function showMore() {
    setMore((current) => ({ ...current, loading: true, failed: false }));
    try {
      const next = await getReviews(more.page + 1, PAGE_SIZE);
      // Skip any review already shown (a new approval can shift the pages).
      setMore((current) => {
        const shown = new Set([...(first?.items ?? []), ...current.items].map((review) => review.id));
        return { items: [...current.items, ...next.items.filter((review) => !shown.has(review.id))], page: next.page, loading: false, failed: false };
      });
    } catch {
      setMore((current) => ({ ...current, loading: false, failed: true }));
    }
  }

  return (
    <section aria-labelledby="reviews-title" className="mt-10">
      <h2 id="reviews-title" className="text-xl font-bold text-brand-800">
        {t('reviews.title')}
      </h2>

      {first && total > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-slate-900">{first.averageRating.toFixed(1)}</span>
          <StarRating rating={first.averageRating} label={t('reviews.average', { rating: first.averageRating.toFixed(1) })} size="size-6" />
          <span className="text-slate-600">{total === 1 ? t('reviews.count.one') : t('reviews.count.other', { count: total })}</span>
        </p>
      )}

      {/* Larger screens: reviews and the form side by side, 50/50 and the same height. The form sets the
          height; the review box starts from zero height (basis-0, h-0), grows to fill it and scrolls inside,
          so any number of reviews never makes the row taller. Phones: one above the other. */}
      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-col" aria-live="polite" aria-busy={reviews.loading}>
          {!first && reviews.loading && (
            <p className="text-slate-600" role="status">
              {t('reviews.loading')}
            </p>
          )}
          {!first && reviews.failure && (
            <p className="text-slate-600">
              {t('reviews.loadError')}{' '}
              <button type="button" onClick={reviews.reload} className="min-h-11 font-semibold text-accent-700 underline">
                {t('catalog.retry')}
              </button>
            </p>
          )}
          {first && total === 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-slate-600 lg:flex-1 lg:items-center lg:justify-center lg:text-center">
              <MessageSquareText className="mt-0.5 size-6 shrink-0 text-slate-400" aria-hidden="true" />
              <p>{t('reviews.none')}</p>
            </div>
          )}
          {items.length > 0 && (
            // Focusable so keyboard users can scroll it with the arrow keys.
            <div
              role="region"
              aria-label={t('reviews.listLabel')}
              tabIndex={0}
              className="max-h-[28rem] min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-100/60 p-2 [scrollbar-width:thin] sm:p-3 lg:h-0 lg:max-h-none lg:grow lg:basis-0"
            >
              <ul className="space-y-2 sm:space-y-3">
                {items.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  onClick={showMore}
                  disabled={more.loading}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {more.loading && <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />}
                  {t('reviews.showMore')}
                </button>
              )}
              {more.failed && (
                <p className="mt-2 text-red-700" role="alert">
                  {t('reviews.loadError')}
                </p>
              )}
            </div>
          )}
        </div>

        <ReviewForm />
      </div>
    </section>
  );
}

function ReviewItem({ review }) {
  const { t, formatDate } = useI18n();
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold break-words text-slate-900">{review.name}</p>
        <time dateTime={review.createdAt} className="text-sm text-slate-500">
          {formatDate(review.createdAt)}
        </time>
      </div>
      <StarRating rating={review.rating} label={t('reviews.stars', { rating: review.rating })} />
      {review.comment && <p className="mt-2 break-words whitespace-pre-line text-slate-700">{review.comment}</p>}
    </li>
  );
}
