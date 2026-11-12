import { useState } from 'react';
import { Check, EyeOff, Info, MessageSquareText, Trash2 } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import Pagination from '../../components/admin/Pagination';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnDanger, btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import StarRating from '../../components/public/StarRating';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { deleteReview, listReviews, setReviewStatus } from '../../services/adminApi';

const PAGE_SIZE = 20;

/** Customer reviews: approve to show on the website, hide again, or delete. */
export default function ReviewsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState('pending');
  const [pageState, setPageState] = useState({ status: 'pending', page: 1 });
  const page = pageState.status === status ? pageState.page : 1;
  const reviews = useFetch(`reviews:${status}:${page}`, () => listReviews({ status, page, limit: PAGE_SIZE }));
  const [message, setMessage] = useState(null); // { tone, key, vars } or { tone: 'error', failure }
  const [busyId, setBusyId] = useState(null);

  const data = reviews.data;
  const counts = data?.counts ?? { pending: 0, approved: 0 };
  const items = data?.items ?? [];

  async function run(review, action, success) {
    setBusyId(review.id);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: 'success', ...success, vars: { name: review.name } });
      reviews.reload();
    } catch (error) {
      setMessage({ tone: 'error', failure: error });
    } finally {
      setBusyId(null);
    }
  }

  const approve = (review) => run(review, () => setReviewStatus(review.id, 'approved'), { key: 'admin.reviews.approved' });
  const hide = (review) => run(review, () => setReviewStatus(review.id, 'pending'), { key: 'admin.reviews.hidden' });
  const remove = (review) => {
    if (!window.confirm(t('admin.reviews.confirmDelete', { name: review.name }))) return;
    run(review, () => deleteReview(review.id), { key: 'admin.reviews.deleted' });
  };

  const tabClass = (active) => `min-h-11 rounded-lg px-4 font-semibold ${active ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-700 hover:bg-white/60'}`;

  return (
    <div className="max-w-3xl">
      <title>{`${t('admin.nav.reviews')} · ${t('admin.brand')}`}</title>
      <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.reviews')}</h1>
      <p className="mt-1 text-slate-600">{t('admin.reviews.intro')}</p>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-sm text-accent-700">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('admin.reviews.note')}
      </p>

      <div role="group" aria-label={t('admin.reviews.tabs')} className="mt-4 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        <button type="button" aria-pressed={status === 'pending'} className={tabClass(status === 'pending')} onClick={() => setStatus('pending')}>
          {t('admin.reviews.tab.pending', { count: counts.pending })}
        </button>
        <button type="button" aria-pressed={status === 'approved'} className={tabClass(status === 'approved')} onClick={() => setStatus('approved')}>
          {t('admin.reviews.tab.approved', { count: counts.approved })}
        </button>
      </div>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone} onClose={() => setMessage(null)}>
            {message.failure ? apiErrorMessage(message.failure, t) : t(message.key, message.vars)}
          </Alert>
        </div>
      )}

      <div className="mt-4" aria-busy={reviews.loading}>
        {reviews.failure && <ErrorBlock message={apiErrorMessage(reviews.failure, t)} onRetry={reviews.reload} />}
        {!data && reviews.loading && <LoadingBlock label={t('admin.reviews.loading')} />}
        {data && items.length === 0 && (
          <EmptyState icon={MessageSquareText} title={t(status === 'pending' ? 'admin.reviews.emptyPending' : 'admin.reviews.emptyApproved')}>
            {t(status === 'pending' ? 'admin.reviews.emptyPendingHint' : 'admin.reviews.emptyApprovedHint')}
          </EmptyState>
        )}
        {items.length > 0 && (
          <>
            <ul className="space-y-3">
              {items.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  busy={busyId === review.id}
                  onApprove={() => approve(review)}
                  onHide={() => hide(review)}
                  onDelete={() => remove(review)}
                />
              ))}
            </ul>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              countKey="admin.reviews.countAll"
              disabled={reviews.loading}
              onChange={(next) => setPageState({ status, page: next })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, busy, onApprove, onHide, onDelete }) {
  const { t, formatDateTime } = useI18n();
  const pending = review.status === 'pending';
  // Screen readers hear whose review a button acts on; the visible words stay first, so voice control matches them.
  const whose = (
    <>
      {' '}
      <span className="sr-only">– {review.name}</span>
    </>
  );
  return (
    <li className={`${card} p-4 ${pending ? 'border-amber-200' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words text-slate-900">{review.name}</p>
          <StarRating rating={review.rating} label={t('admin.reviews.stars', { rating: review.rating })} />
        </div>
        <time dateTime={review.createdAt} className="text-sm text-slate-500">
          {t('admin.reviews.receivedOn', { date: formatDateTime(review.createdAt) })}
        </time>
      </div>
      {review.comment ? (
        <p className="mt-2 break-words whitespace-pre-line text-slate-700">{review.comment}</p>
      ) : (
        <p className="mt-2 text-slate-500 italic">{t('admin.reviews.noComment')}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {pending ? (
          <button type="button" className={btnPrimary} onClick={onApprove} disabled={busy}>
            <Check className="size-5" aria-hidden="true" />
            {t('admin.reviews.approve')}
            {whose}
          </button>
        ) : (
          <button type="button" className={btnSecondary} onClick={onHide} disabled={busy}>
            <EyeOff className="size-4" aria-hidden="true" />
            {t('admin.reviews.hide')}
            {whose}
          </button>
        )}
        <button type="button" className={btnDanger} onClick={onDelete} disabled={busy}>
          <Trash2 className="size-4" aria-hidden="true" />
          {t('admin.common.delete')}
          {whose}
        </button>
      </div>
    </li>
  );
}
