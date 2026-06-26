# Product Page Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Products page's brand chips + inline category dropdown with four consistent, searchable **Brand · Category · Gender · Supplier** filters, and wire Gender + Supplier through the product query.

**Architecture:** Reuse the existing `src/components/ui/DropdownSelect.tsx` (already a searchable `{value,label}` dropdown with auto search box and robust outside-click handling) by adding a visual `variant="pill"` so it matches the filter row's pill aesthetic. The `useProducts` hook gains two new positional filter params. `Products.tsx` swaps its bespoke chip/dropdown markup for four `DropdownSelect` instances.

**Tech Stack:** Vite + React 18 + TypeScript, Dexie (`dexie-react-hooks` `useLiveQuery`), lucide-react icons. No automated test runner is configured — verification is `npx tsc --noEmit`, `npm run lint`, and manual behavioral checks in the running app (`npm run dev`).

## Global Constraints

- No database/schema changes — all data (`brand`, `category`, `gender`, `batches[].supplier_id`) is already cached locally in Dexie as `ProductWithBatches`.
- Filters combine with **AND** semantics (each narrows the running Dexie collection).
- Any filter change resets pagination to page 1 (existing pattern: `setPage(1)` in each handler).
- `brand` and `gender` are read via `(p as any).brand` / `(p as any).gender` because the cached row type doesn't surface them — keep this existing pattern.
- Do not modify existing `DropdownSelect` call sites' behavior: the new `variant` prop defaults to `'box'` (current look).
- Theme tokens to use for the pill variant (copied from current chip styling): active → border `var(--accent)`, background `var(--accent-soft)`, text `var(--accent-ink)`, `fontWeight: 600`; idle → border `var(--line)`, background `transparent`, text `var(--ink-2)`, `fontWeight: 400`; pill metrics → `height: 28`, `borderRadius: 999`, `padding: '0 10px 0 11px'`, `fontSize: 12.5`.

---

## File Structure

- **Modify** `src/components/ui/DropdownSelect.tsx` — add `variant?: 'box' | 'pill'` prop and pill trigger styling. (Task 1)
- **Modify** `src/hooks/useProducts.ts` — add `genderFilter` + `supplierFilter` params, filter blocks, fast-path guard, deps array. (Task 2)
- **Modify** `src/components/Products.tsx` — add gender filter state + `allGenders` memo, replace brand chips + inline `FilterDropdown` with four `DropdownSelect variant="pill"` instances, remove the now-unused inline `FilterDropdown` component, pass new params to `useProducts`. (Task 3)

---

### Task 1: Add `pill` variant to `DropdownSelect`

**Files:**
- Modify: `src/components/ui/DropdownSelect.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DropdownSelect` accepts `variant?: 'box' | 'pill'` (default `'box'`). In `'pill'` mode the trigger renders as a rounded pill; when `value` is non-empty it shows the accent "active" styling. The options panel/search behavior is unchanged.

- [ ] **Step 1: Add `variant` to the props interface**

In `DropdownSelectProps` (around line 9), add the prop:

```ts
interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  searchThreshold?: number; // show search box when option count >= this (default 6)
  variant?: 'box' | 'pill'; // 'box' = form-input style (default), 'pill' = filter pill
}
```

- [ ] **Step 2: Destructure `variant` in the component signature**

Update the function signature (around line 18):

```ts
export function DropdownSelect({ value, onChange, options, placeholder = 'Select…', disabled = false, style, searchThreshold = 6, variant = 'box' }: DropdownSelectProps) {
```

- [ ] **Step 3: Compute the pill flag and branch the trigger style**

Immediately after the existing `const showSearch = options.length >= searchThreshold;` line, add:

```ts
  const isPill = variant === 'pill';
  const isActive = isPill && value !== '';
```

Then replace the trigger `<button>`'s `style={{ ... }}` object (the one starting `width: '100%', height: 36, ...`) with a variant-aware version:

```tsx
        style={isPill ? {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 5,
          height: 28,
          padding: '0 10px 0 11px',
          border: `1px solid ${isActive ? 'var(--accent)' : open ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 999,
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          color: isActive ? 'var(--accent-ink)' : 'var(--ink-2)',
          fontSize: 12.5,
          fontWeight: isActive ? 600 : 400,
          cursor: disabled ? 'not-allowed' : 'default',
          whiteSpace: 'nowrap',
          transition: 'all .1s',
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
        } : {
          width: '100%',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '0 10px',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 8,
          background: disabled ? 'var(--panel-2)' : 'var(--panel)',
          color: value ? 'var(--ink)' : 'var(--muted)',
          fontSize: 13,
          fontWeight: value ? 500 : 400,
          cursor: disabled ? 'not-allowed' : 'default',
          textAlign: 'left',
          transition: 'border-color .1s',
          outline: 'none',
          opacity: disabled ? 0.6 : 1,
        }}
