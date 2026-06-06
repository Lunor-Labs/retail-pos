# Barcode Sticker 38×25mm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the barcode print layout to fit a 38×25mm thermal label sticker and add a quantity input so users can print multiple copies in one print job.

**Architecture:** All changes are in `src/components/BarcodeGenerator.tsx`. The `@page` CSS is updated to `size: 38mm 25mm`, the `.barcode-print` block is compacted to fit the sticker, and a `qty` state drives rendering N copies of the sticker in the print area.

**Tech Stack:** React, TypeScript, JsBarcode (already installed), `window.print()` / CSS `@media print`

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/components/BarcodeGenerator.tsx` |

---

### Task 1: Fix `@page` size and compact `.barcode-print` print CSS

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx`

- [ ] **Step 1: Open the file and locate the `<style>` block**

  The `<style>` block starts at line 122 of `src/components/BarcodeGenerator.tsx`. It currently contains:

  ```css
  @media print {
    @page { margin: 3mm; }
    body { visibility: hidden; background-color: white; margin: 0; }
    #barcode-content { ... }
    .barcode-print { ... }
    .barcode-print h3 { ... }
    .barcode-print svg { ... }
    .barcode-print p { ... }
    .print\:hidden { display: none !important; }
  }
  ```

- [ ] **Step 2: Replace the entire `<style>` block with the sticker-optimised version**

  Replace the existing `<style>{`...`}</style>` with:

  ```tsx
  <style>{`
    @media print {
      @page { size: 38mm 25mm; margin: 0; }
      body { visibility: hidden; background-color: white; margin: 0; }
      #barcode-content {
        visibility: visible;
        position: absolute; left: 0; top: 0;
        background-color: white; z-index: 9999;
        padding: 0; margin: 0;
      }
      #barcode-content * { visibility: visible; }
      .barcode-print {
        width: 38mm;
        height: 25mm;
        padding: 1mm;
        box-sizing: border-box;
        overflow: hidden;
        page-break-after: always;
        border: none !important;
        border-radius: 0 !important;
        background: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
      }
      .barcode-print h3 {
        font-size: 7pt !important;
        font-weight: bold !important;
        margin: 0 0 1px !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .barcode-print svg {
        width: 100% !important;
        height: auto !important;
        max-height: 28pt;
        display: block;
      }
      .barcode-print .print-price {
        font-size: 8pt !important;
        font-weight: bold !important;
        margin: 1px 0 0 !important;
      }
      .barcode-print .print-meta {
        font-size: 6pt !important;
        margin: 0 !important;
      }
      .print\\:hidden { display: none !important; }
    }
  `}</style>
  ```

- [ ] **Step 3: Update the `SingleBarcode` JSX to use the new CSS class names**

  The current `SingleBarcode` uses generic `<p>` tags. Replace them with `<p className="print-price">` for the price and `<p className="print-meta">` for the supplier/date/cost line so the new print CSS targets them precisely.

  Replace the return block of `SingleBarcode` (lines 49–67) with:

  ```tsx
  return (
    <div className="barcode-print bg-white border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
      <h3 className="text-lg font-bold text-slate-900 mb-1">{label}</h3>
      <div className="flex justify-center mb-4">
        <svg ref={ref} className="max-w-full"></svg>
      </div>
      {price !== undefined && (
        <p className="print-price text-xl font-bold text-slate-900">LKR {price.toFixed(2)}</p>
      )}
      {(supplierName || date) && (
        <p className="print-meta text-sm text-slate-500 mt-1">
          {[supplierName, date].filter(Boolean).join(' · ')}
        </p>
      )}
      {encodedCost && (
        <p className="print-meta text-sm font-mono font-semibold text-slate-700 mt-0.5 tracking-widest">{encodedCost}</p>
      )}
    </div>
  );
  ```

- [ ] **Step 4: Verify the app compiles**

  ```bash
  cd /home/dinesh-s/Documents/Dinesh/retail-pos && npm run build 2>&1 | tail -20
  ```

  Expected: no TypeScript or build errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "fix: set barcode print page size to 38x25mm sticker"
  ```

---

### Task 2: Add quantity state and input UI

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx`

