import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { ACCEPTED_IMAGE_TYPES, prepareImage } from '../../utils/resizeImage';
import { resolveMediaUrl } from '../../utils/media';
import { btnDanger, btnSecondary } from './styles';

/**
 * Photo chooser (product photo or shop logo). The chosen photo is shrunk in the
 * browser and only uploaded when the form is saved.
 *   currentUrl – image already saved on the server (or '')
 *   onChange({ file, removed }) – file: new File or null; removed: true to delete the saved image
 *   kind – 'product', 'logo' or 'shopPhoto' (labels, preview shape, photo size)
 */
const KINDS = {
  product: { label: 'admin.image.productPhoto', choose: 'admin.image.chooseProductPhoto', maxSize: 1200, box: 'size-32' },
  logo: { label: 'admin.image.shopLogo', choose: 'admin.image.chooseShopLogo', maxSize: 1200, box: 'size-32' },
  // Shown big on the website, so it keeps more detail (1600px) and gets a wide preview.
  shopPhoto: { label: 'admin.image.shopPhoto', choose: 'admin.image.chooseShopPhoto', maxSize: 1600, box: 'aspect-video w-full max-w-xs' },
};

export default function ImagePicker({ currentUrl, file, removed, onChange, error, kind = 'product', fit = 'cover' }) {
  const { t } = useI18n();
  const inputId = useId();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState(null);
  const config = KINDS[kind] ?? KINDS.product;
  const label = t(config.label);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function handleSelect(event) {
    const chosen = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again later
    if (!chosen) return;
    setLocalError(null);
    setPreparing(true);
    try {
      const prepared = await prepareImage(chosen, { maxSize: config.maxSize });
      setPreview(URL.createObjectURL(prepared));
      onChange({ file: prepared, removed: false });
    } catch (err) {
      setLocalError(err);
    } finally {
      setPreparing(false);
    }
  }

  function handleRemove() {
    setPreview('');
    onChange({ file: null, removed: Boolean(currentUrl) });
  }

  const shownUrl = file && preview ? preview : !removed && currentUrl ? resolveMediaUrl(currentUrl) : '';
  const message = localError ? apiErrorMessage(localError, t, 'admin.image.errType') : error;

  return (
    <div>
      <span className="block font-medium text-slate-700">{label}</span>
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className={`flex ${config.box} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50`}>
          {preparing ? (
            <LoaderCircle className="size-7 animate-spin text-slate-400" aria-label={t('admin.image.preparing')} />
          ) : shownUrl ? (
            <img src={shownUrl} alt={t('admin.image.preview', { label })} className={`size-full ${fit === 'contain' ? 'object-contain p-2' : 'object-cover'}`} />
          ) : (
            <ImagePlus className="size-8 text-slate-400" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            onChange={handleSelect}
            className="sr-only"
            aria-label={t(config.choose)}
            tabIndex={-1}
          />
          <button type="button" className={btnSecondary} onClick={() => inputRef.current?.click()} disabled={preparing}>
            <ImagePlus className="size-5" aria-hidden="true" />
            {shownUrl ? t('admin.image.change') : t('admin.image.choose')}
          </button>
          {shownUrl && (
            <button type="button" className={btnDanger} onClick={handleRemove} disabled={preparing}>
              <Trash2 className="size-5" aria-hidden="true" />
              {t('admin.image.remove')}
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">{t('admin.image.hint')}</p>
      {file && <p className="text-sm text-accent-700">{t('admin.image.willUpload')}</p>}
      {removed && !file && <p className="text-sm text-amber-800">{t('admin.image.willRemove')}</p>}
      {message && <p className="mt-1 text-sm font-medium text-red-700">{message}</p>}
    </div>
  );
}
