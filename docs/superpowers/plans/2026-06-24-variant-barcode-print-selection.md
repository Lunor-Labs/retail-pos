# Per-Variant Barcode Print Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Print Barcode dialog opt-in — on the Per-Variant tab choose which variants and how many copies to print; on the Product tab default the batch checkboxes to unticked.

**Architecture:** Extract the print-spec building into a pure, unit-tested helper (`barcodePrintSpecs.ts`) and a presentational row component (`VariantPrintRow.tsx`). `BarcodeGenerator.tsx` swaps its per-variant batch-checkbox state for a `Map<sku,{copies,batchId}>` model, renders one `VariantPrintRow` per variant with a running total, and feeds the chosen variants into the unchanged canvas→popup→print pipeline.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind, `jsbarcode` for rendering. No test framework installed; pure logic is verified with a standalone `tsx` script (existing `scripts/test-*.ts` pattern). Type safety via `npm run typecheck`. UI verified by running `npm run dev`.

## Global Constraints

- **Opt-in:** per-variant copies default to **0**; nothing prints until the user selects.
- **Checkbox ⟺ copies linked:** "selected" means `copies > 0`. Checking sets copies to 1; unchecking sets 0; copies > 0 implies checked.
- **Copies clamp:** copies is a non-negative integer; blank/NaN/negative clamps to 0.
- **Per-variant batch:** one chosen batch per variant determines its label price/date/cost; picker shown only when a variant has > 1 batch; default is the first batch; 0 batches → variant-level price fallback.
- **Variant SKU is the scannable value** (`variant.sku`) — unchanged.
- **No changes** to canvas/thermal rendering (`drawSticker`, `renderStickerDataURL`, `thresholdToMonochrome`), the print popup, or the 38×25mm layout.
- **Product tab:** the only change is batch checkboxes defaulting to unticked. No copies stepper there.

---

### Task 1: Product tab — default batch checkboxes unticked

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx:292-294`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new (behavioral change only).

- [ ] **Step 1: Change the initial state**

In `src/components/BarcodeGenerator.tsx`, replace the `selectedBatchIds` initializer:

```tsx
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(
    () => new Set(batches?.map(b => b.id) ?? [])
  );
```

with:

```tsx
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(
    () => new Set<string>()
  );
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck 2>&1 | grep -i BarcodeGenerator || echo "clean"`
Expected: `clean` (no errors in BarcodeGenerator).

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open a product with multiple batches → Print Barcode → Product tab.
Expected: the **Batches** checkboxes are all **unticked**; the preview shows the product-level price; clicking Print with none ticked shows "No stickers selected to print."

- [ ] **Step 4: Commit**

```bash
git add src/components/BarcodeGenerator.tsx
git commit -m "feat: product-tab barcode batches default to unticked

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pure `buildVariantSpecs` helper + unit test

**Files:**
- Create: `src/components/barcodePrintSpecs.ts`
- Test: `scripts/test-barcode-specs.ts`

**Interfaces:**
- Consumes: `BarcodeVariant` type (type-only import from `./BarcodeGenerator`).
- Produces:
  - `interface StickerSpec { value: string; label: string; price?: number; metaText?: string; }`
  - `const metaLine: (...parts: (string | undefined)[]) => string`
  - `interface VariantPrintEntry { copies: number; batchId: string; }`
  - `function buildVariantSpecs(variants: BarcodeVariant[], state: Map<string, VariantPrintEntry>, productName: string): StickerSpec[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-barcode-specs.ts`:

```ts
import { buildVariantSpecs, VariantPrintEntry } from '../src/components/barcodePrintSpecs';

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) { console.log(`   actual   ${a}\n   expected ${e}`); failures++; }
}

const variants = [
  { sku: '10000001', label: 'M · Black', price: 1500,
    batches: [
      { id: 'b1', sellingPrice: 1500, supplierName: 'Acme', date: 'Jun 20', encodedCost: 'XY' },
      { id: 'b2', sellingPrice: 1400, supplierName: 'Acme', date: 'Jun 10' },
    ] },
  { sku: '10000002', label: 'L · Black', price: 1450, batches: [] },
  { sku: '10000003', label: 'XL · Red', price: 1600,
    batches: [{ id: 'b3', sellingPrice: 1600, date: 'Jun 18' }] },
];

// Only variants with copies > 0 print; each pushed `copies` times.
const s1 = new Map<string, VariantPrintEntry>([
  ['10000001', { copies: 2, batchId: 'b1' }],
  ['10000002', { copies: 0, batchId: '' }],   // skipped
  ['10000003', { copies: 1, batchId: 'b3' }],
]);
const r1 = buildVariantSpecs(variants as any, s1, 'Shirt');
eq('total specs = 2 + 1', r1.length, 3);
eq('first uses chosen batch b1 price + meta', r1[0],
  { value: '10000001', label: 'Shirt — M · Black', price: 1500, metaText: 'Acme · Jun 20 · XY' });
eq('copies duplicates the same spec', r1[1], r1[0]);
eq('third variant single batch b3', r1[2],
  { value: '10000003', label: 'Shirt — XL · Red', price: 1600, metaText: 'Jun 18' });

// Chosen a different batch -> that batch's price/meta.
const s2 = new Map<string, VariantPrintEntry>([['10000001', { copies: 1, batchId: 'b2' }]]);
eq('batchId b2 selects 1400 price', buildVariantSpecs(variants as any, s2, 'Shirt')[0],
  { value: '10000001', label: 'Shirt — M · Black', price: 1400, metaText: 'Acme · Jun 10' });

// No batches -> variant-level price fallback, empty meta.
const s3 = new Map<string, VariantPrintEntry>([['10000002', { copies: 1, batchId: '' }]]);
eq('no batches uses variant price', buildVariantSpecs(variants as any, s3, 'Shirt')[0],
  { value: '10000002', label: 'Shirt — L · Black', price: 1450, metaText: '' });

// Missing state entry -> not printed.
eq('absent variant prints nothing', buildVariantSpecs(variants as any, new Map(), 'Shirt').length, 0);

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll barcode-spec tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-barcode-specs.ts`
Expected: FAIL — cannot resolve `../src/components/barcodePrintSpecs`.

- [ ] **Step 3: Write the implementation**

Create `src/components/barcodePrintSpecs.ts`:

```ts
// Type-only import: erased at compile time, so this module never pulls in
// BarcodeGenerator.tsx (and its jsbarcode/DOM deps) at runtime — that keeps the
// standalone tsx test runnable under plain Node.
import type { BarcodeVariant } from './BarcodeGenerator';

/** One printable sticker: barcode value + label + optional price/meta line. */
export interface StickerSpec {
  value: string;        // barcode value (SKU)
  label: string;        // product name line
  price?: number;
  metaText?: string;    // "supplier · date · cost"
}

/** Join the non-empty parts of a sticker's meta line with " · ". */
export const metaLine = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

/** Per-variant print selection: how many copies, and which batch's price to use. */
export interface VariantPrintEntry {
  copies: number;
  batchId: string;
}

/**
 * Expand a per-variant selection into a flat list of sticker specs.
 * A variant prints only when copies > 0; its spec is pushed `copies` times.
 * The chosen batch (by id) sets price/date/cost; with no batch the variant-level
 * price is used.
 */
export function buildVariantSpecs(
  variants: BarcodeVariant[],
  state: Map<string, VariantPrintEntry>,
  productName: string,
): StickerSpec[] {
  const specs: StickerSpec[] = [];
  for (const v of variants) {
    const entry = state.get(v.sku);
    const copies = entry?.copies ?? 0;
    if (copies <= 0) continue;
    const batch = (v.batches ?? []).find(b => b.id === entry?.batchId);
    const spec: StickerSpec = batch
      ? { value: v.sku, label: `${productName} — ${v.label}`, price: batch.sellingPrice, metaText: metaLine(batch.supplierName, batch.date, batch.encodedCost) }
      : { value: v.sku, label: `${productName} — ${v.label}`, price: v.price, metaText: metaLine(v.supplierName, v.date, v.encodedCost) };
    for (let i = 0; i < copies; i++) specs.push(spec);
  }
  return specs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-barcode-specs.ts`
