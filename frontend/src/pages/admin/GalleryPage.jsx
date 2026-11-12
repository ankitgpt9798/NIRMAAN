import { useRef, useState } from 'react';
import { ExternalLink, ImagePlus, Images, LoaderCircle, Save, Trash2 } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import { TextInput } from '../../components/admin/FormControls';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnDanger, btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage, fieldErrorsFrom } from '../../i18n/apiErrors';
import { addGalleryPhoto, deleteGalleryPhoto, listGallery, updateGalleryPhoto } from '../../services/adminApi';
import { resizedImageUrl } from '../../utils/media';
import { ACCEPTED_IMAGE_TYPES, prepareImage } from '../../utils/resizeImage';

/**
 * Photo gallery shown on the website below the shop photo. Several photos can be
 * chosen at once; each is shrunk on the phone and uploaded one after another.
 */
export default function GalleryPage() {
  const { t } = useI18n();
  const gallery = useFetch('gallery', listGallery);
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null); // { current, total } while uploading
  const [message, setMessage] = useState(null); // { tone, text }

  const items = gallery.data?.items ?? [];
  const max = gallery.data?.max ?? 40;
  const full = items.length >= max;

  async function handleFiles(event) {
    const files = [...(event.target.files ?? [])];
    event.target.value = ''; // the same photos can be chosen again later
    if (!files.length) return;
    setMessage(null);

    const room = Math.max(0, max - items.length);
    const toUpload = files.slice(0, room);
    let added = 0;
    let firstFailure = files.length > room ? { i18nKey: 'admin.error.galleryFull' } : null;
    for (const [index, file] of toUpload.entries()) {
      setProgress({ current: index + 1, total: toUpload.length });
      try {
        const photo = await addGalleryPhoto(await prepareImage(file, { maxSize: 1600 }));
        gallery.mutate((data) => ({ ...data, items: [photo, ...data.items] }));
        added += 1;
      } catch (error) {
        firstFailure ??= error;
      }
    }
    setProgress(null);

    const failed = files.length - added;
    if (failed) {
      setMessage({ tone: added ? 'warning' : 'error', text: t('admin.gallery.someFailed', { failed, total: files.length, reason: apiErrorMessage(firstFailure, t) }) });
    } else {
      setMessage({ tone: 'success', text: added === 1 ? t('admin.gallery.added.one') : t('admin.gallery.added.other', { count: added }) });
    }
  }

  async function handleDelete(photo) {
    if (!window.confirm(t('admin.gallery.confirmDelete'))) return;
    setMessage(null);
    try {
      await deleteGalleryPhoto(photo.id);
      gallery.mutate((data) => ({ ...data, items: data.items.filter((item) => item.id !== photo.id) }));
      setMessage({ tone: 'success', text: t('admin.gallery.deleted') });
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorMessage(error, t) });
    }
  }

  const uploading = progress !== null;

  return (
    <div className="max-w-5xl">
      <title>{`${t('admin.nav.gallery')} · ${t('admin.brand')}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.gallery')}</h1>
        <a href="/" className={btnSecondary}>
          <ExternalLink className="size-4" aria-hidden="true" />
          {t('admin.nav.viewWebsite')}
        </a>
      </div>
      <p className="mt-1 text-slate-600">{t('admin.gallery.intro', { max })}</p>

      {gallery.data && (
        <div className={`${card} mt-4 flex flex-wrap items-center justify-between gap-3 p-4`}>
          <p className="text-slate-700">{t('admin.gallery.count', { count: items.length, max })}</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            onChange={handleFiles}
            className="sr-only"
            tabIndex={-1}
            aria-label={t('admin.gallery.chooseLabel')}
          />
          <button type="button" className={btnPrimary} onClick={() => inputRef.current?.click()} disabled={uploading || full}>
            {uploading ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
            {t('admin.gallery.add')}
          </button>
          {uploading && (
            <p className="w-full font-medium text-accent-700" role="status">
              {t('admin.gallery.uploading', progress)}
            </p>
          )}
          {full && !uploading && <p className="w-full text-amber-800">{t('admin.gallery.full', { max })}</p>}
          <p className="w-full text-sm text-slate-500">{t('admin.image.hint')}</p>
        </div>
      )}

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      <div className="mt-4" aria-busy={gallery.loading}>
        {gallery.failure && <ErrorBlock message={apiErrorMessage(gallery.failure, t)} onRetry={gallery.reload} />}
        {!gallery.data && gallery.loading && <LoadingBlock label={t('admin.gallery.loading')} />}
        {gallery.data && items.length === 0 && (
          <EmptyState icon={Images} title={t('admin.gallery.empty')}>
            {t('admin.gallery.emptyHint')}
          </EmptyState>
        )}
        {items.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((photo, index) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                number={index + 1}
                onSaved={(saved) => gallery.mutate((data) => ({ ...data, items: data.items.map((item) => (item.id === saved.id ? saved : item)) }))}
                onDelete={() => handleDelete(photo)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PhotoCard({ photo, number, onSaved, onDelete }) {
  const { t } = useI18n();
  const [captions, setCaptions] = useState({ captionHi: photo.captionHi, captionEn: photo.captionEn });
  const [state, setState] = useState({ saving: false, saved: false, failure: null, errors: {} });
  const changed = captions.captionHi !== photo.captionHi || captions.captionEn !== photo.captionEn;
  const set = (name) => (event) => {
    setCaptions((current) => ({ ...current, [name]: event.target.value }));
    setState((current) => ({ ...current, saved: false }));
  };

  async function handleSave(event) {
    event.preventDefault();
    setState({ saving: true, saved: false, failure: null, errors: {} });
    try {
      const saved = await updateGalleryPhoto(photo.id, captions);
      onSaved(saved);
      setCaptions({ captionHi: saved.captionHi, captionEn: saved.captionEn });
      setState({ saving: false, saved: true, failure: null, errors: {} });
    } catch (error) {
      setState({ saving: false, saved: false, failure: error, errors: fieldErrorsFrom(error, t) });
    }
  }

  return (
    <li className={`${card} overflow-hidden`}>
      <img
        src={resizedImageUrl(photo.image.url, 600)}
        alt={photo.captionHi || photo.captionEn || t('admin.gallery.photoAlt', { number })}
        loading="lazy"
        className="aspect-[4/3] w-full bg-slate-100 object-cover"
      />
      <form onSubmit={handleSave} className="space-y-3 p-4" noValidate>
        <TextInput
          id={`caption-hi-${photo.id}`}
          label={t('admin.gallery.captionHi')}
          lang="hi"
          value={captions.captionHi}
          onChange={set('captionHi')}
          error={state.errors.captionHi}
          maxLength={150}
        />
        <TextInput
          id={`caption-en-${photo.id}`}
          label={t('admin.gallery.captionEn')}
          lang="en"
          value={captions.captionEn}
          onChange={set('captionEn')}
          error={state.errors.captionEn}
          maxLength={150}
        />
        {state.failure && !Object.keys(state.errors).length && <p className="text-sm font-medium text-red-700">{apiErrorMessage(state.failure, t)}</p>}
        {state.saved && (
          <p className="text-sm font-medium text-brand-700" role="status">
            {t('admin.gallery.captionSaved')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnSecondary} disabled={!changed || state.saving}>
            {state.saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {state.saving ? t('admin.common.saving') : t('admin.gallery.saveCaption')}
          </button>
          <button type="button" className={btnDanger} onClick={onDelete} aria-label={t('admin.gallery.deleteOf', { number })}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t('admin.common.delete')}
          </button>
        </div>
      </form>
    </li>
  );
}
