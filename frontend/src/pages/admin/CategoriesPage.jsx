import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Pencil, Plus, Save, Tags, Trash2, Truck } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import { Badge } from '../../components/admin/Badges';
import { CheckboxField, TextArea, TextInput } from '../../components/admin/FormControls';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnDanger, btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage, fieldErrorsFrom, messageText } from '../../i18n/apiErrors';
import { fillTemplate } from '../../i18n/fill';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../../services/adminApi';

export default function CategoriesPage() {
  const { t, lang, pick } = useI18n();
  const categories = useFetch('categories', listCategories);
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [message, setMessage] = useState(null); // { tone, key, vars } or { tone, failure }
  const [busyId, setBusyId] = useState(null);

  async function runAction(category, action, success) {
    setBusyId(category.id);
    setMessage(null);
    try {
      await action();
      categories.reload();
      setMessage({ tone: 'success', ...success });
    } catch (error) {
      setMessage({ tone: 'error', failure: error });
    } finally {
      setBusyId(null);
    }
  }

  const handleToggle = (category) =>
    runAction(category, () => updateCategory(category.id, { isActive: !category.isActive }), {
      key: category.isActive ? 'admin.categories.nowHidden' : 'admin.categories.nowShown',
      vars: { name: pick(category, 'name') },
    });

  const handleDelete = (category) => {
    const name = pick(category, 'name');
    if (!window.confirm(t('admin.categories.confirmDelete', { name }))) return;
    runAction(category, () => deleteCategory(category.id), { key: 'admin.common.deletedName', vars: { name } });
  };

  function handleSaved(saved, isNew) {
    setEditing(null);
    categories.reload();
    setMessage({ tone: 'success', key: isNew ? 'admin.categories.added' : 'admin.common.savedName', vars: { name: pick(saved, 'name') } });
  }

  const items = categories.data?.items;

  return (
    <div className="max-w-3xl">
      <title>{`${t('admin.nav.categories')} · ${t('admin.brand')}`}</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-800">{t('admin.nav.categories')}</h1>
        {editing === null && (
          <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
            <Plus className="size-5" aria-hidden="true" />
            {t('admin.categories.add')}
          </button>
        )}
      </div>
      <p className="mt-1 text-slate-600">{t('admin.categories.intro')}</p>

      {message && (
        <div className="mt-4">
          <Alert tone={message.tone} onClose={() => setMessage(null)}>
            {message.failure ? apiErrorMessage(message.failure, t) : t(message.key, message.vars)}
          </Alert>
        </div>
      )}

      {editing !== null && (
        <div className="mt-4">
          <CategoryForm
            key={editing === 'new' ? 'new' : editing.id}
            category={editing === 'new' ? null : editing}
            nextSortOrder={(items?.reduce((max, c) => Math.max(max, c.sortOrder), 0) ?? 0) + 10}
            onCancel={() => setEditing(null)}
            onSaved={handleSaved}
          />
        </div>
      )}

      <div className="mt-4">
        {categories.failure && <ErrorBlock message={apiErrorMessage(categories.failure, t)} onRetry={categories.reload} />}
        {!items && categories.loading && <LoadingBlock label={t('admin.categories.loading')} />}
        {items?.length === 0 && (
          <EmptyState icon={Tags} title={t('admin.categories.empty')}>
            {fillTemplate(t('admin.categories.emptyHint'), { command: <code className="rounded bg-slate-100 px-1">npm run seed:categories</code> })}
          </EmptyState>
        )}
        {items?.length > 0 && (
          <ul className="space-y-3">
            {items.map((category) => {
              const name = pick(category, 'name');
              const other = lang === 'hi' ? category.nameEn : category.nameHi;
              return (
                <li key={category.id} className={`${card} p-4 ${category.isActive ? '' : 'bg-slate-50'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{name}</p>
                      {other && other !== name && (
                        <p className="text-slate-600" lang={lang === 'hi' ? 'en' : 'hi'}>
                          {other}
                        </p>
                      )}
                      <p className="text-sm text-slate-500">
                        {t('admin.categories.productCount', { count: category.productCount })}
                        {category.productCount !== category.activeProductCount && ` ${t('admin.categories.shownCount', { count: category.activeProductCount })}`}
                        {' · '}
                        {t('admin.categories.order', { order: category.sortOrder })}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!category.isActive && <Badge>{t('admin.common.hiddenFromWebsite')}</Badge>}
                      {category.showDeliveryNote && (
                        <Badge tone="blue">
                          <Truck className="mr-1 size-3.5" aria-hidden="true" />
                          {t('admin.categories.deliveryBadge')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" className={btnSecondary} onClick={() => setEditing(category)} disabled={busyId === category.id}>
                      <Pencil className="size-4" aria-hidden="true" />
                      {t('admin.common.edit')}
                    </button>
                    <button type="button" className={btnSecondary} onClick={() => handleToggle(category)} disabled={busyId === category.id}>
                      {category.isActive ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                      {category.isActive ? t('admin.common.hide') : t('admin.common.show')}
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() => handleDelete(category)}
                      disabled={busyId === category.id || category.productCount > 0}
                      aria-describedby={category.productCount > 0 ? `delete-note-${category.id}` : undefined}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t('admin.common.delete')}
                    </button>
                  </div>
                  {category.productCount > 0 && (
                    <p id={`delete-note-${category.id}`} className="mt-2 text-sm text-slate-500">
                      {t('admin.categories.cannotDelete')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryForm({ category, nextSortOrder, onCancel, onSaved }) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => ({
    nameEn: category?.nameEn ?? '',
    nameHi: category?.nameHi ?? '',
    descriptionEn: category?.descriptionEn ?? '',
    descriptionHi: category?.descriptionHi ?? '',
    sortOrder: String(category?.sortOrder ?? nextSortOrder),
    showDeliveryNote: category?.showDeliveryNote ?? false,
    isActive: category?.isActive ?? true,
  }));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const err = (field) => messageText(errors[field], t);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.nameEn.trim() && !values.nameHi.trim()) nextErrors.nameEn = { key: 'admin.categories.errName' };
    const sortOrder = Number(values.sortOrder);
    if (!/^\d{1,4}$/.test(values.sortOrder.trim())) nextErrors.sortOrder = { key: 'admin.categories.errOrder' };
    setErrors(nextErrors);
    setFailure(null);
    if (Object.keys(nextErrors).length) return;

    const body = { ...values, sortOrder };
    setSaving(true);
    try {
      const saved = category ? await updateCategory(category.id, body) : await createCategory(body);
      onSaved(saved, !category);
    } catch (error) {
      setErrors(fieldErrorsFrom(error, t));
      setFailure(error);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={`${card} space-y-4 border-brand-200 p-4 sm:p-6`}>
      <h2 className="text-lg font-semibold text-slate-800">{category ? t('admin.categories.editTitle') : t('admin.categories.newTitle')}</h2>
      {failure && <Alert tone="error">{apiErrorMessage(failure, t, 'admin.categories.saveFailed')}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput id="cat-nameHi" label={t('admin.categories.nameHi')} lang="hi" value={values.nameHi} onChange={set('nameHi')} error={err('nameHi')} maxLength={80} />
        <TextInput id="cat-nameEn" label={t('admin.categories.nameEn')} lang="en" value={values.nameEn} onChange={set('nameEn')} error={err('nameEn')} maxLength={80} />
        <TextArea id="cat-descriptionHi" label={t('admin.form.descriptionHi')} lang="hi" rows={2} value={values.descriptionHi} onChange={set('descriptionHi')} error={err('descriptionHi')} maxLength={500} />
        <TextArea id="cat-descriptionEn" label={t('admin.form.descriptionEn')} lang="en" rows={2} value={values.descriptionEn} onChange={set('descriptionEn')} error={err('descriptionEn')} maxLength={500} />
      </div>
      <div className="max-w-48">
        <TextInput
          id="cat-sortOrder"
          label={t('admin.categories.sortOrder')}
          inputMode="numeric"
          value={values.sortOrder}
          onChange={set('sortOrder')}
          error={err('sortOrder')}
          hint={t('admin.categories.sortOrderHint')}
        />
      </div>
      <CheckboxField
        id="cat-showDeliveryNote"
        label={t('admin.categories.deliveryLabel')}
        hint={t('admin.categories.deliveryHint')}
        checked={values.showDeliveryNote}
        onChange={(checked) => setValues((current) => ({ ...current, showDeliveryNote: checked }))}
      />
      <CheckboxField
        id="cat-isActive"
        label={t('admin.categories.showLabel')}
        hint={t('admin.categories.showHint')}
        checked={values.isActive}
        onChange={(checked) => setValues((current) => ({ ...current, isActive: checked }))}
      />
      <div className="flex gap-3">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
          {saving ? t('admin.common.saving') : category ? t('admin.common.saveChanges') : t('admin.categories.add')}
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={saving}>
          {t('admin.common.cancel')}
        </button>
      </div>
    </form>
  );
}
