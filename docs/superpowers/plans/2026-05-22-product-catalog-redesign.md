# Product Catalog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken variant stock aggregation and replace the multi-step product add/edit flow with a single full-page form that handles product info, variants, and initial stock in one step.

**Architecture:** Data layer fix first (ProductRepository correctly sums variant batches → product stock), then new `AddProductPage` component (full-page, variant table inline), then Products.tsx routing replaces the modal, then ProductTable row gets richer info. No DB schema changes — `product_batches.variant_id` is already the sole FK. No test framework present; TypeScript build (`npm run build`) serves as the compilation check; manual browser verification at the end.

**Tech Stack:** React 18, TypeScript, Supabase (Postgres), Dexie/IndexedDB, Tailwind CSS, Vite, Lucide icons, existing design tokens (`var(--accent)`, `.card`, `.btn`, etc.)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add `ProductWithVariants`, add `base_price` to `ProductWithStock` and `ProductWithBatches` |
| `src/repositories/ProductRepository.ts` | Modify | Fix `findAllWithStock()` to join variants then batches |
| `src/services/ProductService.ts` | Modify | Add `createProductWithVariants()`, `updateProductWithVariants()`, `getProductWithVariants()` |
| `src/hooks/useProducts.ts` | Modify | `base_price` flows through automatically; extend search to include `brand` |
| `src/components/products/VariantTableRow.tsx` | Create | Single editable/display variant row (add mode and edit mode) |
| `src/components/products/AddProductPage.tsx` | Create | Full-page add/edit form with product info, pricing, variant table |
| `src/components/Products.tsx` | Modify | Replace modal routing with page-view routing (`list`/`add`/`edit`) |
| `src/components/products/ProductTable.tsx` | Modify | Richer row: brand, base_price, variant count, +Stock and Edit buttons |

---

### Task 1: Update Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `base_price` to `ProductWithStock` and `ProductWithBatches`, add `ProductWithVariants`**

Replace the relevant interfaces in `src/types/index.ts`:

```typescript
// Replace the existing ProductWithStock interface:
export interface ProductWithStock extends Product {
  batches: ProductBatch[];
  total_stock: number;
  base_price: number;
}

// Replace the existing ProductWithBatches interface:
export interface ProductWithBatches extends Product {
  batches: ProductBatch[];
  total_stock: number;
  base_price: number;
  search_words?: string[];
}

// Add after ProductWithBatches:
export interface ProductWithVariants extends Product {
  variants: VariantWithStock[];
  total_stock: number;
  base_price: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/dinesh-s/Documents/Dinesh/gasithmotors.lk && npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: TypeScript errors referencing `base_price` missing — that's correct, they'll be fixed as we implement each task. If there are unrelated errors, investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ProductWithVariants type and base_price to product types"
```

---

### Task 2: Fix ProductRepository.findAllWithStock()

**Files:**
- Modify: `src/repositories/ProductRepository.ts`

The current implementation groups batches by `batch.product_id ?? batch.variant_id`. Since `product_batches` only has `variant_id` (not `product_id`), no batch ever matches a product — every product gets `total_stock: 0`. The fix joins via variants.

- [ ] **Step 1: Replace `findAllWithStock()` entirely**

In `src/repositories/ProductRepository.ts`, replace the entire `findAllWithStock()` method (lines 19–93) with:

```typescript
async findAllWithStock(): Promise<ProductWithStock[]> {
  const CHUNK_SIZE = 1000;
  const client = (this.adapter as any).getClient();

  // 1. Fetch all active products in chunks
  let allProducts: Product[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const chunk = await this.adapter.query<Product>(this.tableName, {
      where: [{ field: 'active', operator: '=', value: true }],
      orderBy: [{ field: 'sku', direction: 'asc' }],
      offset: from,
      limit: CHUNK_SIZE,
    });
    allProducts = [...allProducts, ...chunk];
    if (chunk.length < CHUNK_SIZE) hasMore = false;
    else from += CHUNK_SIZE;
  }

  if (allProducts.length === 0) return [];

  // 2. Fetch all variants for these products
  const { data: allVariants, error: varErr } = await client
    .from('product_variants')
    .select('*')
    .eq('active', true);
  if (varErr) throw new Error(`Failed to fetch variants: ${varErr.message}`);

  // 3. Fetch all batches (linked to variants)
  const { data: allBatches, error: batErr } = await client
    .from('product_batches')
    .select('*, supplier:suppliers(name)');
  if (batErr) throw new Error(`Failed to fetch batches: ${batErr.message}`);

  // 4. Group variants by product_id
  const variantsByProduct = new Map<string, any[]>();
  for (const v of (allVariants as any[]) || []) {
    if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
    variantsByProduct.get(v.product_id)!.push(v);
  }

  // 5. Group batches by variant_id
  const batchesByVariant = new Map<string, ProductBatch[]>();
  for (const b of (allBatches as any[]) || []) {
    if (!batchesByVariant.has(b.variant_id)) batchesByVariant.set(b.variant_id, []);
    batchesByVariant.get(b.variant_id)!.push(b as ProductBatch);
  }

  // 6. Build ProductWithStock[] — flatten all variant batches onto each product
  return allProducts.map(product => {
    const variants = variantsByProduct.get(product.id) || [];
    const flatBatches: ProductBatch[] = [];
    let totalStock = 0;
    let basePrice = 0;

    for (const v of variants) {
      const vBatches = batchesByVariant.get(v.id) || [];
      for (const b of vBatches) {
        flatBatches.push(b);
        totalStock += b.current_quantity;
        if (basePrice === 0 || b.selling_price < basePrice) basePrice = b.selling_price;
      }
    }

    return { ...product, batches: flatBatches, total_stock: totalStock, base_price: basePrice } as ProductWithStock;
  });
}
```

