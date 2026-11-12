import { Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export function SearchBar({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="relative">
      <label htmlFor="catalog-search" className="sr-only">
        {t('search.label')}
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        id="catalog-search"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('search.placeholder')}
        className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white pr-12 pl-11 text-base text-slate-900 placeholder:text-slate-500 focus:border-accent-500 focus:ring-2 focus:ring-accent-200 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-11 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800"
          aria-label={t('search.clear')}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Horizontally scrollable category buttons: "All" plus each category that has products. */
export function CategoryChips({ categories, selectedId, total, onSelect }) {
  const { t, pick } = useI18n();
  const chip = (active) =>
    `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 font-medium whitespace-nowrap ${
      active ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'
    }`;
  const count = (n, active) => <span className={`text-sm ${active ? 'text-brand-100' : 'text-slate-500'}`}>{n}</span>;

  return (
    <div role="group" aria-label={t('filter.label')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]">
      <button type="button" className={chip(!selectedId)} aria-pressed={!selectedId} onClick={() => onSelect('')}>
        {t('filter.all')} {count(total, !selectedId)}
      </button>
      {categories.map((category) => {
        const active = category.id === selectedId;
        return (
          <button key={category.id} type="button" className={chip(active)} aria-pressed={active} onClick={() => onSelect(category.id)}>
            {pick(category, 'name')} {count(category.count, active)}
          </button>
        );
      })}
    </div>
  );
}
