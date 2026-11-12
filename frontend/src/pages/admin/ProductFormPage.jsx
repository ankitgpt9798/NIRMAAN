import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, Save, Truck } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import { CheckboxField, SelectInput, TextArea, TextInput } from '../../components/admin/FormControls';
import ImagePicker from '../../components/admin/ImagePicker';
import { ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage, fieldErrorsFrom, messageText } from '../../i18n/apiErrors';
import { fillTemplate } from '../../i18n/fill';
import { createProduct, deleteProductImage, getMeta, getProduct, listCategories, updateProduct, uploadProductImage } from '../../services/adminApi';
import { formatPrice, parseMoney } from '../../utils/format';

export default function ProductFormPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const meta = useFetch('meta', getMeta);
  const categories = useFetch('categories', listCategories);
  const product = useFetch(isEdit ? `product:${id}` : 'product:new', () => (isEdit ? getProduct(id) : Promise.resolve(null)));

  const title = isEdit ? t('admin.form.editTitle') : t('admin.products.add');
  const failure = meta.failure || categories.failure || product.failure;
  const ready = meta.data && categories.data && (!isEdit || product.data);

  return (
    <div className="max-w-3xl">
      <title>{`${title} · ${t('admin.brand')}`}</title>
      <Link to="/admin/products" className="inline-flex min-h-11 items-center gap-2 font-medium text-accent-700 hover:underline">
        <ArrowLeft className="size-5" aria-hidden="true" />
        {t('admin.form.back')}
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-brand-800">{title}</h1>

      {location.state?.flashKey && (
        <div className="mt-4">
          <Alert tone={location.state.flashTone || 'success'}>{t(location.state.flashKey, location.state.flashVars)}</Alert>
        </div>
      )}

      <div className="mt-4">
        {failure ? (
          <ErrorBlock
            message={apiErrorMessage(failure, t)}
            onRetry={() => {
              meta.reload();
              categories.reload();
              product.reload();
            }}
          />
        ) : !ready ? (
          <LoadingBlock />
        ) : (
          <ProductForm
            key={product.data?.id ?? 'new'}
            product={product.data}
            units={meta.data.units}
            availabilityOptions={meta.data.availability}
            categories={categories.data.items}
          />
        )}
      </div>
    </div>
  );
}

const initialValues = (product) => ({
  nameEn: product?.nameEn ?? '',
  nameHi: product?.nameHi ?? '',
  brand: product?.brand ?? '',
  category: product?.category?.id ?? '',
  unit: product?.unit ?? '',
  sellingPrice: product ? String(product.sellingPrice) : '',
  mrp: product?.mrp !== null && product?.mrp !== undefined ? String(product.mrp) : '',
  availability: product?.availability ?? 'in_stock',
  isActive: product?.isActive ?? true,
  descriptionEn: product?.descriptionEn ?? '',
  descriptionHi: product?.descriptionHi ?? '',
});

/** Checks in the browser. Errors are descriptions ({ key, ... }) translated when shown. */
function validate(values, product) {
  const errors = {};
  if (!values.nameEn.trim() && !values.nameHi.trim()) errors.nameEn = { key: 'admin.form.errName' };
  if (!values.category) errors.category = { key: 'admin.form.errCategory' };
  if (!values.unit) errors.unit = { key: 'admin.form.errUnit' };

  let sellingPrice = product?.sellingPrice;
  if (!product) {
    const parsed = parseMoney(values.sellingPrice);
    if (parsed.error) errors.sellingPrice = { key: `admin.money.${parsed.error}`, labelKey: 'admin.label.sellingPrice' };
    else if (parsed.value === null) errors.sellingPrice = { key: 'admin.form.errPriceRequired' };
    sellingPrice = parsed.value;
  }

  const mrp = parseMoney(values.mrp);
  if (mrp.error) errors.mrp = { key: `admin.money.${mrp.error}`, labelKey: 'admin.label.mrp' };
  else if (mrp.value !== null && typeof sellingPrice === 'number' && mrp.value < sellingPrice) {
    errors.mrp = { key: 'admin.form.errMrpBelow', vars: { price: formatPrice(sellingPrice) } };
  }

  return { errors, sellingPrice, mrp: mrp.value };
}