- [ ] **Step 2: Fix `findByIdWithStock()` to also compute `base_price`**

Replace `findByIdWithStock()` (lines 98–110):

```typescript
async findByIdWithStock(id: string): Promise<ProductWithStock | null> {
  const product = await this.findById(id);
  if (!product) return null;
  const client = (this.adapter as any).getClient();

  const { data: variants } = await client
    .from('product_variants')
    .select('*')
    .eq('product_id', id)
    .eq('active', true);

  const variantIds = (variants as any[] || []).map((v: any) => v.id);
  let batches: ProductBatch[] = [];
  if (variantIds.length > 0) {
    const { data: batchData } = await client
      .from('product_batches')
      .select('*, supplier:suppliers(name)')
      .in('variant_id', variantIds);
    batches = (batchData as ProductBatch[]) || [];
  }

  const total_stock = batches.reduce((sum, b) => sum + b.current_quantity, 0);
  const base_price = batches.length > 0 ? Math.min(...batches.map(b => b.selling_price)) : 0;

  return { ...product, batches, total_stock, base_price } as ProductWithStock;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: fewer `base_price` errors (ProductRepository now produces it). Remaining errors will be in components — fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/repositories/ProductRepository.ts
git commit -m "fix: aggregate variant batch stock correctly in ProductRepository"
```

---

### Task 3: Add ProductService Methods

**Files:**
- Modify: `src/services/ProductService.ts`

Add three new methods: `createProductWithVariants`, `updateProductWithVariants`, `getProductWithVariants`.

- [ ] **Step 1: Add the `VariantInput` interface at the top of ProductService.ts (after imports)**

```typescript
export interface VariantInput {
  size: string | null;
  color: string | null;
  sku: string;
  barcode: string | null;
  reorder_level: number;
  qty: number;
  selling_price: number;
  cost_price: number;
  markup_percentage: number;
  supplier_id: string;
}
```

- [ ] **Step 2: Add `createProductWithVariants()` method to the `ProductService` class (before the closing `}`)**

```typescript
async createProductWithVariants(
  productData: { sku: string; name: string; description?: string; category?: string; brand?: string; gender?: string; material?: string; unit?: string; image_url?: string },
  variants: VariantInput[]
): Promise<Product> {
  try {
    if (!productData.name?.trim()) throw new Error('Product name is required.');
    if (!productData.sku?.trim()) throw new Error('SKU is required.');
    if (variants.length === 0) throw new Error('At least one variant is required.');

    const existing = await this.productRepo.findBySku(productData.sku.trim());
    if (existing) throw new Error(`SKU "${productData.sku}" already exists.`);

    const client = (this.productRepo as any).adapter.getClient();

    const { data: product, error: prodErr } = await client
      .from('products')
      .insert({
        sku: productData.sku.trim(),
        name: productData.name.trim(),
        description: productData.description || null,
        category: productData.category || null,
        brand: productData.brand || null,
        gender: productData.gender || null,
        material: productData.material || null,
        unit: productData.unit || 'piece',
        image_url: productData.image_url || null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (prodErr) throw prodErr;

    for (const v of variants) {
      const { data: variant, error: varErr } = await client
        .from('product_variants')
        .insert({
          product_id: product.id,
          size: v.size || null,
          color: v.color || null,
          sku: v.sku.trim(),
          barcode: v.barcode || null,
          reorder_level: v.reorder_level || 0,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (varErr) throw varErr;

      if (v.qty > 0) {
        const { error: batErr } = await client.from('product_batches').insert({
          variant_id: variant.id,
          supplier_id: v.supplier_id,
          batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          cost_price: v.cost_price,
          markup_percentage: v.markup_percentage,
          selling_price: v.selling_price,
          initial_quantity: v.qty,
          current_quantity: v.qty,
          received_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (batErr) throw batErr;
      }
    }

    return product as Product;
  } catch (error) {
    logger.error('Failed to create product with variants', error as Error);
    throw error;
  }
}
```

- [ ] **Step 3: Add `getProductWithVariants()` method**

```typescript
async getProductWithVariants(id: string): Promise<import('../types').ProductWithVariants | null> {
  try {
    const client = (this.productRepo as any).adapter.getClient();

    const { data: product, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (prodErr || !product) return null;

    const { data: variants, error: varErr } = await client
      .from('product_variants')
      .select('*')
      .eq('product_id', id)
      .eq('active', true)
      .order('size', { ascending: true });
    if (varErr) throw varErr;

    const variantIds = (variants as any[]).map((v: any) => v.id);
    let allBatches: any[] = [];
    if (variantIds.length > 0) {
      const { data: batchData } = await client
        .from('product_batches')
        .select('*, supplier:suppliers(name)')
        .in('variant_id', variantIds);
      allBatches = batchData || [];
    }

    const batchesByVariant = new Map<string, any[]>();
    for (const b of allBatches) {
      if (!batchesByVariant.has(b.variant_id)) batchesByVariant.set(b.variant_id, []);
      batchesByVariant.get(b.variant_id)!.push(b);
    }

    let totalStock = 0;
    let basePrice = 0;
    const variantsWithStock = (variants as any[]).map(v => {
      const batches = batchesByVariant.get(v.id) || [];
      const stock = batches.reduce((s: number, b: any) => s + b.current_quantity, 0);
      totalStock += stock;
      for (const b of batches) {
        if (basePrice === 0 || b.selling_price < basePrice) basePrice = b.selling_price;
      }
      return { ...v, batches, total_stock: stock };
    });

    return { ...product, variants: variantsWithStock, total_stock: totalStock, base_price: basePrice };
  } catch (error) {
    logger.error('Failed to get product with variants', error as Error);
    return null;
  }
}
```

