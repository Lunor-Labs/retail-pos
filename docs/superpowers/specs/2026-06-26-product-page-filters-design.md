# Product Page Filters — Unified Searchable Dropdowns

**Date:** 2026-06-26
**Status:** Approved, ready for implementation plan

## Problem

The Products page (`src/components/Products.tsx`) already has filtering, but the
controls are inconsistent and incomplete:

- Brand is rendered as a row of **chips**.
- Category is a custom inline **dropdown** (`FilterDropdown`).
- Stock status is a row of **pills**.
- **Gender** is a stored product field but cannot be filtered on.
- **Supplier** cannot be filtered on.

As brand/category lists grow, chips and a plain dropdown become hard to scan.
We want one consistent, searchable filter control and two additional filters.

## Goals

1. A single reusable **searchable dropdown** used for every catalog filter.
2. Filter set: **Brand · Category · Gender · Supplier** (all searchable
   dropdowns), plus the existing **stock** pills and search bar unchanged.
3. No schema/database changes — all data is already available locally in Dexie.

## Out of Scope

- Size / Color filters (variant-level) — deferred.
- Material filter — deferred.
- Price-range filter — deferred.

## Data Availability (verified)

Each product cached in Dexie is a `ProductWithBatches` and carries:

- `brand`, `category`, `gender` — plain string fields on the product row.
- `batches[]` — each batch has `supplier_id`.

So supplier filtering is fully offline: a product matches a selected supplier if
`product.batches?.some(b => b.supplier_id === supplierId)`. The supplier
**option list** (id → name) comes from the suppliers table/service (already
imported in `Products.tsx` as `supplierService`).

## Design

### 1. New component — `SearchableDropdown` (`src/components/ui/`)

Generalizes the existing inline `FilterDropdown`. Same pill-style trigger and
popover, with these additions:

- A search input at the top of the popover that filters the option list as the
  user types.
- The search input auto-shows only when the option list is long (> 7 options);
  shorter lists behave exactly like the current `FilterDropdown`.
- Options are passed as `{ label, value }` pairs so supplier can map id → name
  while brand/category/gender pass identical label/value strings.

**Props:**

```ts
interface SearchableDropdownOption { label: string; value: string; }
interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableDropdownOption[];
  placeholder: string;
  searchable?: boolean; // default: auto when options.length > 7
}
```

Behavior:
- Active state (non-empty `value`) keeps the existing accent styling.
- An "All …" / clear entry resets the filter (empty `value`).
- Closes on outside click (reuse existing pattern).

This component **replaces both** the inline `FilterDropdown` and the brand chips
in `Products.tsx`.

### 2. Filter row in `Products.tsx`

Replace the current "Row 2" (brand chips + category dropdown + stock pills) with:

`[Brand ▾] [Category ▾] [Gender ▾] [Supplier ▾]   |   [stock pills]`

- The search bar (Row 1) is unchanged.
- Stock pills are unchanged.
- Option sources:
  - **Brand / Category / Gender** — distinct, non-empty, sorted values derived
    from the loaded products (same memoization pattern as the current
    `allBrands` memo). Add `allGenders` analogous to `allBrands` / categories.
  - **Supplier** — `{ id, name }` list from `supplierService`, sorted by name.
- New state: `genderFilter`, `supplierFilter` (mirroring `brandFilter` /
  `categoryFilter`).
- Any filter change resets `page` to 1 (existing pattern).

### 3. `useProducts` hook (`src/hooks/useProducts.ts`)

Add two parameters: `genderFilter: string = ''`, `supplierFilter: string = ''`.

Add two filter blocks alongside the existing brand/category blocks:

```ts
if (genderFilter) {
  collection = collection.filter(p => (p as any).gender === genderFilter);
}
if (supplierFilter) {
  collection = collection.filter(p =>
    (p.batches || []).some(b => b.supplier_id === supplierFilter)
  );
}
```

Update the two places that enumerate "all active filters":

1. The optimized no-filter fast-path guard:
   `!searchQuery.trim() && stockFilter === 'all' && !brandFilter &&
   !categoryFilter && !genderFilter && !supplierFilter`
2. The `useLiveQuery` dependency array — add `genderFilter`, `supplierFilter`.

Filters combine with **AND** semantics (each narrows the running collection),
consistent with current behavior.

## Testing

Manual / behavioral verification:

1. Each filter alone narrows the result set correctly.
2. Filters combine with AND (e.g. Brand + Gender).
3. Clearing a filter ("All …") returns to the broader set; clearing all returns
   to the full catalog (fast path).
4. Supplier matches a product when **any** of its batches has that supplier.
5. The in-dropdown search box filters the option list and appears only for long
   lists.
6. Changing any filter resets pagination to page 1.
7. Empty / null field values are excluded from option lists and don't crash.

## Risk / Notes

- `gender` and `brand` are accessed via `(p as any)` today because the cached
  type doesn't surface them; keep that pattern for consistency.
- Supplier option list depends on `supplierService` data being loaded; handle
  the empty/loading case by simply showing no supplier options (filter hidden or
  empty) rather than erroring.
