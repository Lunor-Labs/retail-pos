# Barcode Sticker Print — 38×25mm Design

**Date:** 2026-06-06
**Status:** Approved

## Problem

The existing `BarcodeGenerator` component uses `window.print()` with generic `@media print` CSS that has no fixed page size. When printing to a 38×25mm thermal label printer, the sticker content overflows because the layout is sized for a large page.

## Goal

Rework the barcode print layout so that all content (product name, barcode, price, encoded cost/supplier/date) fits cleanly within a 38×25mm label sticker. Add a quantity input so users can print multiple copies in a single print job.

## Approach

CSS `@page` fix with quantity rendering — update `BarcodeGenerator.tsx` only. No new dependencies.

## Design

### Sticker Layout (38mm × 25mm)

```
┌──────────────────────────────────────┐  38mm
│  Product Name (7pt bold, truncated)  │  ~3.5mm
│  ████████████████████████████████    │
│  ████  Barcode SVG (CODE128)  ████   │  ~11mm
│  ████████████████████████████████    │
│  LKR 1,250.00              (8pt)     │  ~3mm
│  Supplier · 2024-01 · A3B  (6pt)    │  ~3mm
└──────────────────────────────────────┘  ~25mm
```

### Print CSS

- `@page { size: 38mm 25mm; margin: 0; }`
- `.barcode-print`: `width: 38mm; height: 25mm; padding: 1mm; box-sizing: border-box; overflow: hidden; page-break-after: always`
- Product name: `font-size: 7pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0 0 1px`
- Barcode SVG: `width: 100%; height: auto; max-height: 28pt; display: block`
- Price: `font-size: 8pt; font-weight: bold; margin: 1px 0 0`
- Supplier/date/encoded cost line: `font-size: 6pt; margin: 0`

### JsBarcode Options (for print)

```ts
{ format: 'CODE128', width: 1.2, height: 28, displayValue: true, fontSize: 8, margin: 2 }
```

The screen preview can keep the existing larger options; only the print CSS constrains the rendered size via `max-height`.

### Quantity Input

- Number input added to the modal toolbar, to the left of the Print button
- Label: `Qty`; default `1`; min `1`; max `100`
- Hidden during print (`print:hidden`)
- When `qty > 1`, the print area renders `qty` copies of the active `SingleBarcode` (product tab or all variants)
- Each copy separated by `page-break-after: always`

### State Changes in `BarcodeGenerator`

Add `const [qty, setQty] = useState(1)` alongside existing `tab` state.

The render section wraps the existing single-sticker render in `Array.from({ length: qty })` for the print area.

## Out of Scope

- Custom sticker dimensions (other than 38×25mm)
- Print-preview thumbnail
- Grid layout (multiple stickers per row on a sheet)
