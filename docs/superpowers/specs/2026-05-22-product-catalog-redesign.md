# Product Catalog Redesign — Design Spec (Sub-project 1)

**Date:** 2026-05-22
**Scope:** Data layer fix + Add/Edit Product UX + Product list improvements
**Follows:** POS improvements (Sub-project 2) depend on this being complete first

---

## Context & Problems Being Solved

1. **Stock shows as zero for variant products.** `ProductRepository.findAllWithStock()` groups batches by `product_id ?? variant_id`, but `product_batches.variant_id` is the only column (non-nullable per DB schema). No batch ever matches a product ID, so every variant product shows `total_stock: 0`.

2. **Add Product is a multi-step flow.** Adding one product with 4 variants requires: add product modal → find in table → open details → add variant (×4) → add stock batch per variant. This is 10+ steps per product — unworkable for initial catalog onboarding.

3. **Edit product is split across two views.** Product info in a modal, variants and stock in a separate details panel. Staff have to navigate between them.

4. **Product list is low-information.** No brand/category visible at a glance. Stock counts are wrong (bug above). No quick restock shortcut.

---

## Decisions

- **Every product always has at least one variant.** Flat products (no size/colour) get a single "Default" variant auto-created. All `product_batches` link exclusively to `variant_id` — no `product_id` path. One data model, no special-casing in code.
- **Pricing set at product level, overridable per variant.** Default cost/markup/selling price applies to all variant rows. Staff can unlock a specific row to override its price.
- **Add Product is a full-page view, not a modal.** Replaces the current `ProductForm` modal. Returns to product list on Save or Cancel.
- **Product list stays flat.** Better search (brand + variant barcode), more info per row, `+Stock` shortcut.

---

## Architecture

### Data Flow

```
products
  └── product_variants (product_id FK)
        └── product_batches (variant_id FK)
```

`product.total_stock = sum of all variant.total_stock`
`product.base_price = min selling_price across all variant batches`

### New / Changed Files

| File | Change |
|------|--------|
| `src/repositories/ProductRepository.ts` | Fix `findAllWithStock()` — join variants then batches, sum correctly |
| `src/services/ProductService.ts` | Add `createProductWithVariants()`, `updateProductWithVariants()` |
| `src/hooks/useProducts.ts` | Sync correct `total_stock` and `base_price` to IndexedDB |
| `src/types/index.ts` | Add `ProductWithVariants` type; update `ProductWithBatches` |
| `src/components/Products.tsx` | Replace modal with full-page Add/Edit view routing |
| `src/components/products/AddProductPage.tsx` | New — full-page add/edit form |
| `src/components/products/VariantTableRow.tsx` | New — single editable/display variant row |
| `src/components/products/ProductTable.tsx` | Show brand, correct stock, base price, +Stock button |

---

## Section 1 — Data Layer Fix

### `ProductRepository.findAllWithStock()`

**Current (broken):**
```
fetch all products
fetch all batches (grouped by product_id ?? variant_id)
→ no match because batches only have variant_id
→ every product gets total_stock: 0
```

**Fixed:**
```
fetch all products
fetch all variants (grouped by product_id)
fetch all batches (grouped by variant_id)
→ variant.total_stock = sum of its batches' current_quantity
→ product.total_stock = sum of all its variants' total_stock
→ product.base_price = min selling_price across all variant batches
```

### New Type

```typescript
// src/types/index.ts
export interface ProductWithVariants extends Product {
  variants: VariantWithStock[];
  total_stock: number;
  base_price: number; // lowest selling price across all variant batches
}
```

`ProductWithBatches` (used by POS IndexedDB) gains `base_price: number` field so the product grid can show the correct starting price without fetching variants.

### `ProductService.createProductWithVariants()`

Accepts:
```typescript
{
  product: ProductFormData,        // name, brand, category, etc.
  variants: VariantRowData[],      // size, color, sku, barcode, reorder_level
  defaultPricing: {
    supplier_id: string,
    cost_price: number,
    markup_percentage: number,
    selling_price: number,
  },
  variantPriceOverrides: Map<number, number>, // row index → selling_price override
}
```

Steps (atomic — all succeed or all fail):
1. Create `products` row
2. For each variant row: create `product_variants` row
3. For each variant row with `qty > 0`: create `product_batches` row linked to variant

### Flat Products (no size/colour)

When staff submit a variant row with empty size and empty colour, the system creates:
```
product_variants: { size: null, color: null, sku: <parent_sku>, barcode: null }
```
This variant is the "Default" variant. In the POS, single-variant products skip the picker and add directly to cart.

---

## Section 2 — Add Product Page

### Route / Navigation

