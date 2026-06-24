# Numeric SKU Scheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate pure-numeric SKUs (6-digit product base + 2-digit variant suffix) for new products so printed CODE128 barcodes are compact and scan reliably.

**Architecture:** Extract the numeric logic into a pure, unit-tested util module (`src/utils/skuUtils.ts`). `ProductService.generateNextSku()` fetches all product SKUs and delegates to the util for the next base number. `AddProductPage.tsx` builds variant SKUs by concatenating the base with a 2-digit index suffix via the util. Legacy alphanumeric SKUs are ignored by the generator and left untouched.

**Tech Stack:** TypeScript, React, Vite, Supabase (PostgREST JS client). No test framework is installed; pure logic is verified with a standalone `tsx` script following the existing `scripts/test-*.ts` pattern. Type safety verified with `npm run typecheck`.

## Global Constraints

- SKU is always a **string** — never `parseInt` a stored SKU for storage/display (drops leading zeros). The `sku` column is TEXT.
- Product base: 6 digits, range `100000`–`999999`, allocated as `max(existing 6-digit numeric SKUs) + 1`, floor `100000`.
- Variant SKU: `base + 2-digit zero-padded suffix`, concatenated, **no separator** (e.g. `100042` → `10004201`). Pure digits, even length, for CODE128 Code C.
- Variant suffix is the row's 1-based position: index `0` → `"01"`.
- Do NOT modify existing products' SKUs. Do NOT touch `BarcodeGenerator.tsx`, the scan/lookup path, or the DB schema.
- Manual SKU entry must still work (validation only checks non-empty).

---

### Task 1: Pure numeric SKU util + tests

**Files:**
- Create: `src/utils/skuUtils.ts`
- Test: `scripts/test-sku-utils.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `nextProductSku(existingSkus: string[]): string` — returns the next 6-digit base SKU as a string. Ignores any element not matching `^\d{6}$`. Returns `"100000"` when no 6-digit numeric SKU exists; otherwise `String(maxNumeric + 1)`.
  - `variantSku(baseSku: string, index: number): string` — returns `` `${baseSku}${String(index + 1).padStart(2, '0')}` ``.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-sku-utils.ts`:

```ts
import { nextProductSku, variantSku } from '../src/utils/skuUtils';

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} -> ${JSON.stringify(actual)}`);
  if (!ok) { console.log(`   expected ${JSON.stringify(expected)}`); failures++; }
}

// nextProductSku
eq('empty list starts at 100000', nextProductSku([]), '100000');
eq('ignores non-numeric legacy SKUs', nextProductSku(['NIK-SHO-001', 'ABCDEF']), '100000');
eq('ignores wrong-length numeric', nextProductSku(['12345', '1234567']), '100000');
eq('increments max 6-digit', nextProductSku(['100000', '100042', 'NIK-001']), '100043');
eq('single existing base', nextProductSku(['100042']), '100043');
eq('numeric (not lexical) max', nextProductSku(['100009', '100010']), '100011');

// variantSku
eq('first variant suffix 01', variantSku('100042', 0), '10004201');
eq('second variant suffix 02', variantSku('100042', 1), '10004202');
eq('tenth variant suffix 10', variantSku('100042', 9), '10004210');

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll SKU util tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/test-sku-utils.ts`
Expected: FAIL — module `../src/utils/skuUtils` not found (cannot resolve import).

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/skuUtils.ts`:

