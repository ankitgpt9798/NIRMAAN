import { lazy, Suspense, useLayoutEffect, useMemo } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { PackageSearch, RefreshCw, Store } from "lucide-react";
import ProductCard from "../components/public/ProductCard";
import { PriceNotice, SlowLoadingNotice } from "../components/public/Notices";
import { CategoryChips, SearchBar } from "../components/public/SearchAndFilter";
import { useFetch } from "../hooks/useFetch";
import { useI18n } from "../i18n/I18nContext";
import {
  getCachedCatalog,
  loadCatalog,
  takeScroll,
} from "../services/catalogCache";
import { categoriesFromProducts, filterProducts } from "../utils/catalog";

// Shop photo, gallery and reviews: separate file, fetched only after the prices are shown.
const CommunitySections = lazy(
  () => import("../components/public/CommunitySections"),
);

/**
 * Customer home page (what the QR code opens). Prices are fetched from the server
 * every time this page is opened or refreshed. Search and category filters work
 * on the loaded list instantly, without further requests; they are kept in the
 * address (?q=…&category=…) so "Back" from a product returns to the same view.
 * Below the products: the shop photo, the photo gallery and customer reviews
 * (loaded after the prices, so the price list always comes first).
 */
export default function CatalogPage() {
  const { t, formatDate } = useI18n();
  const { siteName, shop } = useOutletContext() ?? {};
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category") ?? "";

  const catalog = useFetch("catalog", loadCatalog, {
    initialData: getCachedCatalog(),
  });
  const products = useMemo(() => catalog.data?.items ?? [], [catalog.data]);
  const categories = useMemo(
    () => categoriesFromProducts(products),
    [products],
  );
  const visible = useMemo(
    () => filterProducts(products, { query, categoryId }),
    [products, query, categoryId],
  );

  // Returning from a product page: restore the scroll position of the list.
  useLayoutEffect(() => {
    const y = takeScroll();
    if (y) window.scrollTo(0, y);
  }, []);

  const updateParams = (changes) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [name, value] of Object.entries(changes)) {
          if (value) next.set(name, value);
          else next.delete(name);
        }
        return next;
      },
      { replace: true },
    );

  const hasData = Boolean(catalog.data);
  const filtered = Boolean(query.trim() || categoryId);
  const lastUpdated = catalog.data?.lastUpdated;

  return (
    <div>
      <title>
        {siteName ? `${siteName} – ${t("catalog.title")}` : t("catalog.title")}
      </title>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">
            {t("catalog.title")}
          </h1>
          {lastUpdated && (
            <p className="text-slate-600">
              {t("catalog.lastUpdated", { date: formatDate(lastUpdated) })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={catalog.reload}
          disabled={catalog.loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          <RefreshCw
            className={`size-5 ${catalog.loading ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          {catalog.loading && hasData
            ? t("catalog.refreshing")
            : t("catalog.refresh")}
        </button>
      </div>

      <div className="mt-3">
        <PriceNotice />
      </div>

      <div>
        {hasData && products.length > 0 && (
          <div className="mt-3 space-y-2">
            <SearchBar
              value={query}
              onChange={(value) => updateParams({ q: value })}
            />
            {categories.length > 1 && (
              <CategoryChips
                categories={categories}
                selectedId={categoryId}
                total={products.length}
                onSelect={(id) => updateParams({ category: id })}
              />
            )}
          </div>
        )}

        <div
          className="mt-3 space-y-3"
          aria-live="polite"
          aria-busy={catalog.loading}
        >
          {catalog.loading && !hasData && (
            <>
              <p className="text-slate-600" role="status">
                {t("catalog.loading")}
              </p>
              <SlowLoadingNotice />
              <SkeletonList />
            </>
          )}
          {catalog.loading && hasData && <SlowLoadingNotice />}

          {catalog.error && (
            <div
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
              role="alert"
            >
              <p>{hasData ? t("catalog.staleWarning") : t("catalog.error")}</p>
              <button
                type="button"
                onClick={catalog.reload}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 font-semibold text-white hover:bg-red-800"
              >
                <RefreshCw className="size-5" aria-hidden="true" />
                {t("catalog.retry")}
              </button>
            </div>
          )}

          {hasData && products.length === 0 && (
            <EmptyMessage
              icon={Store}
              title={t("catalog.empty.title")}
              body={t("catalog.empty.body")}
            />
          )}

          {hasData && products.length > 0 && visible.length === 0 && (
            <EmptyMessage
              icon={PackageSearch}
              title={t("catalog.noResults.title")}
              body={
                query.trim()
                  ? t("catalog.noResults.query", { query: query.trim() })
                  : t("catalog.noResults.category")
              }
              action={
                <button
                  type="button"
                  onClick={() => updateParams({ q: "", category: "" })}
                  className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800"
                >
                  {t("catalog.showAll")}
                </button>
              }
            />
          )}

          {visible.length > 0 && (
            <>
              <p className="text-sm text-slate-600">
                {filtered
                  ? t("catalog.countOf", {
                      count: visible.length,
                      total: products.length,
                    })
                  : visible.length === 1
                    ? t("catalog.count.one")
                    : t("catalog.count.other", { count: visible.length })}
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {hasData && (
        <Suspense fallback={null}>
          <CommunitySections shop={shop} />
        </Suspense>
      )}
    </div>
  );
}

function EmptyMessage({ icon: Icon, title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <Icon className="mx-auto size-10 text-slate-400" aria-hidden="true" />
      <p className="mt-3 text-lg font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-slate-600">{body}</p>
      {action}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((n) => (
        <li
          key={n}
          className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-col"
        >
          <div className="size-24 shrink-0 rounded-xl bg-slate-200 sm:aspect-[4/3] sm:size-auto sm:w-full" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-5 w-3/4 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
            <div className="h-7 w-1/3 rounded bg-slate-200" />
          </div>
        </li>
      ))}
    </ul>
  );
}