`Products.tsx` manages a local view state:
```typescript
type ProductsView = 'list' | 'add' | 'edit'
```
When `view === 'add'` or `view === 'edit'`, renders `<AddProductPage>` instead of the product table. No modal involved.

### `AddProductPage` Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Products      Add Product                              │
├──────────────────────────────────────────────────────────┤
│ PRODUCT INFO                                             │
│ Brand [        ]  Name [                               ] │
│ Category [     ]  Gender [    ]  Material [            ] │
│ Unit [piece ▾]    Image URL [                          ] │
├──────────────────────────────────────────────────────────┤
│ DEFAULT PRICING                                          │
│ Supplier [              ]  Cost [      ]  Markup [   ]%  │
│                                  → Selling: LKR 0        │
├──────────────────────────────────────────────────────────┤
│ VARIANTS                                            [?]  │
│  Size   Colour   SKU            Barcode   Qty   Price    │
│ [    ] [      ] [             ] [      ] [   ] [1,800]   │
│ [    ] [      ] [             ] [      ] [   ] [1,800]   │
│ [+ Add row]                                              │
├──────────────────────────────────────────────────────────┤
│ [Cancel]                   [Save & Add Next]  [Save]     │
└──────────────────────────────────────────────────────────┘
```

### Variant Table Behaviour

- **Tab** moves to the next cell; reaching the last cell of the last row adds a new row
- **Enter** in any cell adds a new row below
- **SKU auto-generation:** `{parentSku}-{size}-{colour}` with spaces stripped, uppercased. Editable. Regenerates only if staff haven't manually edited it.
- **Price column:** shows inherited selling price dimmed in grey. Clicking unlocks an override input for that row only. A small `↩` icon resets the override back to the default.
- **Delete row:** `×` button on the right of each row. Cannot delete the last row.
- **Flat product:** first row pre-filled with empty size/colour. Staff enter only Qty and Price.
- **Barcode:** staff can click the barcode cell and scan with a handheld scanner — the field captures the scan.

### Save & Add Next

On click:
1. Validate and save current product + variants
2. Clear: Name, Image URL, all variant rows (reset to 1 empty row)
3. Keep: Brand, Supplier, Cost, Markup, Category, Gender, Material
4. Move focus to the Name field
5. Show success toast: "Trouser saved — 5 variants added"

### Validation

- Product Name: required
- At least 1 variant row
- Each variant row: SKU required (auto-generated is acceptable), Qty ≥ 0, Price > 0
- Duplicate SKUs within the form: show inline error on the conflicting row
- SKU already exists in DB: show inline error after submit attempt

---

## Section 3 — Edit Product Flow

Same `AddProductPage` component, `mode="edit"`. Pre-filled from `ProductWithVariants`.

### Differences from Add mode

- **Existing variant rows:** Qty column shows `{n} in stock` (read-only). Staff cannot set qty directly — stock only changes through sales and stock intake.
- **Add Stock button (`+`)** on each existing variant row. Opens an inline stock intake form below that row:
  ```
  Supplier [        ]  Qty [   ]  Cost [      ]  Markup [  ]%
  Batch No (auto)                          [ Add Batch ]  [ ✕ ]
  ```
  On submit: creates a new `product_batches` row for this variant. Refreshes the row's stock count.
- **New variant rows** (added by staff in edit mode): behave like add mode — have an editable Qty field that creates a batch on save.
- **Deactivate variant:** a `⋯` menu on each existing row with "Deactivate" option (sets `variant.active = false`). Only available if variant has 0 stock.

---

## Section 4 — Product List

### Row Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [img]  Trouser                          12 variants           │
│        Moose · Pants · Men              23 in stock · LKR 1,800│
│        SKU: MT-001              [+ Stock]          [Edit]    │
└──────────────────────────────────────────────────────────────┘
```

- Brand, category, gender visible without opening the product
- `total_stock` = correctly summed from all variants
- `LKR 1,800` = `base_price` (lowest variant selling price)
- **`+Stock` button** opens a quick modal: staff pick a variant from a dropdown (showing current stock per variant), then enter Supplier, Qty, Cost, Markup — same inline intake form as in the edit page. Saves a new batch without navigating away from the list.
- **`Edit` button** navigates to the edit page

### Search Improvements

Search in `useProducts` extended to match:
- Product `name` (existing)
- Product `sku` (existing)
- Product `brand` (new)
- Variant `barcode` — scanning a barcode into the search bar finds the parent product (new; requires syncing variant barcodes into IndexedDB alongside products)

---

## What Is NOT Changed

- POS product grid and barcode scanning — covered in Sub-project 2
- Returns, Purchase Orders, Sales History — untouched
- CSV importer — left as-is for now (variant support in importer is a future enhancement)
- Dashboard stock counts — will automatically fix once data layer fix is in place