Expected: PASS — prints "All barcode-spec tests passed." and exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/barcodePrintSpecs.ts scripts/test-barcode-specs.ts
git commit -m "feat: pure buildVariantSpecs helper for per-variant copies

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `VariantPrintRow` presentational component

**Files:**
- Create: `src/components/VariantPrintRow.tsx`

**Interfaces:**
- Consumes: `BarcodeVariant` type (type-only import from `./BarcodeGenerator`).
- Produces:
  - `function VariantPrintRow(props: { variant: BarcodeVariant; copies: number; batchId: string; onCopies: (copies: number) => void; onBatch: (batchId: string) => void }): JSX.Element`

- [ ] **Step 1: Write the component**

Create `src/components/VariantPrintRow.tsx`:

```tsx
import type { BarcodeVariant } from './BarcodeGenerator';

interface VariantPrintRowProps {
  variant: BarcodeVariant;
  copies: number;
  batchId: string;
  onCopies: (copies: number) => void;
  onBatch: (batchId: string) => void;
}

/** Clamp arbitrary input to a non-negative integer (blank/NaN/negative -> 0). */
function clampCopies(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** One selectable row: checkbox + label + (batch picker if >1 batch) + copies stepper. */
export function VariantPrintRow({ variant, copies, batchId, onCopies, onBatch }: VariantPrintRowProps) {
  const batches = variant.batches ?? [];
  const selected = copies > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg">
      <input
        type="checkbox"
        checked={selected}
        onChange={e => onCopies(e.target.checked ? 1 : 0)}
        className="w-4 h-4 rounded shrink-0"
      />
      <span className="text-sm font-medium text-slate-800 flex-1 truncate">{variant.label}</span>

      {batches.length > 1 ? (
        <select
          value={batchId}
          onChange={e => onBatch(e.target.value)}
          className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white text-slate-700 max-w-[160px]"
        >
          {batches.map(b => (
            <option key={b.id} value={b.id}>
              {[b.date, `LKR ${b.sellingPrice.toFixed(2)}`].filter(Boolean).join(' – ')}
            </option>
          ))}
        </select>
      ) : batches.length === 1 ? (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {[batches[0].date, `LKR ${batches[0].sellingPrice.toFixed(2)}`].filter(Boolean).join(' – ')}
        </span>
      ) : null}

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onCopies(clampCopies(copies - 1))}
          className="w-7 h-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
        >–</button>
        <input
          type="number"
          min={0}
          value={copies}
          onChange={e => onCopies(clampCopies(parseInt(e.target.value, 10)))}
          className="w-12 h-7 text-center text-sm border border-slate-300 rounded"
        />
        <button
          type="button"
          onClick={() => onCopies(clampCopies(copies + 1))}
          className="w-7 h-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
        >+</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck 2>&1 | grep -i VariantPrintRow || echo "clean"`
Expected: `clean` (no errors in VariantPrintRow). It has no runtime surface on its own; it is exercised in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/VariantPrintRow.tsx
git commit -m "feat: VariantPrintRow component (checkbox + batch picker + copies stepper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Integrate per-variant selection into BarcodeGenerator

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx` (imports L1-4; remove `StickerSpec` L38-43; remove `metaLine` L188; state L295-303; refs L305-306; `handlePrint` variants branch L321-332; variants-tab JSX L425-468)

**Interfaces:**
- Consumes: `StickerSpec`, `metaLine`, `buildVariantSpecs`, `VariantPrintEntry` from `./barcodePrintSpecs` (Task 2); `VariantPrintRow` from `./VariantPrintRow` (Task 3).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Update imports**

At the top of `src/components/BarcodeGenerator.tsx`, the existing imports are:

```tsx
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Modal } from './ui';
```

Add two import lines after them:

```tsx
import { StickerSpec, metaLine, buildVariantSpecs, VariantPrintEntry } from './barcodePrintSpecs';
import { VariantPrintRow } from './VariantPrintRow';
```

- [ ] **Step 2: Remove the local `StickerSpec` (now imported)**

Delete this block (currently around L38-43):

```tsx
interface StickerSpec {
  value: string;        // barcode value (SKU)
  label: string;        // product name line
  price?: number;
  metaText?: string;    // "supplier · date · cost"
}
```

(`drawSticker`/`renderStickerDataURL` keep referencing `StickerSpec`; it now resolves to the imported type.)

- [ ] **Step 3: Remove the local `metaLine` (now imported)**

Delete this line (currently L188):

```tsx
const metaLine = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');
```

- [ ] **Step 4: Replace the per-variant state + effect, and drop the variant SVG ref**

Replace this block (currently L295-306):

```tsx
  const [selectedVariantBatchIds, setSelectedVariantBatchIds] = useState<Map<string, Set<string>>>(
    () => new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
  );

  useEffect(() => {
    setSelectedVariantBatchIds(
      new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
    );
  }, [variants]);

  const productSvgRef = useRef<SVGSVGElement | null>(null);
  const variantSvgsRef = useRef<Map<string, SVGSVGElement>>(new Map());
