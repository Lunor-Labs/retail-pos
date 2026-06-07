# Barcode Batch Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-batch checklist to the barcode print modal so users can tick which batches to include, printing `qty` stickers per selected batch each with that batch's price, cost, supplier, and date.

**Architecture:** All UI changes are in `BarcodeGenerator.tsx` (new `BarcodeBatch` type, batch checklist, updated state, updated print logic). `Products.tsx` is updated to map `ProductBatch[]` → `BarcodeBatch[]` and pass it as a new `batches` prop. Backward compat is preserved — callers that don't pass `batches` continue to work unchanged.

**Tech Stack:** React, TypeScript, existing popup-print pattern (`buildStickerHtml` / `buildPopupHtml`)

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/components/BarcodeGenerator.tsx` |
| Modify | `src/components/Products.tsx` |

---

### Task 1: Add `BarcodeBatch` interface and extend existing types

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx` (lines 1–24)

- [ ] **Step 1: Add the `BarcodeBatch` interface** after the existing imports, before `BarcodeVariant`

  Open `src/components/BarcodeGenerator.tsx`. After line 4 (`import { Modal } from './ui';`), add:

  ```ts
  export interface BarcodeBatch {
    id: string;
    batchNumber?: string;
    sellingPrice: number;
    encodedCost?: string;
    supplierName?: string;
    date?: string;
  }
  ```

- [ ] **Step 2: Extend `BarcodeVariant` with optional `batches` field**

  The current `BarcodeVariant` interface (lines 6–13) becomes:

  ```ts
  export interface BarcodeVariant {
    sku: string;
    label: string;
    price?: number;
    encodedCost?: string;
    supplierName?: string;
    date?: string;
    batches?: BarcodeBatch[];
  }
  ```

- [ ] **Step 3: Extend `BarcodeGeneratorProps` with optional `batches` field**

  The current `BarcodeGeneratorProps` interface (lines 15–24) becomes:

  ```ts
  interface BarcodeGeneratorProps {
    productName: string;
    sku: string;
    price?: number;
    encodedCost?: string;
    supplierName?: string;
    date?: string;
    variants?: BarcodeVariant[];
    batches?: BarcodeBatch[];
    onClose: () => void;
  }
  ```

- [ ] **Step 4: Verify build**

  ```bash
  cd /home/dinesh-s/Documents/Dinesh/retail-pos && npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: add BarcodeBatch type and extend BarcodeVariant/Props"
  ```

---

### Task 2: Add batch selection state to `BarcodeGenerator`

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx` (the `BarcodeGenerator` function body)

- [ ] **Step 1: Destructure `batches` from props**

  The current function signature (line 145):
  ```ts
  export function BarcodeGenerator({ productName, sku, price, encodedCost, supplierName, date, variants, onClose }: BarcodeGeneratorProps) {
  ```

  Change to:
  ```ts
  export function BarcodeGenerator({ productName, sku, price, encodedCost, supplierName, date, variants, batches, onClose }: BarcodeGeneratorProps) {
  ```

- [ ] **Step 2: Add `selectedBatchIds` and `selectedVariantBatchIds` state**

  Below the existing `const [qty, setQty] = useState(1);` line, add:

  ```ts
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(
    () => new Set(batches?.map(b => b.id) ?? [])
  );
  const [selectedVariantBatchIds, setSelectedVariantBatchIds] = useState<Map<string, Set<string>>>(
    () => new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
  );
  ```

- [ ] **Step 3: Add `useEffect` to reset variant batch selection when variants load async**

  Below the two new state lines, add:

  ```ts
  useEffect(() => {
    setSelectedVariantBatchIds(
      new Map(variants?.map(v => [v.sku, new Set(v.batches?.map(b => b.id) ?? [])]) ?? [])
    );
  }, [variants]);
  ```

  > `variants` loads asynchronously in `Products.tsx` after the modal opens. Without this reset, variant batch checkboxes would all be unchecked until the user interacts.

- [ ] **Step 4: Verify build**

  ```bash
  npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: add batch selection state to BarcodeGenerator"
  ```

---

### Task 3: Batch checklist UI on the product tab

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx` (JSX inside `BarcodeGenerator`)

- [ ] **Step 1: Compute the preview batch for the product tab**

  In `BarcodeGenerator`, just before the `return (`, add:

  ```ts
  const previewBatch = batches?.find(b => selectedBatchIds.has(b.id));
  ```

- [ ] **Step 2: Insert the batch checklist between toolbar and sticker preview**

  In the JSX, find this block that sits directly after the toolbar `</div>`:

  ```tsx
        {tab === 'product' || !hasVariants ? (
          <SingleBarcode
  ```

  Replace the entire product-tab branch with:

  ```tsx
        {batches && batches.length > 1 && (
          <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Batches
            </div>
            {batches.map(b => (
              <label key={b.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                <input
                  type="checkbox"
                  checked={selectedBatchIds.has(b.id)}
                  onChange={e => {
                    setSelectedBatchIds(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(b.id);
                      else next.delete(b.id);
                      return next;
                    });
                  }}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-700">
                  {[b.date, b.supplierName, `LKR ${b.sellingPrice.toFixed(2)}`].filter(Boolean).join(' · ')}
                </span>
              </label>
            ))}
          </div>
        )}

        {tab === 'product' || !hasVariants ? (
          <SingleBarcode
            value={sku}
            label={productName}
            price={previewBatch ? previewBatch.sellingPrice : price}
            encodedCost={previewBatch ? previewBatch.encodedCost : encodedCost}
            supplierName={previewBatch ? previewBatch.supplierName : supplierName}
            date={previewBatch ? previewBatch.date : date}
            onSvgReady={el => { productSvgRef.current = el; }}
          />
  ```

  > The checklist only renders when `batches.length > 1`. Single-batch products see no change. The preview sticker reflects whichever batch is checked first.

- [ ] **Step 3: Verify build**

  ```bash
  npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: add batch checklist to product tab in barcode modal"
  ```

---

### Task 4: Batch checklist UI on the variants tab

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx` (variants tab JSX)

- [ ] **Step 1: Replace the variants tab render with per-variant batch checklist cards**

  Find the current variants branch in JSX:

  ```tsx
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {variants!.map(v => (
              <SingleBarcode
                key={v.sku}
                value={v.sku}
                label={`${productName} — ${v.label}`}
                price={v.price}
                encodedCost={v.encodedCost}
                supplierName={v.supplierName}
                date={v.date}
                onSvgReady={el => {
                  if (el) variantSvgsRef.current.set(v.sku, el);
                  else variantSvgsRef.current.delete(v.sku);
                }}
              />
            ))}
          </div>
        )}
  ```

  Replace it with:

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
                      {vBatches.map(b => (
                        <label key={b.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                          <input
                            type="checkbox"
                            checked={vSelected.has(b.id)}
                            onChange={e => {
                              setSelectedVariantBatchIds(prev => {
                                const next = new Map(prev);
                                const ids = new Set(next.get(v.sku) ?? []);
                                if (e.target.checked) ids.add(b.id);
                                else ids.delete(b.id);
                                next.set(v.sku, ids);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-slate-600">
                            {[b.date, `LKR ${b.sellingPrice.toFixed(2)}`].filter(Boolean).join(' · ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
  ```