```

- [ ] **Step 4: Make the chevron color follow the active state in pill mode**

Update the `<ChevronDown>` inside the trigger so the pill's active text color carries to the icon. Replace its `style` with:

```tsx
        <ChevronDown
          size={isPill ? 11 : 14}
          style={{ flexShrink: 0, color: isActive ? 'var(--accent-ink)' : 'var(--muted)', opacity: isPill ? 0.7 : 1, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
```

- [ ] **Step 5: Constrain the label so the pill hugs its content**

The trigger's label `<span>` currently has `flex: 1` which is correct for box mode but stretches a pill. Make it conditional:

```tsx
        <span style={{ flex: isPill ? '0 1 auto' : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel || placeholder}
        </span>
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Existing `DropdownSelect` call sites are unaffected because `variant` defaults to `'box'`.)

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/DropdownSelect.tsx
git commit -m "feat(ui): add pill variant to DropdownSelect for filter pills"
```

---

### Task 2: Add gender + supplier filtering to `useProducts`

**Files:**
- Modify: `src/hooks/useProducts.ts`

**Interfaces:**
- Consumes: each cached product is `ProductWithBatches` with `batches: ProductBatch[]` (each `ProductBatch` has `supplier_id: string | null`) and string fields `gender`, `brand`.
- Produces: `useProducts(page, pageSize, searchQuery, searchType, stockFilter, brandFilter, categoryFilter, genderFilter, supplierFilter)` — two new trailing positional params, both `string`, both defaulting to `''`. Empty string means "no filter".

- [ ] **Step 1: Add the two params to the signature**

In `useProducts` (signature around lines 16–23), append the two params after `categoryFilter`:

```ts
export function useProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery: string = '',
  searchType: SearchType = 'all',
  stockFilter: StockFilter = 'all',
  brandFilter: string = '',
  categoryFilter: string = '',
  genderFilter: string = '',
  supplierFilter: string = ''
) {
```

- [ ] **Step 2: Add the gender + supplier filter blocks**

Immediately after the existing category filter block:

```ts
      // Apply category filter
      if (categoryFilter) {
        collection = collection.filter(p => p.category === categoryFilter);
      }
```

insert:

```ts
      // Apply gender filter
      if (genderFilter) {
        collection = collection.filter(p => (p as any).gender === genderFilter);
      }

      // Apply supplier filter — product matches if ANY of its batches is from the supplier
      if (supplierFilter) {
        collection = collection.filter(p => (p.batches || []).some(b => b.supplier_id === supplierFilter));
      }
```

- [ ] **Step 3: Update the no-filter fast-path guard**

Find the optimized-path condition (around line 175):

```ts
      if (!searchQuery.trim() && stockFilter === 'all' && !brandFilter && !categoryFilter) {
```

Replace with:

```ts
      if (!searchQuery.trim() && stockFilter === 'all' && !brandFilter && !categoryFilter && !genderFilter && !supplierFilter) {
```

- [ ] **Step 4: Update the `useLiveQuery` dependency array**

Find the deps array (around line 195):

```ts
  }, [page, pageSize, searchQuery, searchType, stockFilter, brandFilter, categoryFilter]);
```

Replace with:

```ts
  }, [page, pageSize, searchQuery, searchType, stockFilter, brandFilter, categoryFilter, genderFilter, supplierFilter]);
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Callers that don't pass the new args still compile because both default to `''`.)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useProducts.ts
git commit -m "feat(products): add gender and supplier filters to useProducts"
```

---

### Task 3: Wire the four searchable pill filters into `Products.tsx`

**Files:**
- Modify: `src/components/Products.tsx`

**Interfaces:**
- Consumes: `DropdownSelect` with `variant="pill"` (Task 1); `useProducts(..., genderFilter, supplierFilter)` (Task 2). `suppliers` state already exists (loaded via `loadSuppliers()` → `supplierService.getActiveSuppliers()`), each supplier has `{ id: string, name: string }`.
- Produces: filter row renders Brand · Category · Gender · Supplier as searchable pill dropdowns plus the existing stock pills.

- [ ] **Step 1: Import `DropdownSelect`**

The `ui` barrel already exports `DropdownSelect`. Update the existing `ui` import line (around line 18) to include it:

```ts
import { Modal, SearchBar, LoadingSpinner, EmptyState, Pagination, DropdownSelect } from './ui';
```

- [ ] **Step 2: Add gender filter state**

After the `categoryFilter` state (around line 110):

```ts
  const [categoryFilter, setCategoryFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
```

- [ ] **Step 3: Pass the new filters to `useProducts`**

Replace the hook call (around line 112):

```ts
  const { products, loading, refetch, totalPages } = useProducts(page, pageSize, debouncedSearch, searchType, stockFilter, brandFilter, categoryFilter, genderFilter, supplierFilter);
```

- [ ] **Step 4: Add an `allGenders` memo**

After the existing `allCategories` `useLiveQuery` memo (around line 123), add:

```ts
  const allGenders = useLiveQuery(async () => {
    const all = await db.products.toArray();
    const genders = [...new Set(all.map(p => (p as any).gender).filter(Boolean))].sort();
    return genders as string[];
  }, []) ?? [];
```

- [ ] **Step 5: Replace the filter-row markup (brand chips + divider + inline category dropdown) with four pill dropdowns**

In the "Row 2" block, replace everything from the `{/* Brand chips */}` comment through the inline category `{allCategories.length > 0 && ( <FilterDropdown ... /> )}` block (i.e. brand chips, the divider, and the category `FilterDropdown`) — leaving the stock-pill block that follows it intact — with:

```tsx
          {/* Brand */}
          {allBrands.length > 0 && (
            <DropdownSelect
              variant="pill"
              value={brandFilter}
              onChange={v => { setPage(1); setBrandFilter(v); }}
              options={[{ value: '', label: 'All brands' }, ...allBrands.map(b => ({ value: b, label: b }))]}
              placeholder="Brand"
            />
          )}

          {/* Category */}
          {allCategories.length > 0 && (
            <DropdownSelect
              variant="pill"
              value={categoryFilter}
              onChange={v => { setPage(1); setCategoryFilter(v); }}
              options={[{ value: '', label: 'All categories' }, ...allCategories.map(c => ({ value: c, label: c }))]}
              placeholder="Category"
            />
          )}

          {/* Gender */}
          {allGenders.length > 0 && (
            <DropdownSelect
              variant="pill"
              value={genderFilter}
              onChange={v => { setPage(1); setGenderFilter(v); }}
              options={[{ value: '', label: 'All genders' }, ...allGenders.map(g => ({ value: g, label: g }))]}
              placeholder="Gender"
            />
          )}

          {/* Supplier */}
          {suppliers.length > 0 && (
            <DropdownSelect
              variant="pill"
              value={supplierFilter}
              onChange={v => { setPage(1); setSupplierFilter(v); }}
              options={[{ value: '', label: 'All suppliers' }, ...suppliers.map((s: any) => ({ value: s.id, label: s.name }))]}
              placeholder="Supplier"
            />
          )}

          {/* Divider before stock pills */}
          <div style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 2px', flexShrink: 0 }} />

```

- [ ] **Step 6: Remove the now-unused inline `FilterDropdown` component**

The inline `FilterDropdown` function (defined near the top of the file, around lines 25–94, including its closing brace) is no longer referenced. Delete the entire `function FilterDropdown(...) { ... }` definition.

- [ ] **Step 7: Remove the now-unused `ChevronDown` import if orphaned**

`ChevronDown` was imported for the inline `FilterDropdown`. Check whether it's still used elsewhere in `Products.tsx`:

Run: `grep -n "ChevronDown" src/components/Products.tsx`
- If the only remaining hit is the import line, remove `ChevronDown` from the `lucide-react` import (line 4: `import { Plus, Upload, Download, PackageOpen, ChevronDown } from 'lucide-react';` → drop `ChevronDown`).
- If `ChevronDown` is still used elsewhere, leave the import as-is.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no "unused variable" warnings for `FilterDropdown` or `ChevronDown`.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10: Manual behavioral verification**

Run `npm run dev`, open the Products page, and confirm:
1. Brand, Category, Gender, Supplier each render as pills; clicking opens a popover.
2. Long lists (≥ 6 options) show the in-popover search box; typing filters the options.
3. Selecting a value narrows the product list; the pill shows the accent "active" style and the selected label.
4. Selecting "All …" clears that filter and restores the broader list.
5. Two filters together (e.g. Brand + Gender) combine with AND.
6. Supplier filter shows a product when any of its batches is from that supplier.
7. Clearing every filter (and empty search) returns the full catalog.
8. Changing any filter resets to page 1.

- [ ] **Step 11: Commit**

```bash
git add src/components/Products.tsx
git commit -m "feat(products): unified searchable Brand/Category/Gender/Supplier filters"
```

---

## Notes on spec deviation

The approved spec called for a **new** `SearchableDropdown` component. During planning we found `src/components/ui/DropdownSelect.tsx` already implements searchable-dropdown behavior (option `{value,label}` model, auto search box, hardened outside-click handling). Reusing it via a `variant="pill"` prop is DRY-er and lower-risk than a parallel component, and produces the same UX the spec describes. This is the only deviation; all spec requirements (Brand/Category/Gender/Supplier as searchable pills, AND semantics, no schema change, supplier-via-batches matching) are preserved.