- [ ] **Step 4: Add `updateProductWithVariants()` method**

```typescript
async updateProductWithVariants(
  id: string,
  productData: { name: string; description?: string; category?: string; brand?: string; gender?: string; material?: string; unit?: string; image_url?: string },
  newVariants: VariantInput[]
): Promise<void> {
  try {
    const client = (this.productRepo as any).adapter.getClient();

    const { error: prodErr } = await client
      .from('products')
      .update({
        name: productData.name.trim(),
        description: productData.description || null,
        category: productData.category || null,
        brand: productData.brand || null,
        gender: productData.gender || null,
        material: productData.material || null,
        unit: productData.unit || 'piece',
        image_url: productData.image_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (prodErr) throw prodErr;

    // Only insert truly new variants (those without an id)
    for (const v of newVariants) {
      const { data: variant, error: varErr } = await client
        .from('product_variants')
        .insert({
          product_id: id,
          size: v.size || null,
          color: v.color || null,
          sku: v.sku.trim(),
          barcode: v.barcode || null,
          reorder_level: v.reorder_level || 0,
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (varErr) throw varErr;

      if (v.qty > 0) {
        const { error: batErr } = await client.from('product_batches').insert({
          variant_id: variant.id,
          supplier_id: v.supplier_id,
          batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          cost_price: v.cost_price,
          markup_percentage: v.markup_percentage,
          selling_price: v.selling_price,
          initial_quantity: v.qty,
          current_quantity: v.qty,
          received_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (batErr) throw batErr;
      }
    }
  } catch (error) {
    logger.error('Failed to update product with variants', error as Error);
    throw error;
  }
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: build errors should be reducing. Remaining errors are in components not yet updated.

- [ ] **Step 6: Commit**

```bash
git add src/services/ProductService.ts
git commit -m "feat: add createProductWithVariants, updateProductWithVariants, getProductWithVariants to ProductService"
```

---

### Task 4: Extend useProducts Search to Include Brand

**Files:**
- Modify: `src/hooks/useProducts.ts`

`base_price` flows through automatically (spread operator in sync). Only change needed: extend search to also match `brand`.

- [ ] **Step 1: Update the `'all'` search case in `useProducts` to include brand**

In `src/hooks/useProducts.ts`, find the `case 'all':` block (around line 130) and replace it:

```typescript
case 'all':
default:
  collection = db.products.filter(p => {
    const nameMatch = expandedTerms.some(term => {
      const words = term.split(/\s+/);
      return words.every(word => p.name.toLowerCase().includes(word));
    });
    if (nameMatch) return true;

    const brandMatch = p.brand
      ? expandedTerms.some(term => p.brand!.toLowerCase().includes(term))
      : false;
    if (brandMatch) return true;

    return p.sku.toLowerCase() === query ||
      p.name.toLowerCase().replace(/\s+/g, '').includes(query.replace(/\s+/g, ''));
  });
  break;
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProducts.ts
git commit -m "feat: extend product search to match brand name"
```

---

### Task 5: Create VariantTableRow Component

**Files:**
- Create: `src/components/products/VariantTableRow.tsx`

This component renders one row in the variant table. It has two modes: `add` (editable qty field) and `edit` (shows existing stock read-only, with an inline +Stock form toggle).

- [ ] **Step 1: Create the file**

Create `src/components/products/VariantTableRow.tsx`:

```tsx
import { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';

export interface VariantRowData {
  id?: string;
  size: string;
  color: string;
  sku: string;
  skuAutoGenerated: boolean;
  barcode: string;
  qty: number;
  priceOverride: number | null;
  reorder_level: number;
  existing_stock?: number;
}

interface StockIntakeData {
  supplier_id: string;
  qty: number;
  cost_price: number;
  markup_percentage: number;
}

interface VariantTableRowProps {
  row: VariantRowData;
  index: number;
  defaultSellingPrice: number;
  defaultCostPrice: number;
  defaultMarkup: number;
  defaultSupplierId: string;
  suppliers: { id: string; name: string }[];
  mode: 'add' | 'edit';
  parentSku: string;
  isOnly: boolean;
  onChange: (index: number, row: VariantRowData) => void;
  onDelete: (index: number) => void;
  onAddStock?: (index: number, intake: StockIntakeData) => Promise<void>;
  onTabFromLastCell?: () => void;
}

function autoSku(parentSku: string, size: string, color: string): string {
  const parts = [parentSku, size, color].filter(Boolean).map(s => s.replace(/\s+/g, '').toUpperCase());
  return parts.join('-');
}

export function VariantTableRow({
  row, index, defaultSellingPrice, defaultCostPrice, defaultMarkup, defaultSupplierId,
  suppliers, mode, parentSku, isOnly, onChange, onDelete, onAddStock, onTabFromLastCell,
}: VariantTableRowProps) {
  const [showStockIntake, setShowStockIntake] = useState(false);
  const [intakeSupplierId, setIntakeSupplierId] = useState(defaultSupplierId);
  const [intakeQty, setIntakeQty] = useState(0);
  const [intakeCost, setIntakeCost] = useState(defaultCostPrice);
  const [intakeMarkup, setIntakeMarkup] = useState(defaultMarkup);
  const [intakeSaving, setIntakeSaving] = useState(false);

  const effectivePrice = row.priceOverride ?? defaultSellingPrice;
  const isPriceOverridden = row.priceOverride !== null;

  function update(patch: Partial<VariantRowData>) {
    const updated = { ...row, ...patch };
    if (('size' in patch || 'color' in patch) && updated.skuAutoGenerated) {
      updated.sku = autoSku(parentSku, updated.size, updated.color);
    }
    onChange(index, updated);
  }

  async function submitStockIntake() {
    if (!onAddStock || intakeQty <= 0) return;
    setIntakeSaving(true);
    try {
      await onAddStock(index, {
        supplier_id: intakeSupplierId,
        qty: intakeQty,
        cost_price: intakeCost,
        markup_percentage: intakeMarkup,
      });
      setShowStockIntake(false);
      setIntakeQty(0);
    } finally {
      setIntakeSaving(false);
    }
  }

  const cellStyle: React.CSSProperties = {
    padding: '6px 4px',
    verticalAlign: 'middle',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    padding: '0 8px',
    border: '1px solid var(--line)',
    borderRadius: 6,
    background: 'var(--panel)',
    fontSize: 12.5,
    color: 'var(--ink)',
    outline: 'none',
  };

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--line-2)' }}>
        {/* Size */}
        <td style={cellStyle}>
          <input
            style={inputStyle}
            value={row.size}
            onChange={e => update({ size: e.target.value })}
            placeholder="S / 30 / XL"
          />
        </td>

        {/* Colour */}
        <td style={cellStyle}>
          <input
            style={inputStyle}
            value={row.color}
            onChange={e => update({ color: e.target.value })}
            placeholder="Black"
          />
        </td>

        {/* SKU */}
        <td style={cellStyle}>
          <input
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}
            value={row.sku}
            onChange={e => update({ sku: e.target.value, skuAutoGenerated: false })}
            placeholder="Auto"
          />
        </td>

        {/* Barcode */}
        <td style={cellStyle}>
          <input
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}
            value={row.barcode}
            onChange={e => update({ barcode: e.target.value })}
            placeholder="Scan or type"
          />
        </td>

        {/* Qty — editable in add mode, read-only in edit mode for existing variants */}
        <td style={{ ...cellStyle, width: 72 }}>
          {mode === 'edit' && row.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="num" style={{ fontSize: 12.5, color: (row.existing_stock ?? 0) === 0 ? 'var(--danger)' : 'var(--pos)', fontWeight: 600 }}>
                {row.existing_stock ?? 0}
              </span>
              <button
                type="button"
                onClick={() => setShowStockIntake(s => !s)}
                title="Add stock"
                style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--line)', background: showStockIntake ? 'var(--accent-soft)' : 'var(--panel)', color: showStockIntake ? 'var(--accent)' : 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'default', flexShrink: 0 }}
              >
                <Plus size={11} />
              </button>
            </div>
          ) : (
            <input
              style={{ ...inputStyle, textAlign: 'right' }}
              type="number"
              min={0}
              value={row.qty || ''}
              onChange={e => update({ qty: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
          )}
        </td>

        {/* Price */}
        <td style={{ ...cellStyle, width: 100 }}>
          <div style={{ position: 'relative' }}>
            <input
              style={{
                ...inputStyle,
                textAlign: 'right',
                color: isPriceOverridden ? 'var(--ink)' : 'var(--muted)',
                paddingRight: isPriceOverridden ? 22 : 8,
              }}
              type="number"
              min={0}
              value={isPriceOverridden ? row.priceOverride! : (defaultSellingPrice || '')}
              onChange={e => update({ priceOverride: parseFloat(e.target.value) || null })}
              placeholder={defaultSellingPrice ? String(defaultSellingPrice) : '0'}
              onFocus={e => { if (!isPriceOverridden && defaultSellingPrice) update({ priceOverride: defaultSellingPrice }); }}
            />
            {isPriceOverridden && (
              <button
                type="button"
                onClick={() => update({ priceOverride: null })}
                title="Reset to default price"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'default', padding: 0, lineHeight: 0 }}
              >
                <ChevronDown size={11} />
              </button>
            )}
          </div>
        </td>

        {/* Delete */}
        <td style={{ ...cellStyle, width: 32, paddingLeft: 8 }}>
          {!isOnly && (
            <button
              type="button"
              onClick={() => onDelete(index)}
              style={{ width: 24, height: 24, borderRadius: 4, border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'default', display: 'grid', placeItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--faint)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={12} />
            </button>
          )}
        </td>
      </tr>

      {/* Inline stock intake form — edit mode only */}
      {showStockIntake && (
        <tr>
          <td colSpan={7} style={{ padding: '0 4px 10px', background: 'var(--panel-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>
                {[row.size, row.color].filter(Boolean).join(' · ') || 'Default'}
              </span>
              <select
                value={intakeSupplierId}
                onChange={e => setIntakeSupplierId(e.target.value)}
                style={{ height: 30, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--ink)', background: 'var(--panel)' }}
              >
                <option value="">Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="number" min={1} value={intakeQty || ''} onChange={e => setIntakeQty(parseInt(e.target.value) || 0)}
                placeholder="Qty" style={{ width: 64, height: 30, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, textAlign: 'right', background: 'var(--panel)' }} />
              <input type="number" min={0} step="any" value={intakeCost || ''} onChange={e => setIntakeCost(parseFloat(e.target.value) || 0)}
                placeholder="Cost" style={{ width: 80, height: 30, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, textAlign: 'right', background: 'var(--panel)' }} />
              <input type="number" min={0} step="any" value={intakeMarkup || ''} onChange={e => setIntakeMarkup(parseFloat(e.target.value) || 0)}
                placeholder="Markup %" style={{ width: 80, height: 30, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, textAlign: 'right', background: 'var(--panel)' }} />
              <button
                type="button"
                onClick={submitStockIntake}
                disabled={intakeSaving || intakeQty <= 0 || !intakeSupplierId}
                className="btn btn-sm btn-primary"
                style={{ flexShrink: 0 }}
              >
                {intakeSaving ? 'Saving…' : 'Add Batch'}
              </button>
              <button type="button" onClick={() => setShowStockIntake(false)}
                style={{ width: 26, height: 26, borderRadius: 5, border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'default', display: 'grid', placeItems: 'center' }}>
                <X size={13} />
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/products/VariantTableRow.tsx
git commit -m "feat: add VariantTableRow component for add/edit product form"
```

---

### Task 6: Create AddProductPage Component

**Files:**
- Create: `src/components/products/AddProductPage.tsx`

Full-page form with product info, default pricing, and variant table. Handles both add and edit modes.

- [ ] **Step 1: Create the file**

Create `src/components/products/AddProductPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { productService, supplierService } from '../../services';
import { VariantInput } from '../../services/ProductService';
import { VariantTableRow, VariantRowData } from './VariantTableRow';

const CATEGORIES = [
  'T-Shirts', 'Shirts', 'Pants', 'Dresses', 'Skirts',
  'Jackets', 'Shoes', 'Belts', 'Bags', 'Sunglasses',
  'Underwear', 'Socks', 'Fabric', 'Accessories', 'Other',
];

const UNITS = [
  { value: 'piece', label: 'Piece' },
  { value: 'yard', label: 'Yard' },
  { value: 'meter', label: 'Meter' },
  { value: 'pack', label: 'Pack' },
];

interface ProductInfo {
  sku: string;
  name: string;
  brand: string;
  description: string;
  category: string;
  gender: string;
  material: string;
  unit: string;
  image_url: string;
}

interface DefaultPricing {
  supplier_id: string;
  cost_price: number;
  markup_percentage: number;
  selling_price: number;
}

interface AddProductPageProps {
  mode: 'add' | 'edit';
  productId?: string;
  onSave: () => void;
  onCancel: () => void;
  /** Passed from parent to "remember" across Save & Add Next */
  initialBrand?: string;
  initialPricing?: DefaultPricing;
  onSaveAndNext?: (brand: string, pricing: DefaultPricing) => void;
}

function emptyRow(parentSku: string, index: number): VariantRowData {
  return {
    size: '',
    color: '',
    sku: parentSku ? `${parentSku}-${index + 1}` : '',
    skuAutoGenerated: true,
    barcode: '',
    qty: 0,
    priceOverride: null,
    reorder_level: 0,
  };
}

export function AddProductPage({
  mode, productId, onSave, onCancel, initialBrand = '', initialPricing, onSaveAndNext,
}: AddProductPageProps) {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const [info, setInfo] = useState<ProductInfo>({
    sku: '', name: '', brand: initialBrand, description: '',
    category: '', gender: '', material: '', unit: 'piece', image_url: '',
  });

  const [pricing, setPricing] = useState<DefaultPricing>(
    initialPricing ?? { supplier_id: '', cost_price: 0, markup_percentage: 0, selling_price: 0 }
  );

  const [rows, setRows] = useState<VariantRowData[]>([emptyRow('', 0)]);
  const [loadingProduct, setLoadingProduct] = useState(mode === 'edit');

  useEffect(() => {
    supplierService.getActiveSuppliers().then(s => setSuppliers(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'add') {
      productService.generateNextSku().then(sku => {
        setInfo(prev => ({ ...prev, sku }));
        setRows([emptyRow(sku, 0)]);
      }).catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'edit' || !productId) return;
    productService.getProductWithVariants(productId).then(p => {
      if (!p) return;
      setInfo({
        sku: p.sku, name: p.name, brand: (p as any).brand || '',
        description: p.description || '', category: p.category || '',
        gender: (p as any).gender || '', material: (p as any).material || '',
        unit: p.unit, image_url: p.image_url || '',
      });
      if (p.variants.length > 0) {
        const firstBatch = p.variants[0].batches?.[0];
        if (firstBatch) {
          setPricing({
            supplier_id: firstBatch.supplier_id,
            cost_price: firstBatch.cost_price,
            markup_percentage: firstBatch.markup_percentage,
            selling_price: firstBatch.selling_price,
          });
        }
        setRows(p.variants.map(v => ({
          id: v.id,
          size: v.size || '',
          color: v.color || '',
          sku: v.sku,
          skuAutoGenerated: false,
          barcode: v.barcode || '',
          qty: 0,
          priceOverride: null,
          reorder_level: v.reorder_level,
          existing_stock: v.total_stock,
        })));
      }
      setLoadingProduct(false);
    }).catch(() => setLoadingProduct(false));
  }, [mode, productId]);

  function updatePricingCost(cost: number) {
    const selling = parseFloat((cost * (1 + pricing.markup_percentage / 100)).toFixed(2));
    setPricing(p => ({ ...p, cost_price: cost, selling_price: selling }));
  }

  function updatePricingMarkup(markup: number) {
    const selling = parseFloat((pricing.cost_price * (1 + markup / 100)).toFixed(2));
    setPricing(p => ({ ...p, markup_percentage: markup, selling_price: selling }));
  }

  function updatePricingSelling(selling: number) {
    const markup = pricing.cost_price > 0
      ? parseFloat(((selling - pricing.cost_price) / pricing.cost_price * 100).toFixed(2))
      : 0;
    setPricing(p => ({ ...p, selling_price: selling, markup_percentage: markup }));
  }

  const addRow = useCallback(() => {
    setRows(prev => [...prev, emptyRow(info.sku, prev.length)]);
  }, [info.sku]);

  function deleteRow(index: number) {
    setRows(prev => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, row: VariantRowData) {
    setRows(prev => prev.map((r, i) => i === index ? row : r));
  }

  async function handleAddStock(index: number, intake: { supplier_id: string; qty: number; cost_price: number; markup_percentage: number }) {
    if (!productId) return;
    const row = rows[index];
    if (!row.id) return;
    const client = (productService as any).productRepo.adapter.getClient();
    const selling = parseFloat((intake.cost_price * (1 + intake.markup_percentage / 100)).toFixed(2));
    const { error } = await client.from('product_batches').insert({
      variant_id: row.id,
      supplier_id: intake.supplier_id,
      batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      cost_price: intake.cost_price,
      markup_percentage: intake.markup_percentage,
      selling_price: selling,
      initial_quantity: intake.qty,
      current_quantity: intake.qty,
      received_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    // Refresh stock count for this row
    setRows(prev => prev.map((r, i) => i === index
      ? { ...r, existing_stock: (r.existing_stock ?? 0) + intake.qty }
      : r
    ));
    showToast(`Added ${intake.qty} units to stock`, 'success');
  }

  function buildVariantInputs(): VariantInput[] {
    return rows
      .filter(r => !r.id) // only new rows (no existing id)
      .map(r => ({
        size: r.size.trim() || null,
        color: r.color.trim() || null,
        sku: r.sku.trim() || `${info.sku}-${Date.now()}`,
        barcode: r.barcode.trim() || null,
        reorder_level: r.reorder_level,
        qty: r.qty,
        selling_price: r.priceOverride ?? pricing.selling_price,
        cost_price: pricing.cost_price,
        markup_percentage: pricing.markup_percentage,
        supplier_id: pricing.supplier_id,
      }));
  }

  function validate(): string | null {
    if (!info.name.trim()) return 'Product name is required.';
    if (!info.sku.trim()) return 'SKU is required.';
    const newRows = rows.filter(r => !r.id);
    if (mode === 'add' && newRows.length === 0) return 'At least one variant is required.';
    if (newRows.some(r => r.qty > 0 && !pricing.supplier_id)) return 'Select a supplier for stock intake.';
    return null;
  }

  async function doSave(andNext: boolean) {
    const err = validate();
    if (err) { showToast(err, 'error'); return; }
    setSaving(true);
    try {
      if (mode === 'add') {
        const allRows = rows.map(r => ({
          ...r,
          size: r.size.trim() || null,
          color: r.color.trim() || null,
          sku: r.sku.trim() || `${info.sku}-${Date.now()}`,
          barcode: r.barcode.trim() || null,
          selling_price: r.priceOverride ?? pricing.selling_price,
          cost_price: pricing.cost_price,
          markup_percentage: pricing.markup_percentage,
          supplier_id: pricing.supplier_id,
        } as VariantInput));
        await productService.createProductWithVariants(info, allRows);
        showToast(`${info.name} saved — ${rows.length} variant${rows.length > 1 ? 's' : ''} added`, 'success');
      } else if (productId) {
        const newVariants = buildVariantInputs();
        await productService.updateProductWithVariants(productId, info, newVariants);
        showToast('Product updated', 'success');
      }

      if (andNext && onSaveAndNext) {
        onSaveAndNext(info.brand, pricing);
      } else {
        onSave();
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loadingProduct) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };
  const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', outline: 'none', boxSizing: 'border-box' };
  const sectionStyle: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onCancel} className="btn btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={13} /> Products
        </button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {mode === 'add' ? 'Add Product' : 'Edit Product'}
        </h2>
      </div>

      {/* Product Info */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Product Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Brand</label>
            <input style={inputStyle} value={info.brand} onChange={e => setInfo(p => ({ ...p, brand: e.target.value }))} placeholder="Moose, Zara…" />
          </div>
          <div>
            <label style={labelStyle}>SKU <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} value={info.sku}
              onChange={e => { setInfo(p => ({ ...p, sku: e.target.value })); setRows(prev => prev.map(r => r.skuAutoGenerated ? { ...r, sku: `${e.target.value}-${r.size}-${r.color}`.replace(/--+/g, '-').replace(/-$/,'') } : r)); }}
              disabled={mode === 'edit'} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Product Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input style={inputStyle} value={info.name} onChange={e => setInfo(p => ({ ...p, name: e.target.value }))} placeholder="Slim Fit Trouser" />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={info.category} onChange={e => setInfo(p => ({ ...p, category: e.target.value }))}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Gender</label>
            <select style={inputStyle} value={info.gender} onChange={e => setInfo(p => ({ ...p, gender: e.target.value }))}>
              <option value="">Select…</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="kids">Kids</option>
              <option value="unisex">Unisex</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Material</label>
            <input style={inputStyle} value={info.material} onChange={e => setInfo(p => ({ ...p, material: e.target.value }))} placeholder="Cotton, Denim…" />
          </div>
          <div>
            <label style={labelStyle}>Unit</label>
            <select style={inputStyle} value={info.unit} onChange={e => setInfo(p => ({ ...p, unit: e.target.value }))}>
              {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Image URL</label>
            <input style={inputStyle} type="url" value={info.image_url} onChange={e => setInfo(p => ({ ...p, image_url: e.target.value }))} placeholder="https://…" />
          </div>
        </div>
      </div>

      {/* Default Pricing */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Default Pricing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Supplier</label>
            <select style={inputStyle} value={pricing.supplier_id} onChange={e => setPricing(p => ({ ...p, supplier_id: e.target.value }))}>
              <option value="">Select supplier…</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cost (LKR)</label>
            <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step="any" value={pricing.cost_price || ''} onChange={e => updatePricingCost(parseFloat(e.target.value) || 0)} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Markup %</label>
            <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step="any" value={pricing.markup_percentage || ''} onChange={e => updatePricingMarkup(parseFloat(e.target.value) || 0)} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Selling (LKR)</label>
            <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} step="any" value={pricing.selling_price || ''} onChange={e => updatePricingSelling(parseFloat(e.target.value) || 0)} placeholder="0" />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          This price applies to all variants below. Click a price cell in the table to override for a specific variant.
        </div>
      </div>

      {/* Variants */}
      <div style={{ ...sectionStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--line-2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Variants <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--faint)', textTransform: 'none', letterSpacing: 0 }}>({rows.length})</span>
          </div>
          <button type="button" onClick={addRow} className="btn btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={12} /> Add Row
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)' }}>
                {['Size', 'Colour', 'SKU', 'Barcode', 'Qty / Stock', 'Price (LKR)', ''].map(h => (
                  <th key={h} style={{ padding: '8px 4px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <VariantTableRow
                  key={row.id ?? i}
                  row={row}
                  index={i}
                  defaultSellingPrice={pricing.selling_price}
                  defaultCostPrice={pricing.cost_price}
                  defaultMarkup={pricing.markup_percentage}
                  defaultSupplierId={pricing.supplier_id}
                  suppliers={suppliers}
                  mode={mode}
                  parentSku={info.sku}
                  isOnly={rows.length === 1}
                  onChange={updateRow}
                  onDelete={deleteRow}
                  onAddStock={mode === 'edit' ? handleAddStock : undefined}
                  onTabFromLastCell={i === rows.length - 1 ? addRow : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 32 }}>
        <button type="button" onClick={onCancel} className="btn">Cancel</button>
        {mode === 'add' && onSaveAndNext && (
          <button type="button" onClick={() => doSave(true)} disabled={saving} className="btn">
            {saving ? 'Saving…' : 'Save & Add Next'}
          </button>
        )}
        <button type="button" onClick={() => doSave(false)} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : mode === 'add' ? 'Save Product' : 'Update Product'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: any remaining type errors should be in `Products.tsx` only (not yet updated).

- [ ] **Step 3: Commit**

```bash
git add src/components/products/AddProductPage.tsx
git commit -m "feat: add AddProductPage full-page add/edit form with inline variant table"
```

---

### Task 7: Update Products.tsx to Use Page Routing

**Files:**
- Modify: `src/components/Products.tsx`

Replace the modal-based add/edit flow with a page-view state. When `pageView !== 'list'`, render `AddProductPage` instead of the table.

- [ ] **Step 1: Add import for AddProductPage at the top of Products.tsx**

Add to the existing imports:

```tsx
import { AddProductPage } from './products/AddProductPage';
import { DefaultPricing } from './products/AddProductPage'; // won't exist yet — we export it below
```

Wait — we need to export `DefaultPricing` from `AddProductPage.tsx`. Add this export to `AddProductPage.tsx` (the interface defined in Task 6):

In `src/components/products/AddProductPage.tsx`, change `interface DefaultPricing` to `export interface DefaultPricing`.

- [ ] **Step 2: Add page view state to Products.tsx**

In `src/components/Products.tsx`, add these state variables after the existing state declarations:

```tsx
const [pageView, setPageView] = useState<'list' | 'add' | 'edit'>('list');
const [editProductId, setEditProductId] = useState<string | null>(null);
const [rememberedBrand, setRememberedBrand] = useState('');
const [rememberedPricing, setRememberedPricing] = useState<DefaultPricing | undefined>(undefined);
```

- [ ] **Step 3: Add helper functions to Products.tsx**

Add these functions after `openAddStockModal`:

```tsx
function openAddPage() {
  setPageView('add');
  setEditProductId(null);
}

function openEditPage(product: ProductWithStock) {
  setEditProductId(product.id);
  setPageView('edit');
}

function closePage() {
  setPageView('list');
  setEditProductId(null);
  refetch();
}

function handleSaveAndNext(brand: string, pricing: DefaultPricing) {
  setRememberedBrand(brand);
  setRememberedPricing(pricing);
  refetch();
  // pageView stays 'add' — AddProductPage will re-mount via key
  setEditProductId(null);
  // Force remount of AddProductPage by toggling and back
  setPageView('list');
  setTimeout(() => setPageView('add'), 0);
}
```

- [ ] **Step 4: Replace the modal "Add Product" button click handler**

Find the button that calls `openAddModal()` (typically in the page header area) and change it to call `openAddPage()`. Also change `onEdit` in `ProductTable` to call `openEditPage(product)` instead of `openEditModal(product)`.

- [ ] **Step 5: Add page-view rendering at the top of the return statement**

In the `return` of `Products.tsx`, wrap the existing content to show `AddProductPage` when `pageView !== 'list'`:

```tsx
if (pageView === 'add' || pageView === 'edit') {
  return (
    <AddProductPage
      mode={pageView}
      productId={editProductId ?? undefined}
      onSave={closePage}
      onCancel={closePage}
      initialBrand={rememberedBrand}
      initialPricing={rememberedPricing}
      onSaveAndNext={pageView === 'add' ? handleSaveAndNext : undefined}
    />
  );
}
```

Place this block before the existing `return (` that renders the full products page.

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Products.tsx src/components/products/AddProductPage.tsx
git commit -m "feat: replace product modal with full-page add/edit view"
```

---

### Task 8: Update ProductTable Row Layout

**Files:**
- Modify: `src/components/products/ProductTable.tsx`

Show brand + category on each row, use `base_price` instead of latest batch price, add `+Stock` shortcut button, remove the separate "View" button (edit page now covers it).

- [ ] **Step 1: Replace the entire ProductTable component**

Replace `src/components/products/ProductTable.tsx` with:

```tsx
import { Edit, PackagePlus, Printer } from 'lucide-react';
import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';

interface ProductTableProps {
  products: ProductWithStock[];
  onEdit: (product: ProductWithStock) => void;
  onAddStock: (product: ProductWithStock) => void;
  onPrintBarcode: (product: ProductWithStock) => void;
  isAdmin: boolean;
}

export function ProductTable({ products, onEdit, onAddStock, onPrintBarcode, isAdmin }: ProductTableProps) {
  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--panel-2)', borderBottom: '1px solid var(--line)' }}>
            {['Product', 'SKU', 'Stock', ...(isAdmin ? ['Base Price'] : []), 'Actions'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product, i) => {
            const stock = product.total_stock;
            const stockColor = stock === 0 ? 'var(--danger)' : stock <= 5 ? 'var(--warn)' : 'var(--pos)';
            const meta = [
              (product as any).brand,
              product.category,
              (product as any).gender,
            ].filter(Boolean).join(' · ');

            return (
              <tr
                key={product.id}
                style={{ borderBottom: i === products.length - 1 ? 'none' : '1px solid var(--line-2)', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Product name + meta */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProductImage imageUrl={product.image_url} alt={product.name} size="sm" />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                        {product.name}
                      </div>
                      {meta && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{meta}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* SKU */}
                <td style={{ padding: '12px 16px' }}>
                  <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{product.sku}</span>
                </td>

                {/* Stock */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600, color: stockColor }}>{stock}</span>
                    <span style={{ fontSize: 11, color: 'var(--faint)' }}>units</span>
                  </div>
                  <div style={{ marginTop: 4, height: 3, width: 56, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, stock * 3)}%`, background: stockColor, borderRadius: 2 }} />
                  </div>
                </td>

                {/* Base price (admin only) */}
                {isAdmin && (
                  <td style={{ padding: '12px 16px' }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {(product as any).base_price > 0 ? `LKR ${(product as any).base_price.toLocaleString()}` : '—'}
                    </span>
                  </td>
                )}

                {/* Actions */}
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => onAddStock(product)}
                          title="Add Stock"
                          className="btn btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                        >
                          <PackagePlus size={13} /> Stock
                        </button>
                        <button
                          onClick={() => onEdit(product)}
                          title="Edit"
                          style={{ width: 28, height: 28, padding: 0, borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--muted)', cursor: 'default', display: 'grid', placeItems: 'center', transition: 'all .1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => onPrintBarcode(product)}
                          title="Print Barcode"
                          style={{ width: 28, height: 28, padding: 0, borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: 'var(--muted)', cursor: 'default', display: 'grid', placeItems: 'center', transition: 'all .1s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
                        >
                          <Printer size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        {products.length === 0 && (
          <tfoot>
            <tr>
              <td colSpan={99} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
                No products found
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Update Products.tsx to pass the new props to ProductTable**

In `Products.tsx`, find the `<ProductTable>` usage and update it — remove `onView` prop (no longer needed), ensure `onEdit` calls `openEditPage`:

```tsx
<ProductTable
  products={products as ProductWithStock[]}
  onEdit={openEditPage}
  onAddStock={openAddStockModal}
  onPrintBarcode={(p) => setBarcodeProduct(p)}
  isAdmin={isAdmin}
/>
```

- [ ] **Step 3: Final build verification**

```bash
npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/products/ProductTable.tsx src/components/Products.tsx
git commit -m "feat: update product table with brand/meta row, base_price, +Stock shortcut"
```

---

### Task 9: Manual Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:5173` and log in.

- [ ] **Step 2: Verify stock counts are correct on Dashboard**

Go to Dashboard. The KPI card "Low Stock SKUs" and the Stock Alerts panel should now show accurate counts (not zero for variant products). If a product has variants with stock, it should no longer appear as out-of-stock.

- [ ] **Step 3: Verify Add Product flow**

Click Products → "Add Product" button. Verify:
- Full-page form opens (not a modal)
- SKU auto-generates
- Default Pricing section computes selling price when cost + markup entered
- Clicking "+ Add Row" adds a new variant row
- SKU in each row auto-generates from parent SKU + size + colour
- Clicking a price cell overrides it; the `↓` resets it
- "Save Product" saves and returns to list
- "Save & Add Next" saves and clears name/variants but keeps brand/supplier/pricing

- [ ] **Step 4: Verify Edit Product flow**

Click Edit on an existing product. Verify:
- Form pre-fills correctly
- Existing variants show stock count (read-only)
- `+` button on a variant row opens the inline Add Batch form
- Adding a batch updates the stock count displayed in the row
- New variant rows can be added and saved

- [ ] **Step 5: Verify product list**

- Brand and category visible on each row without opening the product
- Stock counts are correct (sum of all variants)
- Base price shows correctly for admin users
- `+Stock` and Edit buttons work

- [ ] **Step 6: Stop dev server**

`Ctrl+C`
