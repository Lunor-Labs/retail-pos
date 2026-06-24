# Per-Variant Barcode Print Selection — Design

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan

## Problem

In the Print Barcode dialog (`src/components/BarcodeGenerator.tsx`), the **Per-Variant**
tab shows every variant at once with no way to choose which to print or how many copies.
`handlePrint` builds one sticker per selected batch for **every** variant, so clicking
Print tries to print labels for all variants. There is no per-variant selection and no
copy-count control.

The **Product** tab's batch checkboxes also default to **all selected**, so it likewise
leans toward printing everything.

## Goal

Make barcode printing **opt-in** and controllable:

- Per-Variant tab: choose which variants to print and how many copies of each.
- Product tab: keep the existing batch checkboxes but default them to **unticked**.

Nothing prints until the user deliberately selects — fixing the "prints everything"
behavior on both tabs.

## Per-Variant tab — interaction model

The tab becomes a compact list, **one row per variant**:

```
☐  M · Black     [ Jun 20 – LKR 1500 ▾ ]   [ – 0 + ]
☐  L · Black     [ Jun 10 – LKR 1400 ▾ ]   [ – 0 + ]
☑  XL · Red      (single batch)             [ – 3 + ]
                                       Total: 3 labels
[ Print 3 labels ]      ← disabled when total = 0
```

**Row anatomy:** checkbox · variant label (`size · color`, or `Default`) · batch picker
(only when >1 batch) · copies stepper.

**Checkbox ⟺ copies are linked** so they cannot contradict:
- Checking a row sets copies to **1** (if currently 0).
- Unchecking sets copies to **0**.
- Typing/stepping copies to a value > 0 auto-checks the row; setting it to 0 unchecks.
- "Selected" is defined purely as **copies > 0**. The checkbox is a convenience view of
  that state.

**Copies stepper:** `– N +` control, also directly typeable. Minimum 0, default **0**
(opt-in). Non-numeric / negative input clamps to 0.

**Batch picker:** shown only when a variant has **>1 batch**; it selects which batch's
price/date/cost/supplier prints on that variant's labels. Defaults to the variant's first
(latest) batch. Single-batch variants show the batch inline (no dropdown). Zero-batch
variants fall back to the variant-level price (existing `BarcodeVariant.price`).

**Totals & Print button:** a running **Total labels** = Σ copies is shown; the Print
button label reflects it (e.g. "Print 8 labels") and is **disabled when the total is 0**.

**Previews:** the large per-variant `SingleBarcode` previews are removed in favor of the
dense list (a product may have many variants). Rows are label-only; no mini barcode is
rendered per row.

## Print logic & state

**State** (replaces the current `selectedVariantBatchIds: Map<string, Set<string>>`):

```ts
// keyed by variant sku
type VariantPrintState = Map<string, { copies: number; batchId: string }>;
```

- `batchId` is the chosen batch for that variant (first batch's id by default; `''` when
  the variant has no batches).
- A variant is printed iff its `copies > 0`.
- Initialised from `variants` with `copies: 0` and `batchId` = first batch id (or `''`).
  Re-initialised when the `variants` prop changes (mirrors the existing effect).

**`handlePrint` (variants branch):** for each variant with `copies > 0`:
1. Resolve the chosen batch by `batchId` (or fall back to variant-level price when no
   batches).
2. Build one `StickerSpec` from it (same fields as today: value=`v.sku`,
   label=`${productName} — ${v.label}`, price, metaText from supplier/date/encodedCost).
3. Push that spec **`copies` times** into the existing `specs` array.

Everything downstream is unchanged: `specs` → `renderStickerDataURL` per entry → popup →
`window.print()`. Clicking Print yields exactly `Σ copies` labels, only for chosen variants.

## Product tab change

Keep the existing batch-checkbox UI and print path. The **only** change:

```ts
// before
useState<Set<string>>(() => new Set(batches?.map(b => b.id) ?? []))
// after
useState<Set<string>>(() => new Set())
```

So batches default to unticked. The existing "No stickers selected to print." guard already
blocks printing when nothing is chosen. No copies stepper is added here.

Side effect (acceptable): the Product-tab preview `previewBatch` becomes `undefined` by
default, so the preview shows the product-level price until a batch is ticked — consistent
with opt-in.

## Component structure

`BarcodeGenerator.tsx` is already ~480 lines. To keep it readable, extract a small
presentational component:

- **`VariantPrintRow`** — props: variant, its print state `{copies, batchId}`, and change
  handlers (`onToggle`, `onCopies`, `onBatch`). Renders checkbox + label + batch picker +
  stepper. No business logic beyond emitting changes.

The selection state, `handlePrint`, totals, and the Product-tab default change stay in
`BarcodeGenerator`.

## Out of scope

- No changes to canvas/thermal sticker rendering, the print popup, or the 38×25mm layout.
- No copies stepper on the Product tab.
- No persistence of selections between dialog opens.
- No "select all / clear all" bulk control (can be a later nicety if needed).

## Edge cases

- **No variants / single variant:** dialog shows only the Product tab (existing
  `hasVariants = variants.length > 1` gate); per-variant changes don't apply.
- **Copies typed as blank/NaN/negative:** clamp to 0 (row becomes unselected).
- **Variant with 0 batches:** no picker; uses variant-level price; still supports copies.
- **`variants` prop changes** (async load in `Products.tsx`): print state re-initialises to
  all-zero, matching the existing re-init effect.
