import { useId, useState } from 'react';
import { CheckCircle2, LoaderCircle, Send, Star } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { submitReview } from '../../services/publicApi';

const NAME_MAX = 60;
const COMMENT_MAX = 500;
const EMPTY = { name: '', rating: 0, comment: '', website: '' };

/** Which message to show when sending fails. */
function errorKey(error) {
  if (!error?.response) return error?.request ? 'reviews.form.errNetwork' : 'reviews.form.errGeneric';
  if (error.response.status === 429) return 'reviews.form.errTooMany';
  if (error.response.data?.error?.code === 'REVIEWS_PAUSED') return 'reviews.form.errPaused';
  return 'reviews.form.errGeneric';
}

/**
 * "Write a review": name, 1–5 stars and an optional comment. No login. The review
 * is saved as waiting for approval and appears after the shop checks it.
 */
export default function ReviewForm() {
  const { t } = useI18n();
  const id = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ state: 'idle' }); // idle | sending | sent | failed (+ key)

  const set = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    if (status.state !== 'sending') setStatus({ state: 'idle' });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'reviews.form.errName';
    if (values.rating < 1) nextErrors.rating = 'reviews.form.errRating';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(nextErrors.name ? `${id}-name` : `${id}-star-1`)?.focus();
      return;
    }

    setStatus({ state: 'sending' });
    try {
      await submitReview({ name: values.name.trim(), rating: values.rating, comment: values.comment.trim(), website: values.website });
      setValues(EMPTY);
      setStatus({ state: 'sent' });
    } catch (error) {
      setStatus({ state: 'failed', key: errorKey(error) });
    }
  }

  const sending = status.state === 'sending';
  const field = 'block min-h-12 w-full rounded-xl border bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:outline-none';
  const fieldState = (hasError) => (hasError ? 'border-red-500 focus:border-red-600 focus:ring-red-200' : 'border-slate-300 focus:border-accent-500 focus:ring-accent-200');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-lg font-bold text-slate-900">
        {t('reviews.form.title')}
      </h3>

      <div>
        <label htmlFor={`${id}-name`} className="block font-medium text-slate-700">
          {t('reviews.form.name')}
        </label>
        <input
          id={`${id}-name`}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          maxLength={NAME_MAX}
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
          className={`${field} ${fieldState(errors.name)} mt-1`}
        />
        {errors.name && (
          <p id={`${id}-name-error`} className="mt-1 text-sm font-medium text-red-700">
            {t(errors.name)}
          </p>
        )}
      </div>

      <fieldset aria-describedby={errors.rating ? `${id}-rating-error` : undefined}>
        <legend className="font-medium text-slate-700">{t('reviews.form.rating')}</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500">
              <input
                id={`${id}-star-${n}`}
                type="radio"
                name={`${id}-rating`}
                value={n}
                checked={values.rating === n}
                onChange={() => set('rating', n)}
                className="sr-only"
              />
              <Star className={`size-9 ${n <= values.rating ? 'fill-amber-400 text-amber-500' : 'fill-transparent text-slate-400'}`} aria-hidden="true" />
              <span className="sr-only">{n === 1 ? t('reviews.form.star.one') : t('reviews.form.star.other', { count: n })}</span>
            </label>
          ))}
        </div>
        {errors.rating && (
          <p id={`${id}-rating-error`} className="mt-1 text-sm font-medium text-red-700">
            {t(errors.rating)}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor={`${id}-comment`} className="block font-medium text-slate-700">
          {t('reviews.form.comment')}
        </label>
        <textarea
          id={`${id}-comment`}
          rows={4}
          value={values.comment}
          onChange={(event) => set('comment', event.target.value)}
          maxLength={COMMENT_MAX}
          placeholder={t('reviews.form.commentPlaceholder')}
          aria-describedby={`${id}-comment-left`}
          className={`${field} ${fieldState(false)} mt-1 py-3`}
        />
        <p id={`${id}-comment-left`} className="mt-1 text-right text-sm text-slate-500">
          {t('reviews.form.charsLeft', { count: COMMENT_MAX - values.comment.length })}
        </p>
      </div>

      {/* Hidden from people (and screen readers). Bots that fill in every field reveal themselves here. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => set('website', event.target.value)} />
      </div>

      <p className="text-sm text-slate-600">{t('reviews.form.note')}</p>

      {status.state === 'sent' && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 font-medium text-brand-800" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {t('reviews.form.thanks')}
        </p>
      )}
      {status.state === 'failed' && (
        <p className="rounded-xl bg-red-50 p-3 font-medium text-red-800" role="alert">
          {t(status.key)}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60 sm:w-auto"
      >
        {sending ? <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        {sending ? t('reviews.form.sending') : t('reviews.form.submit')}
      </button>
    </form>
  );
}
