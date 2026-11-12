import { useState } from 'react';
import { ExternalLink, LoaderCircle, Save } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import { TextArea, TextInput } from '../../components/admin/FormControls';
import ImagePicker from '../../components/admin/ImagePicker';
import { ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage, fieldErrorsFrom, messageText } from '../../i18n/apiErrors';
import { deleteShopLogo, deleteShopPhoto, getShopSettings, updateShopSettings, uploadShopLogo, uploadShopPhoto } from '../../services/adminApi';

const PHONE_PATTERN = /^\+?[0-9][0-9 -]{6,18}$/;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const FIELDS = ['nameEn', 'nameHi', 'phone', 'whatsapp', 'addressEn', 'addressHi', 'descriptionEn', 'descriptionHi', 'websiteUrl'];

/** Shop details shown on the customer website (header, contact section, product pages). */
export default function SettingsPage() {
  const { t } = useI18n();
  const shop = useFetch('shop-settings', getShopSettings);
  const [message, setMessage] = useState(null); // { tone: 'success' } or { tone: 'warning', failures: [{ key, failure }] }

  function handleSaved(saved, failures) {
    shop.mutate(() => saved);
    setMessage(failures.length ? { tone: 'warning', failures } : { tone: 'success' });
  }

  return (
    <div className="max-w-3xl">
      <title>{`${t('admin.nav.settings')} · ${t('admin.brand')}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.settings')}</h1>
        <a href="/" target="_blank" rel="noopener" className={btnSecondary}>
          <ExternalLink className="size-4" aria-hidden="true" />
          {t('admin.nav.viewWebsite')}
        </a>
      </div>
      <p className="mt-1 text-slate-600">{t('admin.settings.intro')}</p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone} onClose={() => setMessage(null)}>
            {message.failures
              ? message.failures.map(({ key, failure }) => (
                  <span key={key} className="block">
                    {t(key, { reason: apiErrorMessage(failure, t) })}
                  </span>
                ))
              : t('admin.settings.saved')}
          </Alert>
        </div>
      )}

      <div className="mt-4">
        {shop.failure && <ErrorBlock message={apiErrorMessage(shop.failure, t)} onRetry={shop.reload} />}
        {!shop.data && shop.loading && <LoadingBlock />}
        {shop.data && (
          <ShopForm key={shop.data.updatedAt ?? 'new'} shop={shop.data} onSaved={handleSaved} onError={() => setMessage(null)} />
        )}
      </div>
    </div>
  );
}

/** Checks in the browser; messages are text keys, translated when shown. */
function validate(values) {
  const errors = {};
  for (const field of ['phone', 'whatsapp']) {
    if (values[field].trim() && !PHONE_PATTERN.test(values[field].trim())) errors[field] = { key: 'admin.settings.errPhone' };
  }
  if (values.websiteUrl.trim() && !URL_PATTERN.test(values.websiteUrl.trim())) errors.websiteUrl = { key: 'admin.settings.errWebsite' };
  return errors;
}

function ShopForm({ shop, onSaved, onError }) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((field) => [field, shop[field] ?? ''])));
  const [logo, setLogo] = useState({ file: null, removed: false });
  const [photo, setPhoto] = useState({ file: null, removed: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null); // { key } or { failure }
  const [saving, setSaving] = useState(false);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const err = (field) => messageText(errors[field], t);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) {
      setFormError({ key: 'admin.error.checkFields' });
      onError();
      return;
    }

    setSaving(true);
    let saved;
    try {
      saved = await updateShopSettings(values);
    } catch (error) {
      setErrors(fieldErrorsFrom(error, t));
      setFormError({ failure: error });
      setSaving(false);
      onError();
      return;
    }

    // Then the logo and the shop photo; one failing does not stop the other.
    const images = [
      { state: logo, reset: setLogo, upload: uploadShopLogo, remove: deleteShopLogo, key: 'admin.settings.logoFailed' },
      { state: photo, reset: setPhoto, upload: uploadShopPhoto, remove: deleteShopPhoto, key: 'admin.settings.photoFailed' },
    ];
    const failures = [];
    for (const { state, reset, upload, remove, key } of images) {
      try {
        if (state.file) saved = await upload(state.file);
        else if (state.removed) saved = await remove();
        reset({ file: null, removed: false });
      } catch (error) {
        failures.push({ key, failure: error });
      }
    }
    // The form reloads with the saved values when they changed; if nothing changed it stays as is.
    setSaving(false);
    onSaved(saved, failures);
  }

  const noName = !values.nameEn.trim() && !values.nameHi.trim();
  const formErrorText = formError
    ? errors._form ? messageText(errors._form, t) : formError.failure ? apiErrorMessage(formError.failure, t, 'admin.settings.saveFailed') : t(formError.key)
    : '';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formErrorText && <Alert tone="error">{formErrorText}</Alert>}

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.settings.sectionName')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput id="nameHi" label={t('admin.settings.nameHi')} lang="hi" value={values.nameHi} onChange={set('nameHi')} error={err('nameHi')} maxLength={120} />
          <TextInput id="nameEn" label={t('admin.settings.nameEn')} lang="en" value={values.nameEn} onChange={set('nameEn')} error={err('nameEn')} maxLength={120} />
        </div>
        {noName && <p className="text-sm text-amber-800">{t('admin.settings.noName', { fallback: t('site.defaultTitle') })}</p>}
        <ImagePicker kind="logo" fit="contain" currentUrl={shop.logo?.url ?? ''} file={logo.file} removed={logo.removed} onChange={setLogo} />
      </section>

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.settings.sectionPhoto')}</h2>
        <p className="text-sm text-slate-600">{t('admin.settings.photoHint')}</p>
        <ImagePicker kind="shopPhoto" currentUrl={shop.photo?.url ?? ''} file={photo.file} removed={photo.removed} onChange={setPhoto} />
      </section>

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.settings.sectionContact')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="phone"
            label={t('admin.settings.phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={set('phone')}
            error={err('phone')}
            hint={t('admin.settings.phoneHint')}
            maxLength={20}
          />
          <TextInput
            id="whatsapp"
            label={t('admin.settings.whatsapp')}
            type="tel"
            inputMode="tel"
            value={values.whatsapp}
            onChange={set('whatsapp')}
            error={err('whatsapp')}
            hint={t('admin.settings.whatsappHint')}
            maxLength={20}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea id="addressHi" label={t('admin.settings.addressHi')} lang="hi" rows={2} value={values.addressHi} onChange={set('addressHi')} error={err('addressHi')} maxLength={300} />
          <TextArea id="addressEn" label={t('admin.settings.addressEn')} lang="en" rows={2} value={values.addressEn} onChange={set('addressEn')} error={err('addressEn')} maxLength={300} />
        </div>
      </section>

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.settings.sectionAbout')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea
            id="descriptionHi"
            label={t('admin.settings.aboutHi')}
            lang="hi"
            value={values.descriptionHi}
            onChange={set('descriptionHi')}
            error={err('descriptionHi')}
            maxLength={1000}
            placeholder={t('admin.settings.aboutHiPlaceholder')}
          />
          <TextArea
            id="descriptionEn"
            label={t('admin.settings.aboutEn')}
            lang="en"
            value={values.descriptionEn}
            onChange={set('descriptionEn')}
            error={err('descriptionEn')}
            maxLength={1000}
            placeholder={t('admin.settings.aboutEnPlaceholder')}
          />
        </div>
        <TextInput
          id="websiteUrl"
          label={t('admin.settings.website')}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          value={values.websiteUrl}
          onChange={set('websiteUrl')}
          error={err('websiteUrl')}
          hint={t('admin.settings.websiteHint')}
          maxLength={300}
        />
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="submit" className={`${btnPrimary} w-full sm:w-auto`} disabled={saving}>
          {saving ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
          {saving ? t('admin.common.saving') : t('admin.settings.submit')}
        </button>
      </div>
    </form>
  );
}