function ProductForm({ product, units, availabilityOptions, categories }) {
  const { t, lang, pick } = useI18n();
  const otherLang = lang === 'hi' ? 'en' : 'hi';
  const navigate = useNavigate();
  const [values, setValues] = useState(() => initialValues(product));
  const [image, setImage] = useState({ file: null, removed: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null); // { key } or { failure }
  const [saving, setSaving] = useState(false);

  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const err = (field) => messageText(errors[field], t);
  const selectedCategory = categories.find((category) => category.id === values.category);

  async function handleSubmit(event) {
    event.preventDefault();
    const check = validate(values, product);
    setErrors(check.errors);
    setFormError(null);
    if (Object.keys(check.errors).length) {
      setFormError({ key: 'admin.error.checkFields' });
      return;
    }

    const body = {
      nameEn: values.nameEn,
      nameHi: values.nameHi,
      brand: values.brand,
      category: values.category,
      unit: values.unit,
      mrp: check.mrp,
      availability: values.availability,
      isActive: values.isActive,
      descriptionEn: values.descriptionEn,
      descriptionHi: values.descriptionHi,
      ...(product ? {} : { sellingPrice: check.sellingPrice }),
    };

    setSaving(true);
    let saved;
    try {
      saved = product ? await updateProduct(product.id, body) : await createProduct(body);
    } catch (error) {
      setErrors(fieldErrorsFrom(error, t));
      setFormError({ failure: error });
      setSaving(false);
      return;
    }

    try {
      if (image.file) saved = await uploadProductImage(saved.id, image.file);
      else if (image.removed && product?.image) saved = await deleteProductImage(saved.id);
    } catch (error) {
      // The product itself is saved; send the owner to its edit page to retry the photo.
      navigate(`/admin/products/${saved.id}/edit`, {
        replace: true,
        state: { flashTone: 'warning', flashKey: 'admin.form.photoFailed', flashVars: { reason: apiErrorMessage(error, t) } },
      });
      return;
    }

    navigate('/admin/products', { state: { flashKey: 'admin.common.savedName', flashVars: { name: pick(saved, 'name') } } });
  }

  const formErrorText = formError
    ? errors._form ? messageText(errors._form, t) : formError.failure ? apiErrorMessage(formError.failure, t, 'admin.form.saveFailed') : t(formError.key)
    : '';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formErrorText && <Alert tone="error">{formErrorText}</Alert>}

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.form.sectionName')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput id="nameHi" label={t('admin.form.nameHi')} lang="hi" value={values.nameHi} onChange={set('nameHi')} error={err('nameHi')} maxLength={120} placeholder={t('admin.form.nameHiPlaceholder')} />
          <TextInput id="nameEn" label={t('admin.form.nameEn')} lang="en" value={values.nameEn} onChange={set('nameEn')} error={err('nameEn')} maxLength={120} placeholder={t('admin.form.nameEnPlaceholder')} />
        </div>
        <p className="-mt-2 text-sm text-slate-500">{t('admin.form.nameHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput id="brand" label={t('admin.form.brand')} value={values.brand} onChange={set('brand')} error={err('brand')} maxLength={80} />
          <SelectInput id="category" label={t('admin.form.category')} required value={values.category} onChange={set('category')} error={err('category')}>
            <option value="">{t('admin.form.chooseCategory')}</option>
            {categories.map((category) => {
              const name = pick(category, 'name');
              const other = category[`name${otherLang === 'hi' ? 'Hi' : 'En'}`];
              return (
                <option key={category.id} value={category.id}>
                  {name}
                  {other && other !== name ? ` / ${other}` : ''}
                  {category.isActive ? '' : t('admin.common.hiddenSuffix')}
                </option>
              );
            })}
          </SelectInput>
        </div>
        {selectedCategory?.showDeliveryNote && (
          <p className="flex items-center gap-2 text-sm text-accent-700">
            <Truck className="size-4" aria-hidden="true" />
            {t('admin.form.deliveryNote')}
          </p>
        )}
        {selectedCategory && !selectedCategory.isActive && <Alert tone="warning">{t('admin.form.categoryHiddenWarning')}</Alert>}
      </section>

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.form.sectionPrice')}</h2>
        <SelectInput id="unit" label={t('admin.form.unit')} required value={values.unit} onChange={set('unit')} error={err('unit')}>
          <option value="">{t('admin.form.chooseUnit')}</option>
          {units.map((unit) => (
            <option key={unit.key} value={unit.key}>
              {unit[lang]} — {unit[otherLang]}
            </option>
          ))}
        </SelectInput>

        <div className="grid gap-4 sm:grid-cols-2">
          {product ? (
            <div>
              <p className="font-medium text-slate-700">{t('admin.form.sellingPriceReadonly')}</p>
              <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-lg font-bold text-brand-800">{formatPrice(product.sellingPrice)}</span>
                <PriceChangedDate date={product.priceUpdatedAt} />
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {fillTemplate(t('admin.form.priceChangeHint'), {
                  updatePrices: (
                    <Link to={`/admin/prices?q=${encodeURIComponent(pick(product, 'name'))}`} className="font-semibold text-accent-700 underline">
                      {t('admin.nav.prices')}
                    </Link>
                  ),
                  history: (
                    <Link to={`/admin/price-history?product=${product.id}`} className="font-semibold text-accent-700 underline">
                      {t('admin.form.historyLink')}
                    </Link>
                  ),
                })}
              </p>
            </div>
          ) : (
            <TextInput
              id="sellingPrice"
              label={t('admin.form.sellingPrice')}
              required
              inputMode="decimal"
              autoComplete="off"
              value={values.sellingPrice}
              onChange={set('sellingPrice')}
              error={err('sellingPrice')}
              hint={t('admin.form.sellingPriceHint')}
            />
          )}
          <TextInput
            id="mrp"
            label={t('admin.form.mrp')}
            inputMode="decimal"
            autoComplete="off"
            value={values.mrp}
            onChange={set('mrp')}
            error={err('mrp')}
            hint={t('admin.form.mrpHint')}
          />
        </div>
      </section>

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.form.sectionStock')}</h2>
        <fieldset>
          <legend className="font-medium text-slate-700">{t('admin.form.availability')}</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {availabilityOptions.map((option) => (
              <label
                key={option.value}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                  values.availability === option.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="availability"
                  value={option.value}
                  checked={values.availability === option.value}
                  onChange={set('availability')}
                  className="size-5 accent-brand-700"
                />
                <span>
                  <span className="block font-medium">{option[lang]}</span>
                  <span className="block text-sm text-slate-600" lang={otherLang}>
                    {option[otherLang]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <CheckboxField
          id="isActive"
          label={t('admin.form.showOnWebsite')}
          hint={t('admin.form.showOnWebsiteHint')}
          checked={values.isActive}
          onChange={(checked) => setValues((current) => ({ ...current, isActive: checked }))}
        />
      </section>

      <section className={`${card} space-y-4 p-4 sm:p-6`}>
        <h2 className="text-lg font-semibold text-slate-800">{t('admin.form.sectionDescription')}</h2>
        <TextArea id="descriptionHi" label={t('admin.form.descriptionHi')} lang="hi" value={values.descriptionHi} onChange={set('descriptionHi')} error={err('descriptionHi')} maxLength={1000} />
        <TextArea id="descriptionEn" label={t('admin.form.descriptionEn')} lang="en" value={values.descriptionEn} onChange={set('descriptionEn')} error={err('descriptionEn')} maxLength={1000} />
        <ImagePicker kind="product" currentUrl={product?.image?.url ?? ''} file={image.file} removed={image.removed} onChange={setImage} />
      </section>

      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button type="submit" className={`${btnPrimary} flex-1 sm:flex-none`} disabled={saving}>
          {saving ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
          {saving ? t('admin.common.saving') : product ? t('admin.common.saveChanges') : t('admin.products.add')}
        </button>
        <Link to="/admin/products" className={btnSecondary}>
          {t('admin.common.cancel')}
        </Link>
      </div>
    </form>
  );
}

function PriceChangedDate({ date }) {
  const { t, formatDateTime } = useI18n();
  return <span className="block text-sm text-slate-500">{t('admin.form.priceLastChanged', { date: formatDateTime(date) })}</span>;
}