- [ ] **Step 2: Verify build**

  ```bash
  npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: add per-variant batch checklist to variants tab in barcode modal"
  ```

---

### Task 5: Update `handlePrint` to use selected batches

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx` (`handlePrint` function)

- [ ] **Step 1: Replace the `handlePrint` function body**

  Find the current `handlePrint` function (starts at `function handlePrint() {`). Replace the entire function with:

  ```ts
  function handlePrint() {
    const serializer = new XMLSerializer();
    let stickersHtml = '';

    if (tab === 'product' || !hasVariants) {
      const svgEl = productSvgRef.current;
      if (!svgEl) return;
      const svgStr = serializer.serializeToString(svgEl);

      if (batches && batches.length > 0) {
        const selected = batches.filter(b => selectedBatchIds.has(b.id));
        stickersHtml = selected.flatMap(b =>
          Array.from({ length: qty }).map(() =>
            buildStickerHtml(svgStr, productName, b.sellingPrice, b.supplierName, b.date, b.encodedCost)
          )
        ).join('');
      } else {
        stickersHtml = Array.from({ length: qty })
          .map(() => buildStickerHtml(svgStr, productName, price, supplierName, date, encodedCost))
          .join('');
      }
    } else {
      stickersHtml = (variants ?? []).flatMap(v => {
        const svgEl = variantSvgsRef.current.get(v.sku);
        if (!svgEl) return [];
        const svgStr = serializer.serializeToString(svgEl);

        if (v.batches && v.batches.length > 0) {
          const vSelected = selectedVariantBatchIds.get(v.sku) ?? new Set<string>();
          const selected = v.batches.filter(b => vSelected.has(b.id));
          return selected.flatMap(b =>
            Array.from({ length: qty }).map(() =>
              buildStickerHtml(svgStr, `${productName} — ${v.label}`, b.sellingPrice, b.supplierName, b.date, b.encodedCost)
            )
          );
        }
        return Array.from({ length: qty }).map(() =>
          buildStickerHtml(svgStr, `${productName} — ${v.label}`, v.price, v.supplierName, v.date, v.encodedCost)
        );
      }).join('');
    }

    const popup = window.open('', '_blank', 'width=200,height=300,scrollbars=no,menubar=no,toolbar=no,location=no,status=no');
    if (!popup) { alert('Please allow popups for this site to enable printing.'); return; }
    popup.document.write(buildPopupHtml(stickersHtml));
    popup.document.close();
  }
  ```

  > The barcode SVG encodes the SKU, which is the same for all batches of a product — the same serialized SVG is correctly reused for every batch sticker. Only the price/cost/supplier/date text changes per batch.

- [ ] **Step 2: Verify build**

  ```bash
  npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: print qty stickers per selected batch in barcode modal"
  ```

---

### Task 6: Pass `batches` prop and variant batches from `Products.tsx`

**Files:**
- Modify: `src/components/Products.tsx`

- [ ] **Step 1: Import `BarcodeBatch` from `BarcodeGenerator`**

  Find the existing import line:
  ```ts
  import { BarcodeGenerator, BarcodeVariant } from './BarcodeGenerator';
  ```

  Change to:
  ```ts
  import { BarcodeGenerator, BarcodeVariant, BarcodeBatch } from './BarcodeGenerator';
  ```

- [ ] **Step 2: Update `handlePrintBarcode` to include variant batches**

  Find the current `handlePrintBarcode` function. It has a `mapped` array where each variant gets `price`, `encodedCost`, `supplierName`, `date` from `batches?.[0]`. Add a `batches` field to each mapped variant.

  Replace the full `handlePrintBarcode` function with:

  ```ts
  async function handlePrintBarcode(product: ProductWithStock) {
    setBarcodeProduct(product);
    setBarcodeVariants([]);
    try {
      const full = await productService.getProductWithVariants(product.id);
      if (full && full.variants.length > 0) {
        const mapped: BarcodeVariant[] = full.variants.map(v => {
          const vBatches: any[] = (v as any).batches ?? [];
          const firstBatch = vBatches[0];
          return {
            sku: v.sku,
            label: [v.size, v.color].filter(Boolean).join(' · ') || 'Default',
            price: firstBatch?.selling_price,
            encodedCost: costCodeConfigured && firstBatch?.cost_price != null ? encodeCost(firstBatch.cost_price) : undefined,
            supplierName: firstBatch?.supplier?.name ?? undefined,
            date: fmtBatchDate(firstBatch?.received_date),
            batches: vBatches.map((b): BarcodeBatch => ({
              id: b.id,
              batchNumber: b.batch_number ?? undefined,
              sellingPrice: b.selling_price,
              encodedCost: costCodeConfigured && b.cost_price != null ? encodeCost(b.cost_price) : undefined,
              supplierName: b.supplier?.name ?? undefined,
              date: fmtBatchDate(b.received_date),
            })),
          };
        });
        setBarcodeVariants(mapped);
      }
    } catch { /* silently ignore — product-level print still works */ }
  }
  ```

- [ ] **Step 3: Pass `batches` prop to `<BarcodeGenerator>` in the render**

  Find the `<BarcodeGenerator` JSX block (inside `{barcodeProduct && (...)}`) and add the `batches` prop. The full updated block:

  ```tsx
  {barcodeProduct && (
    <BarcodeGenerator
      productName={barcodeProduct.name}
      sku={barcodeProduct.sku}
      price={barcodeProduct.batches[0]?.selling_price}
      encodedCost={costCodeConfigured && barcodeProduct.batches[0]?.cost_price != null ? encodeCost(barcodeProduct.batches[0].cost_price) : undefined}
      supplierName={(barcodeProduct.batches[0] as any)?.supplier?.name ?? undefined}
      date={fmtBatchDate(barcodeProduct.batches[0]?.received_date)}
      batches={barcodeProduct.batches.map((b): BarcodeBatch => ({
        id: b.id,
        batchNumber: b.batch_number ?? undefined,
        sellingPrice: b.selling_price,
        encodedCost: costCodeConfigured && b.cost_price != null ? encodeCost(b.cost_price) : undefined,
        supplierName: (b as any).supplier?.name ?? undefined,
        date: fmtBatchDate(b.received_date),
      }))}
      variants={barcodeVariants.length > 0 ? barcodeVariants : undefined}
      onClose={() => { setBarcodeProduct(null); setBarcodeVariants([]); }}
    />
  )}
  ```

- [ ] **Step 4: Verify build**

  ```bash
  npm run build 2>&1 | tail -5
  ```

  Expected: `✓ built in` with no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/Products.tsx
  git commit -m "feat: pass all batches to BarcodeGenerator for per-batch sticker printing"
  ```

---

### Task 7: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Single-batch product — no visible change**

  Open a product that has only one batch. Open the barcode modal. Confirm:
  - No "Batches" checklist section is visible.
  - Sticker preview shows correct price/supplier/date.
  - Print opens popup with 1 sticker (qty=1).

- [ ] **Step 3: Multi-batch product — checklist appears**

  Open a product with 2+ batches. Open the barcode modal. Confirm:
  - A "Batches" section appears with one checkbox row per batch.
  - Each row shows date · supplier · LKR price.
  - All batches are checked by default.
  - Preview sticker shows the first batch's price.

- [ ] **Step 4: Uncheck a batch and print**

  Uncheck one batch. Click Print. Confirm:
  - Popup opens with only the checked batches' stickers (× qty).
  - Each sticker shows its own batch's price and meta.

- [ ] **Step 5: Variants tab with multi-batch variants**

  Open a product with variants. Switch to the Per Variant tab. Confirm:
  - Each variant card shows its own "Batches" checklist (only if >1 batch).
  - Uncheck a batch on one variant, leave others checked.
  - Print — confirm only checked batches per variant appear in the popup.