```ts
/**
 * Numeric SKU scheme.
 *
 * Product base: 6 digits (100000–999999), allocated as max(existing 6-digit
 * numeric SKUs) + 1. Legacy alphanumeric SKUs (e.g. "NIK-SHO-001") are ignored.
 *
 * Variant SKU: base + 2-digit suffix, concatenated with no separator
 * (100042 -> 10004201). Pure digits + even length lets CODE128 use its compact
 * Code C mode, halving the bar count for reliable scanning at 38mm label width.
 *
 * SKUs are always strings — never parseInt for storage/display, or leading
 * zeros are lost.
 */

const SIX_DIGITS = /^\d{6}$/;
const BASE_FLOOR = 100000;

/** Next 6-digit product base SKU. Ignores non 6-digit-numeric entries. */
export function nextProductSku(existingSkus: string[]): string {
  let max = BASE_FLOOR - 1;
  for (const sku of existingSkus) {
    if (SIX_DIGITS.test(sku)) {
      const n = Number(sku);
      if (n > max) max = n;
    }
  }
  return String(max + 1);
}

/** Variant SKU = base + 2-digit (1-based) suffix, e.g. variantSku('100042', 0) -> '10004201'. */
export function variantSku(baseSku: string, index: number): string {
  return `${baseSku}${String(index + 1).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/test-sku-utils.ts`
Expected: PASS — prints "All SKU util tests passed." and exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/utils/skuUtils.ts scripts/test-sku-utils.ts
git commit -m "feat: add numeric SKU util (6-digit base + 2-digit variant suffix)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Generate numeric base SKU in ProductService

**Files:**
- Modify: `src/services/ProductService.ts` (`generateNextSku`, ~L341-368)

**Interfaces:**
- Consumes: `nextProductSku` from `src/utils/skuUtils.ts` (Task 1).
- Produces: `generateNextSku(_brand?: string, _category?: string): Promise<string>` — unchanged signature (args now ignored; positional callers unaffected), resolves to a 6-digit numeric base SKU.

- [ ] **Step 1: Add the import**

At the top of `src/services/ProductService.ts`, add to the existing imports:

```ts
import { nextProductSku } from '../utils/skuUtils';
```

- [ ] **Step 2: Replace the generateNextSku body**

Replace the entire current method (the version that builds `BRAND-CAT-NNN` by stripping brand/category letters and scanning a `like` prefix) with:

```ts
    /**
     * Generate the next numeric product base SKU (6 digits, 100000+).
     * Brand/category are no longer encoded in the SKU — they live in their own
     * product fields. Args kept for call-site compatibility; intentionally unused.
     */
    async generateNextSku(_brand: string = '', _category: string = ''): Promise<string> {
        try {
            const client = (this.productRepo as any).adapter.getClient();
            const { data } = await client.from('products').select('sku');
            const skus = ((data as { sku: string }[]) || []).map(r => r.sku);
            return nextProductSku(skus);
        } catch (error) {
            logger.error('Failed to generate SKU', error as Error);
            return '100000';
        }
    }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors. (If lint is run, the `_`-prefixed params satisfy the unused-args rule.)

- [ ] **Step 4: Verify behavior against the util test**

The logic is exercised by Task 1's test (`nextProductSku`). Re-run it to confirm nothing regressed:

Run: `npx tsx scripts/test-sku-utils.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/ProductService.ts
git commit -m "feat: generate numeric 6-digit product base SKUs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Build numeric variant SKUs in AddProductPage

**Files:**
- Modify: `src/components/products/AddProductPage.tsx` (`emptyRow` L45-57; SKU rebuild effect L100-109; `buildVariantInputs` L162-177; `doSave` allRows map L194-204)

**Interfaces:**
- Consumes: `variantSku` from `src/utils/skuUtils.ts` (Task 1).
- Produces: variant `sku` strings of the form `<6-digit base><2-digit suffix>`.

- [ ] **Step 1: Add the import**

At the top of `src/components/products/AddProductPage.tsx`, add to the existing imports:

```ts
import { variantSku } from '../../utils/skuUtils';
```

- [ ] **Step 2: Update `emptyRow` to use the numeric suffix**

Replace the `sku` line inside `emptyRow` (currently `sku: parentSku ? \`${parentSku}-${index + 1}\` : '',` at L49):

```ts
    sku: parentSku ? variantSku(parentSku, index) : '',
```

- [ ] **Step 3: Update the SKU rebuild effect (add row index, drop size/color/dash)**

Replace the `setRows` block inside the generate-on-mount effect (currently maps `r => r.skuAutoGenerated ? { ...r, sku: [sku, r.size, r.color]…join('-') } : r` at L104-107) with an index-aware numeric build:

```ts
      setRows(prev => prev.map((r, i) => r.skuAutoGenerated
        ? { ...r, sku: variantSku(sku, i) }
        : r
      ));
```

- [ ] **Step 4: Update the two fallback SKUs**

In `buildVariantInputs` (L168) and in `doSave`'s `allRows` map (L197), replace both occurrences of:

```ts
        sku: r.sku.trim() || `${info.sku}-${Date.now()}`,
```

with an index-based numeric fallback. Change each `.map(r => ...)` to `.map((r, i) => ...)` and use:

```ts
        sku: r.sku.trim() || variantSku(info.sku, i),
```

Note: `buildVariantInputs` filters with `.filter(r => !r.id)` before `.map`; apply the `(r, i)` index on the post-filter map. `doSave`'s `allRows` maps `rows` directly.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors.

- [ ] **Step 6: Manual smoke verification**

Run: `npm run dev`, open Add Product. Expected, observable behavior:
- Product SKU field auto-fills with a 6-digit number (e.g. `100000` on an empty catalog, or `max + 1`).
- Adding variants yields SKUs like `10000001`, `10000002` (base + `01`, `02`).
- The barcode preview in the print dialog shows a visibly shorter/wider barcode than the old `NIK-SHO-001` style.

- [ ] **Step 7: Commit**

```bash
git add src/components/products/AddProductPage.tsx
git commit -m "feat: build numeric variant SKUs (base + 2-digit suffix)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 6-digit base, 100000 floor, max+1 → Task 1 (`nextProductSku`) + Task 2.
- Variant = base + 2-digit concatenated suffix → Task 1 (`variantSku`) + Task 3.
- Ignore legacy alphanumeric SKUs → Task 1 (`^\d{6}$` filter), verified by test.
- Leave existing products untouched → no migration task (intentional; matches "Leave old, new numeric").
- Manual override preserved → unchanged validation; numeric only fills the auto-generated default.
- No barcode-render / scan / DB changes → none in the plan.
- Brand/category args kept for compatibility → Task 2 (`_brand`, `_category`).
- All four variant-SKU build spots updated → Task 3 Steps 2-4 (L49, L105, L168, L197).

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code.

**Type consistency:** `nextProductSku(string[]): string` and `variantSku(string, number): string` are defined in Task 1 and consumed with matching signatures in Tasks 2 and 3. `generateNextSku` keeps its `Promise<string>` return.

## Out of scope

- Renumbering/migrating existing alphanumeric products.
- Barcode print-tuning beyond what the numeric value provides for free.
- Variants beyond 99 per product (2-digit suffix cap; documented).
