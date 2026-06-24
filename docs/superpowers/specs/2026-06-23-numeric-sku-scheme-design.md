# Numeric SKU Scheme — Design

**Date:** 2026-06-23
**Status:** Approved (design); pending implementation plan

## Problem

The current auto-generated SKUs are alphanumeric with dashes (e.g. `NIK-SHO-001`,
built from brand + category in `ProductService.generateNextSku()`). When printed at
38mm label width, an ~11-character alphanumeric value produces a long CODE128 barcode
whose narrow bars shrink to ~0.23mm at the XP-365B's 203dpi head — below the ~0.25–0.33mm
reliable minimum. Combined with the 1-bit threshold pass in `BarcodeGenerator.tsx`, this
makes labels scan intermittently.

A **numeric** SKU is dramatically more compact in CODE128 because an all-digit value
triggers **Code C**, which packs two digits per symbol. This roughly halves the bar count
at the same label width, widening each bar and fixing the scan reliability.

## Goal

Switch the **auto-generated** SKU scheme for **new** products/variants to pure numeric,
optimized for compact, reliably-scannable CODE128 barcodes. Do not disturb existing
products or their printed labels.

## Format

```
Product base number :  6 digits, 100000 – 999999          e.g. 100042
Variant SKU         :  base + 2-digit suffix, concatenated, no separator
                       100042 → 10004201, 10004202, … 10004299
```

- **Variant SKU is the scannable/printed identifier.** The codebase only ever matches
  `variant.sku` on scan (`ProductRepository.findByBarcode` searches `product_variants.sku`;
  `POS.tsx` matches `v.sku === barcode`). It is always **8 pure digits** → CODE128 Code C
  → ~4 symbols of bars, roughly half the width of today's labels.
- **Product base (`product.sku`)** is the human-facing/display number and the seed for
  variant numbers. It is never scanned on its own.
- Fixed 6-digit width starting at `100000`: constant length, no leading-zero ambiguity.
- Capacity: 900,000 products × up to 99 variants each.
- Even total digit count (8) packs optimally in Code C.

## Allocation

### Product base number
Replace the body of `ProductService.generateNextSku()` (currently builds `BRAND-CAT-NNN`):

1. Query existing SKUs that are exactly 6 digits (e.g. regex `^[0-9]{6}$`), ignoring the
   legacy alphanumeric ones.
2. Take the max, add 1. If none exist yet, start at `100000`.
3. Keep the signature `generateNextSku(brand, category)` unchanged — the args are now
   ignored, so existing callers (`AddProductPage.tsx`) need no change to their call sites.

### Variant suffix
Variants are numbered `01, 02, 03…` by their row order within the product:

```ts
`${base}${String(i + 1).padStart(2, '0')}`
```

This replaces the two current spots that append size/color with dashes:
- `emptyRow()` — `AddProductPage.tsx:49` (currently `` `${parentSku}-${index + 1}` ``)
- the SKU rebuild effect — `AddProductPage.tsx:105` (currently
  `[sku, r.size, r.color]…join('-')`)

The `${info.sku}-${Date.now()}` fallbacks at `AddProductPage.tsx:168` and `:197` should be
updated to the numeric suffix form for consistency.

### Concurrency
The existing generator already uses a "scan max + 1" approach with an inherent race if two
products are created at the same instant. This is a single-store POS with one or few
terminals, so we keep the same simple approach rather than introduce a DB sequence/counter
table — identical risk profile to today, no new infrastructure.

## Edge cases & invariants

- **Legacy products untouched.** Existing alphanumeric SKUs (`NIK-SHO-001`, etc.) keep
  working. The new generator only emits numeric; the two formats coexist. Already-printed
  labels still scan.
- **Manual override preserved.** Users may still type a custom SKU; validation only checks
  non-empty (`ProductService.ts:333`). Numeric is just the auto-generated default.
- **Single-variant products** get one variant with suffix `01` (e.g. `10004201`),
  consistent with multi-variant products.
- **>99 variants per product** is unsupported by the 2-digit suffix — documented known cap;
  no real product needs it.
- **Minimum scan length.** POS finalizes a scan only when the buffer length > 3
  (`POS.tsx:229`). 8-digit variant SKUs clear this comfortably.
- **Treat SKU as a string everywhere.** Never `parseInt` the stored SKU (would drop leading
  zeros); it already lives in a TEXT column (`database.types.ts`).

## No-change areas

- **Barcode rendering** (`BarcodeGenerator.tsx`): no change. JsBarcode auto-selects Code C
  for even-length digit strings, so the compactness is free.
- **Scan/lookup path** (`findByBarcode`, POS scan matching): no change — already exact
  string match.
- **DB schema**: no change — `sku` is already TEXT.
- **Brand/category**: no longer encoded in the SKU, but already stored as their own product
  fields, so no information is lost.

## Touchpoints summary

| File | Change |
|------|--------|
| `src/services/ProductService.ts` (`generateNextSku`, ~L341) | Emit 6-digit numeric base; query max `^[0-9]{6}$`, start at 100000 |
| `src/components/products/AddProductPage.tsx` (`emptyRow` L49) | Variant SKU = base + 2-digit suffix |
| `src/components/products/AddProductPage.tsx` (rebuild effect L105) | Same numeric suffix; drop size/color/dash construction |
| `src/components/products/AddProductPage.tsx` (L168, L197 fallbacks) | Numeric suffix form |

## Out of scope

- Renumbering / migrating existing alphanumeric products (explicitly deferred; may be a
  separate task later).
- Changes to barcode print tuning beyond what the numeric value provides for free.
