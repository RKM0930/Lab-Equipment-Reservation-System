import { useDeferredValue, useMemo, useState } from 'react';
import {
  CalendarPlus,
  ChevronDown,
  PackageOpen,
  Plus,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import type { Equipment } from '../types/lab';

interface EquipmentCatalogProps {
  equipment: Equipment[];
  loading: boolean;
  isCustodian: boolean;
  onReserve: (equipment: Equipment) => void;
  onRegister: () => void;
}

function CatalogSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="card p-4">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton mt-4 h-4 w-3/4" />
          <div className="skeleton mt-2 h-3 w-1/3" />
          <div className="skeleton mt-8 h-1.5 w-full rounded-full" />
          <div className="skeleton mt-4 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function EquipmentCatalog({
  equipment,
  loading,
  isCustodian,
  onReserve,
  onRegister,
}: EquipmentCatalogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const deferredQuery = useDeferredValue(searchQuery);

  const categories = useMemo(
    () => Array.from(new Set(equipment.map((item) => item.category))).sort((a, b) => a.localeCompare(b)),
    [equipment],
  );

  const activeCategory =
    selectedCategory === 'ALL' || categories.includes(selectedCategory)
      ? selectedCategory
      : 'ALL';

  const filteredEquipment = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return equipment.filter((item) => {
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [item.item_code, item.name, item.category]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [equipment, activeCategory, deferredQuery]);

  const hasActiveFilters = searchQuery.trim().length > 0 || activeCategory !== 'ALL';

  function clearFilters() {
    setSearchQuery('');
    setSelectedCategory('ALL');
  }

  return (
    <section id="catalog" className="scroll-mt-24" aria-labelledby="catalog-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="catalog-heading"
            className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
          >
            Equipment catalog
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {isCustodian
              ? 'Register items and monitor live availability.'
              : 'Reserve equipment for your next lab session.'}
          </p>
        </div>

        {isCustodian ? (
          <button type="button" onClick={onRegister} className="btn-primary px-3.5 py-2 text-xs">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Register equipment
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <label htmlFor="equipment-search" className="sr-only">
            Search equipment
          </label>
          <input
            id="equipment-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search equipment…"
            className="field-input py-2 pl-9 pr-9"
            autoComplete="off"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="relative sm:w-48">
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={activeCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="field-input appearance-none py-2 pr-9"
          >
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-slate-500">
        <p aria-live="polite">
          Showing {filteredEquipment.length} of {equipment.length} items
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-emerald-700 transition hover:text-emerald-800"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        {loading ? (
          <CatalogSkeleton />
        ) : filteredEquipment.length === 0 ? (
          <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              {equipment.length === 0 ? (
                <PackageOpen className="h-5 w-5" aria-hidden="true" />
              ) : (
                <SearchX className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {equipment.length === 0 ? 'No equipment registered yet' : 'No matching equipment'}
            </h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              {equipment.length === 0
                ? isCustodian
                  ? 'Register the first laboratory item to start accepting reservations.'
                  : 'The catalog is empty. Ask a laboratory custodian to register equipment first.'
                : 'Try a different keyword or category, or clear the filters to see the full catalog.'}
            </p>
            {equipment.length === 0 && isCustodian ? (
              <button type="button" onClick={onRegister} className="btn-primary mt-4 px-3.5 py-2 text-xs">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Register equipment
              </button>
            ) : null}
            {hasActiveFilters && equipment.length > 0 ? (
              <button type="button" onClick={clearFilters} className="btn-secondary mt-4 px-3.5 py-2 text-xs">
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredEquipment.map((item) => {
              const isOutOfStock = item.available_qty <= 0;
              const availabilityPercent =
                item.total_qty > 0
                  ? Math.round((item.available_qty / item.total_qty) * 100)
                  : 0;
              const isLowStock =
                !isOutOfStock && item.available_qty <= Math.max(1, Math.floor(item.total_qty * 0.3));

              return (
                <article
                  key={item.id}
                  className="card flex flex-col p-4 transition hover:border-slate-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium text-slate-500">
                      {item.item_code}
                    </span>
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600">
                        <span className="status-dot bg-red-500" />
                        Out of stock
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-slate-900">
                    {item.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">{item.category}</p>

                  <div className="mt-auto pt-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Available</span>
                      <span className="font-medium text-slate-700 tabular-nums">
                        {item.available_qty} of {item.total_qty}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
                      role="progressbar"
                      aria-label={`${item.name} availability`}
                      aria-valuemin={0}
                      aria-valuemax={item.total_qty}
                      aria-valuenow={item.available_qty}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOutOfStock
                            ? 'bg-red-400'
                            : isLowStock
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${availabilityPercent}%` }}
                      />
                    </div>

                    {!isCustodian ? (
                      <button
                        type="button"
                        onClick={() => onReserve(item)}
                        disabled={isOutOfStock}
                        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500"
                        aria-label={`Reserve ${item.name}`}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        {isOutOfStock ? 'Unavailable' : 'Reserve'}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
