# Barcode Batch Selection Design

**Date:** 2026-06-07
**Status:** Approved

## Problem

The barcode print modal always uses `batches[0]` (the first batch) for price, cost, supplier, and date. Products can have multiple batches with different prices and costs, so there is no way to print stickers for a specific batch or for all batches at once.

## Goal

Add a batch checklist to the barcode print modal so users can tick which batches to include. Printing generates `qty` stickers per selected batch, each showing that batch's specific price, encoded cost, supplier, and date. Works on both the product tab and the per-variant tab.

## Data Interface

### New `BarcodeBatch` type (in `BarcodeGenerator.tsx`)

```ts
export interface BarcodeBatch {
  id: string;
  batchNumber?: string;
  sellingPrice: number;
  encodedCost?: string;   // pre-encoded by caller; omit if cost code not configured
  supplierName?: string;
  date?: string;
}
```

Cost encoding stays in `Products.tsx` (where `encodeCost` and `costCodeConfigured` already live). The component receives a ready-to-display string.

### `BarcodeGeneratorProps` change

Add:
```ts
batches?: BarcodeBatch[];  // all batches for the product tab
```

Existing `price`, `encodedCost`, `supplierName`, `date` props are kept as fallback when `batches` is not provided.

### `BarcodeVariant` change

Add:
```ts
batches?: BarcodeBatch[];  // all batches for this specific variant
```

Existing per-variant `price`, `encodedCost`, `supplierName`, `date` fields kept as fallback.

### `Products.tsx` changes

- Map `barcodeProduct.batches` → `BarcodeBatch[]` and pass as `batches` prop.
- For each variant in `barcodeVariants`, map its batches to `BarcodeBatch[]` and include in the `BarcodeVariant` object.
- `fmtBatchDate` and `encodeCost` are called in `Products.tsx` as before.

## UI Layout

### Product Tab

```
[ Product | Per Variant ]          Qty: [ 1 ]  [ Print ]
─────────────────────────────────────────────────────────
Batches
[✓] 2024-01-15  ·  Supplier ABC  ·  LKR 1,250.00
[✓] 2024-03-20  ·  Supplier XYZ  ·  LKR 1,350.00
─────────────────────────────────────────────────────────
[Sticker preview — first checked batch]
```

- Batch checklist is hidden when there is only one batch (no change in behaviour for single-batch products).
- All batches are checked by default when the modal opens.
- Sticker preview reflects the first checked batch's data.
- Each checklist row shows: date · supplier name · LKR price.

### Variants Tab

Each variant card shows its own batch checklist below the sticker preview:

```
Size M
[Sticker preview — first checked batch]
Batches:  [✓] 2024-01 · LKR 1,250   [✓] 2024-03 · LKR 1,350

Size L
[Sticker preview — first checked batch]
Batches:  [✓] 2024-01 · LKR 1,100   [ ] 2024-03 · LKR 1,200
```

- Each variant's checklist is hidden when it has only one batch.
- All batches per variant are checked by default.

## State

### Product tab state (in `BarcodeGenerator`)

```ts
const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(() =>
  new Set(batches?.map(b => b.id) ?? [])
);
```

Reset to all-selected whenever `batches` prop changes.

### Variants tab state (in `BarcodeGenerator`)

```ts
const [selectedVariantBatchIds, setSelectedVariantBatchIds] = useState<Map<string, Set<string>>>(() =>
  new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
);
```

Reset whenever `variants` prop changes.

## Print Logic

### Product tab

```
for each batch in batches where id in selectedBatchIds:
  repeat qty times:
    emit sticker(batch.sellingPrice, batch.encodedCost, batch.supplierName, batch.date)
```

### Variants tab

```
for each variant in variants:
  for each batch in variant.batches where id in selectedVariantBatchIds[variant.sku]:
    repeat qty times:
      emit sticker(variant label, batch.sellingPrice, ...)
```

## Backward Compatibility

When `batches` is not provided to `BarcodeGeneratorProps`, the component falls back to the existing `price / encodedCost / supplierName / date` props and shows no checklist. This means callers that don't pass `batches` continue to work unchanged.

## Out of Scope

- Qty-per-batch (all selected batches share the same `qty` input)
- Reordering batches
- Filtering batches by date range