```

with:

```tsx
  const makeVariantState = () =>
    new Map<string, VariantPrintEntry>((variants ?? []).map(v => [v.sku, { copies: 0, batchId: v.batches?.[0]?.id ?? '' }]));
  const [variantPrint, setVariantPrint] = useState<Map<string, VariantPrintEntry>>(makeVariantState);

  useEffect(() => {
    setVariantPrint(makeVariantState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  const productSvgRef = useRef<SVGSVGElement | null>(null);

  const variantTotal = Array.from(variantPrint.values()).reduce((sum, e) => sum + e.copies, 0);

  const updateVariant = (sku: string, patch: Partial<VariantPrintEntry>) =>
    setVariantPrint(prev => {
      const next = new Map(prev);
      const cur = next.get(sku) ?? { copies: 0, batchId: '' };
      next.set(sku, { ...cur, ...patch });
      return next;
    });
```

- [ ] **Step 5: Replace the `handlePrint` variants branch**

In `handlePrint`, replace the `else` branch (currently L321-332):

```tsx
    } else {
      (variants ?? []).forEach(v => {
        if (v.batches && v.batches.length > 0) {
          const vSelected = selectedVariantBatchIds.get(v.sku) ?? new Set<string>();
          v.batches.filter(b => vSelected.has(b.id)).forEach(b =>
            specs.push({ value: v.sku, label: `${productName} — ${v.label}`, price: b.sellingPrice, metaText: metaLine(b.supplierName, b.date, b.encodedCost) })
          );
        } else {
          specs.push({ value: v.sku, label: `${productName} — ${v.label}`, price: v.price, metaText: metaLine(v.supplierName, v.date, v.encodedCost) });
        }
      });
    }
```

with:

```tsx
    } else {
      specs.push(...buildVariantSpecs(variants ?? [], variantPrint, productName));
    }
```

- [ ] **Step 6: Make the Print button reflect the total and disable at 0**

Replace the Print button (currently L388-394):

```tsx
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
```

with:

```tsx
          <button
            onClick={handlePrint}
            disabled={tab === 'variants' && hasVariants && variantTotal === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            {tab === 'variants' && hasVariants && variantTotal > 0 ? `Print ${variantTotal} labels` : 'Print'}
          </button>
```

- [ ] **Step 7: Replace the variants-tab JSX with the row list + total**

Replace the variants branch of the preview block (currently L425-468, the `) : (` … `)}` that maps `variants!.map`):

```tsx
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {variants!.map(v => {
              const vBatches = v.batches ?? [];
              const vSelected = selectedVariantBatchIds.get(v.sku) ?? new Set<string>();
              const vPreviewBatch = vBatches.find(b => vSelected.has(b.id));
              return (
                <div key={v.sku}>
                  <SingleBarcode
                    value={v.sku}
                    label={`${productName} — ${v.label}`}
                    price={vPreviewBatch ? vPreviewBatch.sellingPrice : v.price}
                    encodedCost={vPreviewBatch ? vPreviewBatch.encodedCost : v.encodedCost}
                    supplierName={vPreviewBatch ? vPreviewBatch.supplierName : v.supplierName}
                    date={vPreviewBatch ? vPreviewBatch.date : v.date}
                    onSvgReady={el => {
                      if (el) variantSvgsRef.current.set(v.sku, el);
                      else variantSvgsRef.current.delete(v.sku);
                    }}
                  />
                  {vBatches.length > 1 && (
                    <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-1 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Batches
                      </div>
                      {vBatches.map(b => batchRow(
                        b,
                        vSelected.has(b.id),
                        checked => setSelectedVariantBatchIds(prev => {
                          const next = new Map(prev);
                          const ids = new Set(next.get(v.sku) ?? []);
                          if (checked) ids.add(b.id); else ids.delete(b.id);
                          next.set(v.sku, ids);
                          return next;
                        }),
                        false,
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
```

with:

```tsx
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variants!.map(v => {
              const entry = variantPrint.get(v.sku) ?? { copies: 0, batchId: v.batches?.[0]?.id ?? '' };
              return (
                <VariantPrintRow
                  key={v.sku}
                  variant={v}
                  copies={entry.copies}
                  batchId={entry.batchId}
                  onCopies={copies => updateVariant(v.sku, { copies })}
                  onBatch={batchId => updateVariant(v.sku, { batchId })}
                />
              );
            })}
            <div className="text-right text-sm font-semibold text-slate-700 mt-1">
              Total: {variantTotal} {variantTotal === 1 ? 'label' : 'labels'}
            </div>
          </div>
        )}
```

- [ ] **Step 8: Typecheck (verifies no dead refs / unused imports remain)**

Run: `npm run typecheck 2>&1 | grep -iE "BarcodeGenerator|VariantPrintRow|barcodePrintSpecs" || echo "clean"`
Expected: `clean`. (If it reports `selectedVariantBatchIds`, `variantSvgsRef`, or `metaLine` unused, a replacement above was missed — remove the leftover.)

- [ ] **Step 9: Re-run the unit test**

Run: `npx tsx scripts/test-barcode-specs.ts`
Expected: PASS.

- [ ] **Step 10: Manual verification**

Run: `npm run dev`. Open a product **with multiple variants** → Print Barcode → **Per Variant** tab. Expected:
- One row per variant, each unchecked with copies **0**; Print button reads "Print" and is **disabled**.
- Check a row → copies becomes 1, Print enables and reads "Print 1 label"; the `+`/`–`/number field adjust copies; setting a row to 0 unchecks it.
- A variant with >1 batch shows a batch dropdown; choosing a batch changes nothing visible in the row but is used at print time.
- Set M=5, XL=3 → footer "Total: 8 labels", button "Print 8 labels"; click Print → the popup contains exactly 8 stickers (5 of M, 3 of XL) and no others.

- [ ] **Step 11: Commit**

```bash
git add src/components/BarcodeGenerator.tsx
git commit -m "feat: per-variant barcode print selection (pick variants + copies)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Per-variant opt-in list (checkbox + copies, default 0) → Task 3 (`VariantPrintRow`) + Task 4 (state, list).
- Checkbox ⟺ copies linked; clamp to 0 → Task 3 (`clampCopies`, checkbox→onCopies(1/0)).
- Per-variant batch picker (only >1 batch; default first; 0-batch fallback) → Task 3 (render) + Task 2 (`buildVariantSpecs` fallback).
- Copies expansion at print (push `copies` times) → Task 2 + Task 4 Step 5.
- Running total + Print disabled at 0 → Task 4 Steps 6, 7.
- Product tab batches default unticked → Task 1.
- Extract `VariantPrintRow`; no canvas/rendering changes → Tasks 3, 4 (only the variants branch + state touched).
- `variants` prop change re-inits to all-zero → Task 4 Step 4 effect.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code.

**Type consistency:** `StickerSpec`, `metaLine`, `VariantPrintEntry`, `buildVariantSpecs(variants, state, productName)` defined in Task 2 are consumed with identical signatures in Task 4. `VariantPrintRow` prop shape in Task 3 matches its usage in Task 4 Step 7. `updateVariant(sku, patch)` defined in Task 4 Step 4 is used in Step 7.

## Out of scope

- No copies stepper on the Product tab.
- No persistence of selections across dialog opens.
- No "select all / clear all" bulk control.
- No changes to canvas/thermal rendering, the popup, or the sticker layout.