- [ ] **Step 1: Add `qty` state to `BarcodeGenerator`**

  Locate the line in `BarcodeGenerator` that reads:

  ```tsx
  const [tab, setTab] = useState<'product' | 'variants'>('product');
  ```

  Add the quantity state directly below it:

  ```tsx
  const [qty, setQty] = useState(1);
  ```

- [ ] **Step 2: Add the Qty input to the toolbar**

  Locate the Print button JSX inside `BarcodeGenerator`. It sits inside an outer `<div className="flex justify-end mb-4 print:hidden">`. Keep that outer div unchanged — it already hides the entire toolbar (including the tab switcher) when printing.

  Replace only the Print `<button>` with a `<div>` that holds the Qty input and the Print button side by side:

  ```tsx
  <div className="flex items-center gap-2">
    <label className="text-sm text-slate-600 font-medium">Qty</label>
    <input
      type="number"
      min={1}
      max={100}
      value={qty}
      onChange={e => setQty(Math.max(1, Math.min(100, Number(e.target.value))))}
      className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-center"
    />
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition"
    >
      <Printer className="w-4 h-4" />
      Print
    </button>
  </div>
  ```

  The outer `print:hidden` div already hides this during printing — no extra `print:hidden` needed on the inner div.

- [ ] **Step 3: Verify the app compiles**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: add quantity input to barcode print toolbar"
  ```

---

### Task 3: Render N copies in the print area

**Files:**
- Modify: `src/components/BarcodeGenerator.tsx`

- [ ] **Step 1: Wrap the product-tab sticker render with quantity copies**

  Locate the JSX in `BarcodeGenerator` that renders the single product barcode:

  ```tsx
  {tab === 'product' || !hasVariants ? (
    <SingleBarcode value={sku} label={productName} price={price} encodedCost={encodedCost} supplierName={supplierName} date={date} />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {variants!.map(v => (
        <SingleBarcode key={v.sku} value={v.sku} label={`${productName} — ${v.label}`} price={v.price} encodedCost={v.encodedCost} supplierName={v.supplierName} date={v.date} />
      ))}
    </div>
  )}
  ```

  Replace with:

  ```tsx
  {tab === 'product' || !hasVariants ? (
    <>
      {Array.from({ length: qty }).map((_, i) => (
        <SingleBarcode
          key={i}
          value={sku}
          label={productName}
          price={price}
          encodedCost={encodedCost}
          supplierName={supplierName}
          date={date}
        />
      ))}
    </>
  ) : (
    <>
      {variants!.flatMap(v =>
        Array.from({ length: qty }).map((_, i) => (
          <SingleBarcode
            key={`${v.sku}-${i}`}
            value={v.sku}
            label={`${productName} — ${v.label}`}
            price={v.price}
            encodedCost={v.encodedCost}
            supplierName={v.supplierName}
            date={v.date}
          />
        ))
      )}
    </>
  )}
  ```

  > This renders `qty` copies per product sticker, or `qty` copies of each variant sticker when on the variants tab.

- [ ] **Step 2: Verify the app compiles**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/BarcodeGenerator.tsx
  git commit -m "feat: render N sticker copies based on quantity input"
  ```

---

### Task 4: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

  Open the app in a browser at the URL shown in the terminal (typically `http://localhost:5173`).

- [ ] **Step 2: Open the barcode print modal**

  Navigate to Products, find any product, click the barcode/print icon to open the `BarcodeGenerator` modal.

- [ ] **Step 3: Verify the Qty input appears**

  Check that the toolbar shows `Qty [ 1 ] [ Print ]`. Change the value to `3`.

- [ ] **Step 4: Open the browser print dialog**

  Click Print. In the print dialog:
  - Set paper size to **38mm × 25mm** (or the label size on your printer driver).
  - Confirm the preview shows 3 identical sticker pages.
  - Confirm content (name, barcode, price, meta) is not clipped.

- [ ] **Step 5: Verify single-copy default**

  Reset Qty to `1`, click Print — confirm only 1 sticker page appears in preview.

- [ ] **Step 6: Verify variants tab**

  If the product has variants, switch to the Per Variant tab, set Qty to `2`, click Print — confirm each variant appears 2 times (N variants × 2 = 2N pages).
