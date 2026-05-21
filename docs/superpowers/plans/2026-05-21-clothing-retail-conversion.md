# RIVONLAK Clothing Retail Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the gasithmotors.lk spare parts POS into RIVONLAK, a full clothing retail POS with product variants (size × color), flexible units (piece/yard/meter/pack), customer loyalty points, and sales staff commissions.

**Architecture:** The existing React + TypeScript + Supabase + repository/service pattern is preserved throughout. A new `product_variants` table sits between `products` (styles) and `product_batches` (inventory). All stock, sales, and return operations reference `variant_id` instead of `product_id` directly.

**Tech Stack:** React 18, TypeScript 5, Vite, Tailwind CSS, Supabase JS v2, Lucide React, Recharts. No unit test framework — verification is `npm run typecheck` (tsc --noEmit) plus running `npm run dev` and checking the UI.

**Verification commands:**
- Type check: `npm run typecheck` (must exit 0)
- Dev server: `npm run dev` (open browser to confirm UI works)

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260521000001_clothing_retail_conversion.sql` | All DB schema changes |
| `src/repositories/VariantRepository.ts` | CRUD for product_variants |
| `src/repositories/LoyaltyRepository.ts` | CRUD for loyalty_transactions + app_settings |
| `src/services/VariantService.ts` | Variant business logic |
| `src/services/LoyaltyService.ts` | Points earn/redeem logic |
| `src/hooks/useVariants.ts` | React hook for variant state |
| `src/components/products/VariantGrid.tsx` | Size × color grid display + stock |
| `src/components/products/VariantForm.tsx` | Add/edit single variant |
| `src/components/pos/VariantPicker.tsx` | POS popup — pick size+color |
| `src/components/pos/LoyaltyPanel.tsx` | Loyalty points display + redeem at checkout |

### Modified files
| File | Change |
|------|--------|
| `src/lib/database.types.ts` | Add product_variants, loyalty_transactions, app_settings tables |
| `src/types/index.ts` | Add ProductVariant, LoyaltyTransaction, AppSetting types; update CartItem |
| `src/repositories/index.ts` | Export VariantRepository, LoyaltyRepository |
| `src/repositories/ProductRepository.ts` | Queries use variant_id; add variant barcode lookup |
| `src/services/index.ts` | Export VariantService, LoyaltyService |
| `src/services/SalesService.ts` | CreateSaleInput includes variant_id; loyalty points recorded post-sale |
| `src/services/ReturnService.ts` | Return items include variant_id |
| `src/components/Layout.tsx` | RIVONLAK branding; "Referral Agents" → "Sales Staff" |
| `src/components/Login.tsx` | RIVONLAK branding |
| `src/components/products/ProductForm.tsx` | Add brand, gender, material, updated unit options |
| `src/components/Products.tsx` | Variant panel below product row |
| `src/components/POS.tsx` | Integrate VariantPicker and LoyaltyPanel |
| `src/components/pos/CartItemsList.tsx` | Show size/color on cart rows |
| `src/components/pos/ProductGrid.tsx` | Show style cards (not variant cards) |
| `src/components/pos/ProductSearchList.tsx` | Search resolves to style; opens VariantPicker |
| `src/components/Returns.tsx` | variant_id in return items |
| `src/components/ReferralAgents.tsx` | Rename to Sales Staff throughout |
| `src/components/Dashboard.tsx` | Today's Top Sellers widget; variant-level low stock |
| `src/components/Reports.tsx` | Sales by brand/gender/category/variant; loyalty report |
| `src/components/Settings.tsx` | Loyalty earn/redeem rate fields |
| `src/components/invoice/receiptHTML.ts` | RIVONLAK header; size/color on line items |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260521000001_clothing_retail_conversion.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260521000001_clothing_retail_conversion.sql

-- 1. Add clothing attributes to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('men', 'women', 'kids', 'unisex')),
  ADD COLUMN IF NOT EXISTS material text;

-- Update unit constraint to include clothing units
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;
ALTER TABLE products ADD CONSTRAINT products_unit_check
  CHECK (unit IN ('piece', 'yard', 'meter', 'pack'));

-- 2. Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size            text,
  color           text,
  sku             text UNIQUE NOT NULL,
  barcode         text UNIQUE,
  reorder_level   integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);

-- 3. Update product_batches: replace product_id with variant_id, drop expiry_date
ALTER TABLE product_batches
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id);

ALTER TABLE product_batches DROP COLUMN IF EXISTS expiry_date;

-- 4. Update sale_items: add variant_id, remove warranty fields, numeric quantity
ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id);

ALTER TABLE sale_items DROP COLUMN IF EXISTS warranty_duration;
ALTER TABLE sale_items DROP COLUMN IF EXISTS warranty_unit;
ALTER TABLE sale_items DROP COLUMN IF EXISTS warranty_type;

-- Make quantity numeric to support fabric (yards/meters)
ALTER TABLE sale_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- 5. Update return_items: add variant_id, numeric quantity
ALTER TABLE return_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id);

ALTER TABLE return_items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- 6. Update referral_agents type enum
ALTER TABLE referral_agents DROP CONSTRAINT IF EXISTS referral_agents_type_check;
ALTER TABLE referral_agents ADD CONSTRAINT referral_agents_type_check
  CHECK (type IN ('full_time', 'part_time'));

-- 7. Add loyalty_points to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0;

-- 8. Create loyalty_transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id       uuid REFERENCES sales(id) ON DELETE SET NULL,
  type          text NOT NULL CHECK (type IN ('earn', 'redeem')),
  points        integer NOT NULL,
  balance_after integer NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_transactions(customer_id);

-- 9. Create app_settings key-value table
CREATE TABLE IF NOT EXISTS app_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default loyalty rates
INSERT INTO app_settings (key, value)
VALUES
  ('loyalty_earn_rate', '100'),
  ('loyalty_redeem_rate', '100')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

```bash
# If using Supabase CLI linked to remote:
npx supabase db push

# OR run the SQL directly in the Supabase dashboard SQL editor.
# Paste the contents of the migration file and execute.
```

Expected: no errors. Confirm `product_variants` table exists in Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260521000001_clothing_retail_conversion.sql
git commit -m "feat: add clothing retail DB migration"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new tables to `database.types.ts`**

In `src/lib/database.types.ts`, inside the `Tables` object add after `referral_commissions`:

```typescript
      product_variants: {
        Row: {
          id: string
          product_id: string
          size: string | null
          color: string | null
          sku: string
          barcode: string | null
          reorder_level: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          size?: string | null
          color?: string | null
          sku: string
          barcode?: string | null
          reorder_level?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          size?: string | null
          color?: string | null
          sku?: string
          barcode?: string | null
          reorder_level?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      loyalty_transactions: {
        Row: {
          id: string
          customer_id: string
          sale_id: string | null
          type: 'earn' | 'redeem'
          points: number
          balance_after: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          sale_id?: string | null
          type: 'earn' | 'redeem'
          points: number
          balance_after: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          sale_id?: string | null
          type?: 'earn' | 'redeem'
          points?: number
          balance_after?: number
          notes?: string | null
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          created_at?: string
          updated_at?: string
        }
      }
```

Also update `products` Row to include the new columns:
```typescript
          // Add to products Row:
          brand: string | null
          gender: 'men' | 'women' | 'kids' | 'unisex' | null
          material: string | null
```

And update `customers` Row:
```typescript
          // Add to customers Row:
          loyalty_points: number
```

- [ ] **Step 2: Add new domain types to `src/types/index.ts`**

Replace the entire `src/types/index.ts` with:

```typescript
import { Database } from '../lib/database.types';

export type Product = Database['public']['Tables']['products']['Row'];
export type ProductBatch = Database['public']['Tables']['product_batches']['Row'] & {
  markup_percentage?: number;
  supplier?: { name: string };
};
export type ProductVariant = Database['public']['Tables']['product_variants']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type ReferralAgent = Database['public']['Tables']['referral_agents']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'] & {
  is_manual?: boolean;
  manual_description?: string | null;
};
export type Return = Database['public']['Tables']['returns']['Row'];
export type ReturnItem = Database['public']['Tables']['return_items']['Row'];
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type LoyaltyTransaction = Database['public']['Tables']['loyalty_transactions']['Row'];
export type AppSetting = Database['public']['Tables']['app_settings']['Row'];

export interface ProductWithStock extends Product {
  batches: ProductBatch[];
  total_stock: number;
}

export interface ProductWithBatches extends Product {
  batches: ProductBatch[];
  total_stock: number;
  search_words?: string[];
}

export interface VariantWithStock extends ProductVariant {
  batches: ProductBatch[];
  total_stock: number;
}

export interface ProductWithVariants extends Product {
  variants: VariantWithStock[];
  total_stock: number;
}

export interface CartItem {
  product: Product;
  variant: ProductVariant;
  batch: ProductBatch;
  quantity: number;
  price: number;
  original_price: number;
  isManual?: boolean;
  manualDescription?: string;
}
```

- [ ] **Step 3: Verify types compile**

```bash
npm run typecheck
```

Expected: errors only from files that reference removed fields (warranty, old CartItem shape). These will be fixed in subsequent tasks. If you see errors ONLY in those expected locations, this task is done.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts src/types/index.ts
git commit -m "feat: add clothing retail TypeScript types"
```

---

## Task 3: VariantRepository

**Files:**
- Create: `src/repositories/VariantRepository.ts`
- Modify: `src/repositories/index.ts`

- [ ] **Step 1: Create `src/repositories/VariantRepository.ts`**

```typescript
import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { ProductVariant, VariantWithStock, ProductBatch } from '../types';

export class VariantRepository extends BaseRepository<ProductVariant> {
  constructor(adapter: DatabaseAdapter) {
    super(adapter, 'product_variants');
  }

  async findByProductId(productId: string): Promise<VariantWithStock[]> {
    const variants = await this.query({
      where: [{ field: 'product_id', operator: '=', value: productId }],
      orderBy: [{ field: 'size', direction: 'asc' }],
    });

    if (variants.length === 0) return [];

    const variantIds = variants.map(v => v.id);
    const client = (this.adapter as any).getClient();
    const { data: batches, error } = await client
      .from('product_batches')
      .select('*, supplier:suppliers(name)')
      .in('variant_id', variantIds);

    if (error) throw new Error(`Failed to fetch variant batches: ${error.message}`);

    const batchesByVariant = new Map<string, ProductBatch[]>();
    for (const batch of (batches as ProductBatch[])) {
      const vid = (batch as any).variant_id as string;
      if (!batchesByVariant.has(vid)) batchesByVariant.set(vid, []);
      batchesByVariant.get(vid)!.push(batch);
    }

    return variants.map(v => {
      const vBatches = batchesByVariant.get(v.id) || [];
      return {
        ...v,
        batches: vBatches,
        total_stock: vBatches.reduce((sum, b) => sum + b.current_quantity, 0),
      };
    });
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    const results = await this.query({
      where: [{ field: 'barcode', operator: '=', value: barcode }],
      limit: 1,
    });
    return results[0] || null;
  }

  async findBySku(sku: string): Promise<ProductVariant | null> {
    const results = await this.query({
      where: [{ field: 'sku', operator: '=', value: sku }],
      limit: 1,
    });
    return results[0] || null;
  }

  async findLowStock(): Promise<Array<VariantWithStock & { product_name: string }>> {
    const client = (this.adapter as any).getClient();
    const { data: variants, error } = await client
      .from('product_variants')
      .select('*, product:products(name)')
      .eq('active', true);

    if (error) throw new Error(`Low stock query failed: ${error.message}`);

    const variantIds = (variants as any[]).map(v => v.id);
    const { data: batches } = await client
      .from('product_batches')
      .select('variant_id, current_quantity')
      .in('variant_id', variantIds);

    const stockMap = new Map<string, number>();
    for (const b of (batches as any[]) || []) {
      stockMap.set(b.variant_id, (stockMap.get(b.variant_id) || 0) + Number(b.current_quantity));
    }

    return (variants as any[])
      .map(v => ({
        ...v,
        batches: [],
        total_stock: stockMap.get(v.id) || 0,
        product_name: v.product?.name || '',
      }))
      .filter(v => v.total_stock <= v.reorder_level);
  }
}
```

- [ ] **Step 2: Export from `src/repositories/index.ts`**

Add to the existing exports in `src/repositories/index.ts`:

```typescript
export { VariantRepository } from './VariantRepository';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no new errors from these files.

- [ ] **Step 4: Commit**

```bash
git add src/repositories/VariantRepository.ts src/repositories/index.ts
git commit -m "feat: add VariantRepository"
```

---

## Task 4: LoyaltyRepository

**Files:**
- Create: `src/repositories/LoyaltyRepository.ts`
- Modify: `src/repositories/index.ts`

- [ ] **Step 1: Create `src/repositories/LoyaltyRepository.ts`**

```typescript
import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { LoyaltyTransaction, AppSetting } from '../types';

export class LoyaltyRepository extends BaseRepository<LoyaltyTransaction> {
  constructor(adapter: DatabaseAdapter) {
    super(adapter, 'loyalty_transactions');
  }

  async findByCustomerId(customerId: string): Promise<LoyaltyTransaction[]> {
    return this.query({
      where: [{ field: 'customer_id', operator: '=', value: customerId }],
      orderBy: [{ field: 'created_at', direction: 'desc' }],
    });
  }

  async getSetting(key: string): Promise<string | null> {
    const client = (this.adapter as any).getClient();
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error) return null;
    return (data as AppSetting)?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const client = (this.adapter as any).getClient();
    await client
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  }

  async addPoints(customerId: string, points: number, saleId: string | null, currentBalance: number): Promise<void> {
    const client = (this.adapter as any).getClient();
    const newBalance = currentBalance + points;
    await client.from('loyalty_transactions').insert({
      customer_id: customerId,
      sale_id: saleId,
      type: 'earn',
      points,
      balance_after: newBalance,
    });
    await client
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId);
  }

  async redeemPoints(customerId: string, points: number, saleId: string | null, currentBalance: number): Promise<void> {
    if (points > currentBalance) throw new Error('Insufficient loyalty points.');
    const client = (this.adapter as any).getClient();
    const newBalance = currentBalance - points;
    await client.from('loyalty_transactions').insert({
      customer_id: customerId,
      sale_id: saleId,
      type: 'redeem',
      points: -points,
      balance_after: newBalance,
    });
    await client
      .from('customers')
      .update({ loyalty_points: newBalance })
      .eq('id', customerId);
  }
}
```

- [ ] **Step 2: Export from `src/repositories/index.ts`**

Add:
```typescript
export { LoyaltyRepository } from './LoyaltyRepository';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/repositories/LoyaltyRepository.ts src/repositories/index.ts
git commit -m "feat: add LoyaltyRepository"
```

---

## Task 5: VariantService

**Files:**
- Create: `src/services/VariantService.ts`
- Modify: `src/services/index.ts`

- [ ] **Step 1: Create `src/services/VariantService.ts`**

```typescript
import { VariantRepository } from '../repositories/VariantRepository';
import { ProductVariant, VariantWithStock, ProductWithVariants } from '../types';
import { logger } from '../lib/logger';

export class VariantService {
  constructor(private variantRepo: VariantRepository) {}

  async getVariantsForProduct(productId: string): Promise<VariantWithStock[]> {
    try {
      return await this.variantRepo.findByProductId(productId);
    } catch (error) {
      logger.error('Failed to fetch variants', error as Error, { productId });
      throw new Error('Unable to load product variants.');
    }
  }

  async createVariant(data: {
    product_id: string;
    size: string | null;
    color: string | null;
    sku: string;
    barcode?: string | null;
    reorder_level?: number;
  }): Promise<ProductVariant> {
    try {
      const existing = await this.variantRepo.findBySku(data.sku);
      if (existing) throw new Error(`SKU "${data.sku}" is already in use.`);

      return await this.variantRepo.create({
        product_id: data.product_id,
        size: data.size || null,
        color: data.color || null,
        sku: data.sku,
        barcode: data.barcode || null,
        reorder_level: data.reorder_level ?? 0,
        active: true,
      });
    } catch (error) {
      logger.error('Failed to create variant', error as Error);
      throw error;
    }
  }

  async updateVariant(id: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
    try {
      return await this.variantRepo.update(id, data);
    } catch (error) {
      logger.error('Failed to update variant', error as Error);
      throw new Error('Unable to update variant.');
    }
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    return this.variantRepo.findByBarcode(barcode);
  }

  async getLowStockVariants(): Promise<Array<VariantWithStock & { product_name: string }>> {
    try {
      return await this.variantRepo.findLowStock();
    } catch (error) {
      logger.error('Failed to fetch low stock variants', error as Error);
      return [];
    }
  }
}
```

- [ ] **Step 2: Export from `src/services/index.ts`**

Add to existing exports:
```typescript
export { VariantService } from './VariantService';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/services/VariantService.ts src/services/index.ts
git commit -m "feat: add VariantService"
```

---

## Task 6: LoyaltyService

**Files:**
- Create: `src/services/LoyaltyService.ts`
- Modify: `src/services/index.ts`

- [ ] **Step 1: Create `src/services/LoyaltyService.ts`**

```typescript
import { LoyaltyRepository } from '../repositories/LoyaltyRepository';
import { logger } from '../lib/logger';

export class LoyaltyService {
  constructor(private loyaltyRepo: LoyaltyRepository) {}

  async getEarnRate(): Promise<number> {
    const val = await this.loyaltyRepo.getSetting('loyalty_earn_rate');
    return val ? parseInt(val, 10) : 100;
  }

  async getRedeemRate(): Promise<number> {
    const val = await this.loyaltyRepo.getSetting('loyalty_redeem_rate');
    return val ? parseInt(val, 10) : 100;
  }

  async setEarnRate(lkrPerPoint: number): Promise<void> {
    await this.loyaltyRepo.setSetting('loyalty_earn_rate', String(lkrPerPoint));
  }

  async setRedeemRate(pointsPerLkr: number): Promise<void> {
    await this.loyaltyRepo.setSetting('loyalty_redeem_rate', String(pointsPerLkr));
  }

  /** Calculate points earned for a given sale amount */
  async calculatePointsEarned(saleAmount: number): Promise<number> {
    const rate = await this.getEarnRate();
    return Math.floor(saleAmount / rate);
  }

  /** Calculate LKR discount for a given number of points */
  async calculateRedemptionValue(points: number): Promise<number> {
    const rate = await this.getRedeemRate();
    return Math.floor(points / rate) * rate / rate;
  }

  async earnPoints(customerId: string, saleAmount: number, saleId: string, currentBalance: number): Promise<number> {
    try {
      const points = await this.calculatePointsEarned(saleAmount);
      if (points > 0) {
        await this.loyaltyRepo.addPoints(customerId, points, saleId, currentBalance);
      }
      return points;
    } catch (error) {
      logger.error('Failed to earn loyalty points', error as Error);
      throw error;
    }
  }

  async redeemPoints(customerId: string, points: number, saleId: string | null, currentBalance: number): Promise<void> {
    try {
      await this.loyaltyRepo.redeemPoints(customerId, points, saleId, currentBalance);
    } catch (error) {
      logger.error('Failed to redeem loyalty points', error as Error);
      throw error;
    }
  }

  async getCustomerHistory(customerId: string) {
    return this.loyaltyRepo.findByCustomerId(customerId);
  }
}
```

- [ ] **Step 2: Export from `src/services/index.ts`**

Add:
```typescript
export { LoyaltyService } from './LoyaltyService';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/services/LoyaltyService.ts src/services/index.ts
git commit -m "feat: add LoyaltyService"
```

---

## Task 7: Update SalesService for Variants + Loyalty

**Files:**
- Modify: `src/services/SalesService.ts`

- [ ] **Step 1: Update `CreateSaleInput` interface**

In `src/services/SalesService.ts`, replace the `CreateSaleInput` interface:

```typescript
export interface CreateSaleInput {
  customer_id?: string | null;
  cashier_id: string;
  referral_agent_id?: string | null;
  items: Array<{
    product_id?: string | null;
    variant_id?: string | null;
    batch_id?: string | null;
    quantity: number;
    unit_price: number;
    selling_price: number;
    cost_price: number;
    is_manual?: boolean;
    manual_description?: string;
  }>;
  payment_method: 'cash' | 'card' | 'credit' | 'mixed';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  notes?: string;
  referral_commission_rate?: number;
  service_charge?: number;
  loyalty_points_redeemed?: number;
  customer_loyalty_balance?: number;
}
```

- [ ] **Step 2: Update `saleItems` mapping in `createSale` to include `variant_id` and remove warranty**

In the `createSale` method, replace the `saleItems` mapping block:

```typescript
const saleItems: Partial<SaleItem>[] = input.items.map(item => ({
  product_id: item.product_id || null,
  variant_id: item.variant_id || null,
  batch_id: item.batch_id || null,
  quantity: item.quantity,
  unit_price: item.unit_price,
  selling_price: item.selling_price,
  cost_price: item.cost_price,
  subtotal: item.quantity * item.unit_price,
  is_manual: item.is_manual || false,
  manual_description: item.manual_description || null,
}));
```

- [ ] **Step 3: Add loyalty points earning after sale creation**

In `createSale`, after the line `const sale = await this.saleRepo.createWithItems(saleData, saleItems);`, add:

```typescript
// Earn loyalty points for customer (if customer provided and not a credit sale)
if (input.customer_id && input.customer_loyalty_balance !== undefined) {
  try {
    const loyaltyService = (this as any)._loyaltyService as import('./LoyaltyService').LoyaltyService | undefined;
    if (loyaltyService) {
      await loyaltyService.earnPoints(
        input.customer_id,
        input.total_amount,
        sale.id,
        input.customer_loyalty_balance
      );
    }
  } catch (loyaltyErr) {
    logger.error('Loyalty points earn failed (non-fatal)', loyaltyErr as Error);
  }
}
```

> **Note:** The `loyaltyService` is injected optionally. Wire it up in the POS component directly (Task 14) rather than through the constructor to avoid cascading service refactors.

- [ ] **Step 4: Update `validateSaleInput` — remove warranty references**

In `validateSaleInput`, remove the check for `item.product_id || item.batch_id` or update it to also accept `variant_id`:

```typescript
// Regular items must have batch reference
if (!item.is_manual && !item.batch_id) {
  throw new Error('Regular items must have a batch.');
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/services/SalesService.ts
git commit -m "feat: update SalesService for variant_id and loyalty points"
```

---

## Task 8: Branding — Layout and Login

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Login.tsx`

- [ ] **Step 1: Update `Layout.tsx` — RIVONLAK brand + rename nav item**

In `src/components/Layout.tsx`:

1. Change the brand block (lines ~112–122) to:
```tsx
<div className="flex items-center gap-3">
  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
    <span className="text-white font-bold text-xs">RV</span>
  </div>
  <div className="flex flex-col">
    <span className="font-bold text-lg tracking-wide">RIVONLAK</span>
    <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] -mt-1">Fashion</span>
  </div>
</div>
```

2. In the `navigation` array, change `'Referral Agents'` to `'Sales Staff'`:
```typescript
{ name: 'Sales Staff', icon: UserCheck, view: 'referral-agents', roles: ['admin'] },
```

3. In `navGroups`, rename the PARTIES group label (optional aesthetic improvement):
```typescript
{ title: 'PARTIES', items: ['customers', 'suppliers', 'referral-agents'] },
```

- [ ] **Step 2: Update `Login.tsx` — RIVONLAK branding**

Open `src/components/Login.tsx` and find any text that says "Gasith Motors" or "GASITH" and replace with "RIVONLAK". Also update the subtitle text from "Motors" or automotive references to "Fashion Retail".

- [ ] **Step 3: Run dev server and visually confirm**

```bash
npm run dev
```

Open browser. Confirm sidebar shows "RIVONLAK / Fashion" and nav shows "Sales Staff" instead of "Referral Agents".

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.tsx src/components/Login.tsx
git commit -m "feat: RIVONLAK branding — layout and login"
```

---

## Task 9: ProductForm — Clothing Attributes

**Files:**
- Modify: `src/components/products/ProductForm.tsx`

- [ ] **Step 1: Add brand, gender, material fields to the form state**

In `src/components/products/ProductForm.tsx`, find the form state initializer and add:

```typescript
const [brand, setBrand] = useState(product?.brand || '');
const [gender, setGender] = useState<'men' | 'women' | 'kids' | 'unisex' | ''>(
  (product?.gender as any) || ''
);
const [material, setMaterial] = useState(product?.material || '');
```

- [ ] **Step 2: Update the unit options**

Find the `unit` select/input in the form and ensure its options are:
```tsx
<select value={unit} onChange={e => setUnit(e.target.value)}>
  <option value="piece">Piece</option>
  <option value="yard">Yard</option>
  <option value="meter">Meter</option>
  <option value="pack">Pack</option>
</select>
```

- [ ] **Step 3: Update category options to clothing categories**

Replace existing categories with:
```typescript
const CATEGORIES = [
  'T-Shirts', 'Shirts', 'Pants', 'Dresses', 'Skirts',
  'Jackets', 'Shoes', 'Belts', 'Bags', 'Sunglasses',
  'Underwear', 'Socks', 'Fabric', 'Accessories', 'Other'
];
```

- [ ] **Step 4: Add the three new fields to the form JSX**

After the existing category field, add:

```tsx
{/* Brand */}
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
  <input
    type="text"
    value={brand}
    onChange={e => setBrand(e.target.value)}
    placeholder="e.g. Nike, Zara"
    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>

{/* Gender */}
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
  <select
    value={gender}
    onChange={e => setGender(e.target.value as any)}
    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="">Select...</option>
    <option value="men">Men</option>
    <option value="women">Women</option>
    <option value="kids">Kids</option>
    <option value="unisex">Unisex</option>
  </select>
</div>

{/* Material */}
<div>
  <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
  <input
    type="text"
    value={material}
    onChange={e => setMaterial(e.target.value)}
    placeholder="e.g. Cotton, Polyester"
    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
</div>
```

- [ ] **Step 5: Include new fields in the form submit payload**

In the `handleSubmit` function, add to the product data object:
```typescript
brand: brand || null,
gender: gender || null,
material: material || null,
```

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/components/products/ProductForm.tsx
git commit -m "feat: add brand, gender, material, clothing units to ProductForm"
```

---

## Task 10: Variant Management UI

**Files:**
- Create: `src/components/products/VariantForm.tsx`
- Create: `src/components/products/VariantGrid.tsx`

- [ ] **Step 1: Create `src/components/products/VariantForm.tsx`**

```tsx
import { useState } from 'react';
import { ProductVariant } from '../../types';

interface VariantFormProps {
  productId: string;
  productSku: string;
  onSave: (data: {
    size: string | null;
    color: string | null;
    sku: string;
    barcode: string | null;
    reorder_level: number;
  }) => Promise<void>;
  onCancel: () => void;
  initial?: Partial<ProductVariant>;
}

export function VariantForm({ productId, productSku, onSave, onCancel, initial }: VariantFormProps) {
  const [size, setSize] = useState(initial?.size || '');
  const [color, setColor] = useState(initial?.color || '');
  const [sku, setSku] = useState(initial?.sku || `${productSku}-${Date.now()}`);
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [reorderLevel, setReorderLevel] = useState(initial?.reorder_level ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) { setError('SKU is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        size: size.trim() || null,
        color: color.trim() || null,
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        reorder_level: reorderLevel,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save variant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Size</label>
          <input value={size} onChange={e => setSize(e.target.value)} placeholder="S / M / L / UK 7 / 44in"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
          <input value={color} onChange={e => setColor(e.target.value)} placeholder="Red / Black Frame"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SKU *</label>
          <input value={sku} onChange={e => setSku(e.target.value)} required
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Barcode</label>
          <input value={barcode} onChange={e => setBarcode(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reorder Level</label>
          <input type="number" min={0} value={reorderLevel} onChange={e => setReorderLevel(Number(e.target.value))}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Variant'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/components/products/VariantGrid.tsx`**

```tsx
import { useState } from 'react';
import { Plus, Edit2 } from 'lucide-react';
import { VariantWithStock, Product } from '../../types';
import { VariantForm } from './VariantForm';

interface VariantGridProps {
  product: Product;
  variants: VariantWithStock[];
  onAddVariant: (data: {
    size: string | null;
    color: string | null;
    sku: string;
    barcode: string | null;
    reorder_level: number;
  }) => Promise<void>;
  onUpdateVariant: (id: string, data: { size?: string | null; color?: string | null; active?: boolean }) => Promise<void>;
}

export function VariantGrid({ product, variants, onAddVariant, onUpdateVariant }: VariantGridProps) {
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (data: Parameters<typeof onAddVariant>[0]) => {
    await onAddVariant(data);
    setShowForm(false);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Variants ({variants.length})</h4>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Variant
        </button>
      </div>

      {showForm && (
        <VariantForm
          productId={product.id}
          productSku={product.sku}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {variants.length === 0 && !showForm && (
        <p className="text-xs text-slate-400 italic">No variants yet. Add a size/color combination to start tracking stock.</p>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-left">Color</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Reorder At</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id} className={`border-t border-slate-100 ${!v.active ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2">{v.size || '—'}</td>
                  <td className="px-3 py-2">{v.color || '—'}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{v.sku}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${v.total_stock <= v.reorder_level ? 'text-red-600' : 'text-slate-800'}`}>
                    {v.total_stock}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{v.reorder_level}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${v.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {v.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/components/products/VariantForm.tsx src/components/products/VariantGrid.tsx
git commit -m "feat: add VariantForm and VariantGrid components"
```

---

## Task 11: useVariants Hook + Wire Variant Grid into Products Page

**Files:**
- Create: `src/hooks/useVariants.ts`
- Modify: `src/components/Products.tsx`

- [ ] **Step 1: Create `src/hooks/useVariants.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { VariantWithStock } from '../types';
import { supabase } from '../lib/supabase';
import { SupabaseAdapter } from '../repositories/base/SupabaseAdapter';
import { VariantRepository } from '../repositories/VariantRepository';
import { VariantService } from '../services/VariantService';

const adapter = new SupabaseAdapter(supabase);
const variantRepo = new VariantRepository(adapter);
const variantService = new VariantService(variantRepo);

export function useVariants(productId: string | null) {
  const [variants, setVariants] = useState<VariantWithStock[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!productId) { setVariants([]); return; }
    setLoading(true);
    try {
      const data = await variantService.getVariantsForProduct(productId);
      setVariants(data);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const addVariant = async (data: Parameters<typeof variantService.createVariant>[0]) => {
    await variantService.createVariant(data);
    await load();
  };

  const updateVariant = async (id: string, data: Parameters<typeof variantService.updateVariant>[1]) => {
    await variantService.updateVariant(id, data);
    await load();
  };

  return { variants, loading, addVariant, updateVariant, reload: load };
}
```

- [ ] **Step 2: Wire `VariantGrid` into `Products.tsx`**

In `src/components/Products.tsx`, find the `ProductDetailsView` or product row expansion area. Import `VariantGrid` and `useVariants`, then render the grid when a product row is expanded/selected:

```tsx
import { VariantGrid } from './products/VariantGrid';
import { useVariants } from '../hooks/useVariants';

// Inside the product detail/expand section:
function ProductVariantSection({ product }: { product: Product }) {
  const { variants, loading, addVariant, updateVariant } = useVariants(product.id);
  if (loading) return <p className="text-xs text-slate-400 p-3">Loading variants…</p>;
  return (
    <VariantGrid
      product={product}
      variants={variants}
      onAddVariant={data => addVariant({ ...data, product_id: product.id })}
      onUpdateVariant={updateVariant}
    />
  );
}
```

Render `<ProductVariantSection product={selectedProduct} />` wherever the product detail panel is shown.

- [ ] **Step 3: Typecheck, run dev server, confirm variant grid appears**

```bash
npm run typecheck
npm run dev
```

Open Products page, select a product — variant grid should appear at the bottom.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useVariants.ts src/components/Products.tsx
git commit -m "feat: variant management in Products page"
```

---

## Task 12: POS — VariantPicker Component

**Files:**
- Create: `src/components/pos/VariantPicker.tsx`

- [ ] **Step 1: Create `src/components/pos/VariantPicker.tsx`**

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { Product, ProductVariant, ProductBatch, VariantWithStock } from '../../types';

interface VariantPickerProps {
  product: Product;
  variants: VariantWithStock[];
  onSelect: (variant: ProductVariant, batch: ProductBatch, quantity: number) => void;
  onClose: () => void;
}

export function VariantPicker({ product, variants, onSelect, onClose }: VariantPickerProps) {
  const [selectedVariant, setSelectedVariant] = useState<VariantWithStock | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const isDecimal = product.unit === 'yard' || product.unit === 'meter';
  const unitLabel = product.unit === 'yard' ? 'yd' : product.unit === 'meter' ? 'm' : product.unit === 'pack' ? 'pk' : 'pc';

  const activeVariants = variants.filter(v => v.active && v.total_stock > 0);

  const getActiveBatch = (variant: VariantWithStock): ProductBatch | null => {
    return variant.batches
      .filter(b => b.current_quantity > 0)
      .sort((a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime())[0] || null;
  };

  const handleConfirm = () => {
    if (!selectedVariant) return;
    const batch = getActiveBatch(selectedVariant);
    if (!batch) return;
    if (quantity <= 0) return;
    onSelect(selectedVariant, batch, quantity);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">{product.name}</h3>
            <p className="text-xs text-slate-500">{product.brand} · {product.category} · sold per {product.unit}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {activeVariants.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No stock available for any variant.</p>
          )}
          {activeVariants.map(v => {
            const batch = getActiveBatch(v);
            const isSelected = selectedVariant?.id === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span className="font-medium">
                  {[v.size, v.color].filter(Boolean).join(' · ') || v.sku}
                </span>
                <span className="text-xs text-slate-500">
                  {v.total_stock} {unitLabel} in stock
                  {batch && ` · LKR ${batch.selling_price.toLocaleString()}`}
                </span>
              </button>
            );
          })}
        </div>

        {selectedVariant && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Quantity ({unitLabel})</label>
              <input
                type="number"
                min={isDecimal ? 0.1 : 1}
                step={isDecimal ? 0.1 : 1}
                value={quantity}
                onChange={e => setQuantity(isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value))}
                className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleConfirm}
              disabled={quantity <= 0}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Add to Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/components/pos/VariantPicker.tsx
git commit -m "feat: VariantPicker component for POS"
```

---

## Task 13: POS — LoyaltyPanel Component

**Files:**
- Create: `src/components/pos/LoyaltyPanel.tsx`

- [ ] **Step 1: Create `src/components/pos/LoyaltyPanel.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Customer } from '../../types';

interface LoyaltyPanelProps {
  customer: Customer | null;
  totalAmount: number;
  earnRate: number;        // LKR per point
  redeemRate: number;      // points per LKR
  onRedeemChange: (pointsToRedeem: number, lkrDiscount: number) => void;
}

export function LoyaltyPanel({ customer, totalAmount, earnRate, redeemRate, onRedeemChange }: LoyaltyPanelProps) {
  const [redeeming, setRedeeming] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const pointsToEarn = Math.floor(totalAmount / earnRate);
  const maxRedeemablePoints = customer?.loyalty_points ?? 0;
  const lkrPerPoint = 1; // 1 point = 1 LKR discount (rate controls earn, not redeem value)
  const lkrDiscount = pointsToRedeem * lkrPerPoint;

  useEffect(() => {
    if (!redeeming) {
      setPointsToRedeem(0);
      onRedeemChange(0, 0);
    }
  }, [redeeming]);

  useEffect(() => {
    onRedeemChange(pointsToRedeem, lkrDiscount);
  }, [pointsToRedeem]);

  if (!customer) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-800">
            {customer.loyalty_points.toLocaleString()} points
          </span>
        </div>
        <span className="text-xs text-amber-600">+{pointsToEarn} pts this sale</span>
      </div>

      {maxRedeemablePoints > 0 && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={redeeming}
            onChange={e => setRedeeming(e.target.checked)}
            className="rounded text-amber-500"
          />
          <span className="text-xs text-amber-700">Redeem points for discount</span>
        </label>
      )}

      {redeeming && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={maxRedeemablePoints}
            step={1}
            value={pointsToRedeem}
            onChange={e => setPointsToRedeem(Math.min(Number(e.target.value), maxRedeemablePoints))}
            className="w-20 border border-amber-300 rounded px-2 py-1 text-sm text-center focus:outline-none"
          />
          <span className="text-xs text-amber-700">pts = LKR {lkrDiscount.toLocaleString()} off</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/components/pos/LoyaltyPanel.tsx
git commit -m "feat: LoyaltyPanel component for POS checkout"
```

---

## Task 14: Wire VariantPicker + LoyaltyPanel into POS

**Files:**
- Modify: `src/components/POS.tsx`
- Modify: `src/components/pos/CartItemsList.tsx`

- [ ] **Step 1: Import new components and hooks in `POS.tsx`**

At the top of `src/components/POS.tsx`, add:
```tsx
import { VariantPicker } from './pos/VariantPicker';
import { LoyaltyPanel } from './pos/LoyaltyPanel';
import { useVariants } from '../hooks/useVariants';
```

- [ ] **Step 2: Add state for variant picker and loyalty in `POS.tsx`**

Inside the POS component, add:
```tsx
const [pickerProduct, setPickerProduct] = useState<ProductWithVariants | null>(null);
const { variants: pickerVariants } = useVariants(pickerProduct?.id || null);
const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
```

- [ ] **Step 3: When a product is selected from search/grid, open VariantPicker**

Replace the existing "add to cart" logic for product selection with:
```tsx
const handleProductSelect = (product: Product) => {
  setPickerProduct(product as any);
};
```

When VariantPicker `onSelect` fires:
```tsx
const handleVariantSelect = (variant: ProductVariant, batch: ProductBatch, quantity: number) => {
  addToCart({
    product: pickerProduct!,
    variant,
    batch,
    quantity,
    price: batch.selling_price,
    original_price: batch.selling_price,
  });
  setPickerProduct(null);
};
```

- [ ] **Step 4: Render VariantPicker overlay**

```tsx
{pickerProduct && (
  <VariantPicker
    product={pickerProduct}
    variants={pickerVariants}
    onSelect={handleVariantSelect}
    onClose={() => setPickerProduct(null)}
  />
)}
```

- [ ] **Step 5: Render LoyaltyPanel in checkout area**

In the checkout/payment section of POS, after the customer selector:
```tsx
<LoyaltyPanel
  customer={selectedCustomer}
  totalAmount={cartTotal}
  earnRate={100}
  redeemRate={100}
  onRedeemChange={(pts, lkr) => {
    setLoyaltyPointsToRedeem(pts);
    setLoyaltyDiscount(lkr);
  }}
/>
```

Apply `loyaltyDiscount` to the total shown and pass `loyalty_points_redeemed` and `customer_loyalty_balance` to `createSale`.

- [ ] **Step 6: Update `CartItemsList.tsx` to show size/color**

In `src/components/pos/CartItemsList.tsx`, find the product name display and update to show variant info:

```tsx
// In the cart item row, after the product name:
{item.variant && (
  <span className="text-xs text-slate-400 ml-1">
    {[item.variant.color, item.variant.size].filter(Boolean).join(' · ')}
  </span>
)}
```

- [ ] **Step 7: Typecheck, run dev, test POS flow**

```bash
npm run typecheck
npm run dev
```

Go to POS, search a product — variant picker should open. Select size+color — item should appear in cart with variant info. If customer selected, loyalty panel should appear.

- [ ] **Step 8: Commit**

```bash
git add src/components/POS.tsx src/components/pos/CartItemsList.tsx
git commit -m "feat: integrate VariantPicker and LoyaltyPanel into POS"
```

---

## Task 15: Returns — Variant-Aware

**Files:**
- Modify: `src/components/Returns.tsx`
- Modify: `src/services/ReturnService.ts`

- [ ] **Step 1: Update `ReturnService.ts` — include `variant_id` in return items**

In `src/services/ReturnService.ts`, find the return item creation logic and ensure `variant_id` is passed through:

```typescript
// In the return items mapping, add:
variant_id: item.variant_id || null,
```

Also update the `CreateReturnInput` interface if it exists to include:
```typescript
items: Array<{
  sale_item_id?: string | null;
  product_id: string;
  variant_id?: string | null;
  batch_id: string;
  quantity: number;
  unit_price: number;
}>;
```

- [ ] **Step 2: Update `Returns.tsx` — show variant info on return items**

In `src/components/Returns.tsx`, find where return items are listed/previewed and add variant size/color display:

```tsx
// After product name in return item row:
{item.variant_id && (
  <span className="text-xs text-slate-400">
    {/* Fetch variant label from sale item details */}
    {item.size && item.color ? `${item.color} · ${item.size}` : item.size || item.color || ''}
  </span>
)}
```

Also ensure the return quantity input allows decimals (for fabric returns):
```tsx
<input type="number" step={0.1} min={0.1} ... />
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/components/Returns.tsx src/services/ReturnService.ts
git commit -m "feat: variant-aware returns"
```

---

## Task 16: Rename Referral Agents → Sales Staff

**Files:**
- Modify: `src/components/ReferralAgents.tsx`

- [ ] **Step 1: Replace all user-visible text in `ReferralAgents.tsx`**

In `src/components/ReferralAgents.tsx`:

| Find | Replace |
|------|---------|
| `Referral Agent` | `Sales Staff` |
| `referral agent` | `sales staff` |
| `Referral Agents` | `Sales Staff` |
| `Commission Agent` | `Sales Staff` |
| `"garage"` option label | `"Full-time"` |
| `"individual"` option label | `"Part-time"` |
| `type === 'garage'` | `type === 'full_time'` |
| `type === 'individual'` | `type === 'part_time'` |

The type select field should become:
```tsx
<select value={type} onChange={e => setType(e.target.value as any)}>
  <option value="">Select type…</option>
  <option value="full_time">Full-time</option>
  <option value="part_time">Part-time</option>
</select>
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run typecheck
git add src/components/ReferralAgents.tsx
git commit -m "feat: rename Referral Agents to Sales Staff"
```

---

## Task 17: Dashboard — Today's Top Sellers + Variant Low Stock

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Add "Today's Top Sellers" widget**

In `src/components/Dashboard.tsx`, add a new async data fetch for today's top sellers. Add to the existing data loading logic:

```typescript
// In the dashboard data loading useEffect or hook:
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const { data: todaySaleItems } = await supabase
  .from('sale_items')
  .select('quantity, product_id, variant_id, products(name), product_variants(size, color)')
  .gte('created_at', todayStart.toISOString());

// Aggregate by product name + variant
const topMap = new Map<string, number>();
for (const item of todaySaleItems || []) {
  const variantLabel = [
    (item.product_variants as any)?.color,
    (item.product_variants as any)?.size
  ].filter(Boolean).join(' · ');
  const key = `${(item.products as any)?.name || 'Unknown'}${variantLabel ? ` (${variantLabel})` : ''}`;
  topMap.set(key, (topMap.get(key) || 0) + Number(item.quantity));
}
const todayTopSellers = Array.from(topMap.entries())
  .map(([name, qty]) => ({ name, qty }))
  .sort((a, b) => b.qty - a.qty)
  .slice(0, 5);
```

- [ ] **Step 2: Render "Today's Top Sellers" card**

```tsx
<div className="bg-white rounded-xl border border-slate-200 p-5">
  <h3 className="text-sm font-semibold text-slate-700 mb-3">Today's Top Sellers</h3>
  {todayTopSellers.length === 0 ? (
    <p className="text-xs text-slate-400">No sales today yet.</p>
  ) : (
    <div className="space-y-2">
      {todayTopSellers.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="text-slate-700 truncate">{item.name}</span>
          <span className="font-semibold text-slate-800 ml-2">{item.qty}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Update low stock alerts to show variant detail**

Replace product-level low stock alerts with variant-level. Import and use `VariantService`:

```typescript
import { VariantService } from '../services/VariantService';
// ...
const lowStockVariants = await variantService.getLowStockVariants();
```

Render each alert as:
```tsx
{lowStockVariants.map(v => (
  <div key={v.id} className="flex items-center justify-between text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
    <span>{v.product_name} · {[v.color, v.size].filter(Boolean).join(' · ')}</span>
    <span className="font-semibold">{v.total_stock} left</span>
  </div>
))}
```

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add src/components/Dashboard.tsx
git commit -m "feat: today's top sellers and variant-level low stock on dashboard"
```

---

## Task 18: Reports — Clothing Dimensions

**Files:**
- Modify: `src/components/Reports.tsx`

- [ ] **Step 1: Add "Sales by Brand" report section**

In `src/components/Reports.tsx`, add a new report query:

```typescript
const { data: brandSales } = await supabase
  .from('sale_items')
  .select('subtotal, products(brand)')
  .gte('created_at', startDate)
  .lte('created_at', endDate);

const brandMap = new Map<string, number>();
for (const item of brandSales || []) {
  const brand = (item.products as any)?.brand || 'Unbranded';
  brandMap.set(brand, (brandMap.get(brand) || 0) + Number(item.subtotal));
}
const brandData = Array.from(brandMap.entries())
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value);
```

Render as a bar chart using existing Recharts setup.

- [ ] **Step 2: Add "Sales by Gender" and "Sales by Category" similar to Step 1**

Same pattern, join to `products(gender)` and `products(category)` respectively.

- [ ] **Step 3: Add "Sales by Variant (Top Sizes)" report**

```typescript
const { data: variantSales } = await supabase
  .from('sale_items')
  .select('quantity, product_variants(size, color)')
  .gte('created_at', startDate)
  .lte('created_at', endDate)
  .not('variant_id', 'is', null);

const sizeMap = new Map<string, number>();
for (const item of variantSales || []) {
  const size = (item.product_variants as any)?.size || 'No Size';
  sizeMap.set(size, (sizeMap.get(size) || 0) + Number(item.quantity));
}
const sizeData = Array.from(sizeMap.entries())
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value);
```

- [ ] **Step 4: Add Loyalty Report section**

```typescript
const { data: loyaltyData } = await supabase
  .from('loyalty_transactions')
  .select('type, points, created_at')
  .gte('created_at', startDate)
  .lte('created_at', endDate);

const earned = (loyaltyData || []).filter(t => t.type === 'earn').reduce((s, t) => s + t.points, 0);
const redeemed = (loyaltyData || []).filter(t => t.type === 'redeem').reduce((s, t) => s + Math.abs(t.points), 0);
```

Display as a simple summary card: "Points Earned: X | Points Redeemed: Y".

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/components/Reports.tsx
git commit -m "feat: clothing reports — brand, gender, category, variant, loyalty"
```

---

## Task 19: Settings — Loyalty Rates

**Files:**
- Modify: `src/components/Settings.tsx`

- [ ] **Step 1: Load loyalty rates on mount**

In `src/components/Settings.tsx`, add:

```typescript
const [earnRate, setEarnRate] = useState(100);
const [redeemRate, setRedeemRate] = useState(100);
const [savingLoyalty, setSavingLoyalty] = useState(false);

useEffect(() => {
  supabase.from('app_settings').select('key, value')
    .in('key', ['loyalty_earn_rate', 'loyalty_redeem_rate'])
    .then(({ data }) => {
      for (const row of data || []) {
        if (row.key === 'loyalty_earn_rate') setEarnRate(parseInt(row.value));
        if (row.key === 'loyalty_redeem_rate') setRedeemRate(parseInt(row.value));
      }
    });
}, []);
```

- [ ] **Step 2: Add loyalty settings UI**

```tsx
<div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
  <h3 className="font-semibold text-slate-800">Loyalty Points</h3>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Earn Rate (LKR per 1 point)
      </label>
      <input type="number" min={1} value={earnRate}
        onChange={e => setEarnRate(parseInt(e.target.value))}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p className="text-xs text-slate-400 mt-1">Customer earns 1 point per LKR {earnRate} spent</p>
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Redeem Rate (points per LKR discount)
      </label>
      <input type="number" min={1} value={redeemRate}
        onChange={e => setRedeemRate(parseInt(e.target.value))}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p className="text-xs text-slate-400 mt-1">{redeemRate} points = LKR 1 discount</p>
    </div>
  </div>
  <button
    onClick={async () => {
      setSavingLoyalty(true);
      await supabase.from('app_settings')
        .upsert([
          { key: 'loyalty_earn_rate', value: String(earnRate) },
          { key: 'loyalty_redeem_rate', value: String(redeemRate) },
        ], { onConflict: 'key' });
      setSavingLoyalty(false);
    }}
    disabled={savingLoyalty}
    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
  >
    {savingLoyalty ? 'Saving…' : 'Save Loyalty Settings'}
  </button>
</div>
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/components/Settings.tsx
git commit -m "feat: loyalty earn/redeem rate settings"
```

---

## Task 20: Invoice — RIVONLAK Branding + Variant Line Items

**Files:**
- Modify: `src/components/invoice/receiptHTML.ts`

- [ ] **Step 1: Update shop name and remove warranty section**

In `src/components/invoice/receiptHTML.ts`, find any occurrences of "Gasith Motors", "GASITH", or "gasithmotors" and replace with "RIVONLAK".

Replace the header section's shop name:
```typescript
// Find the shop name string in the HTML template and replace:
'RIVONLAK'
// subtitle:
'Fashion Retail'
```

Remove any block that renders warranty information (search for `warranty` in the file and delete that conditional block).

- [ ] **Step 2: Update line item rendering to show size + color**

Find the sale item row rendering. After the product name, append variant info:

```typescript
// In the item row HTML string:
const variantLabel = item.variant
  ? `<span style="font-size:10px;color:#94a3b8;display:block;">${[item.variant.color, item.variant.size].filter(Boolean).join(' · ')}</span>`
  : '';

// Insert variantLabel after the product name cell content
```

Also show the unit for fabric items:
```typescript
const qtyDisplay = item.unit && item.unit !== 'piece'
  ? `${item.quantity} ${item.unit}`
  : `${item.quantity}`;
```

- [ ] **Step 3: Add loyalty points earned to receipt footer**

At the bottom of the receipt, after the totals, add:
```typescript
${loyaltyPointsEarned > 0
  ? `<div style="...">Points earned this sale: +${loyaltyPointsEarned} pts</div>`
  : ''
}
${customer?.loyalty_points !== undefined
  ? `<div style="...">Total points balance: ${customer.loyalty_points} pts</div>`
  : ''
}
```

- [ ] **Step 4: Typecheck, run dev, print a test receipt**

```bash
npm run typecheck
npm run dev
```

Complete a test sale in POS and preview the invoice. Confirm "RIVONLAK" appears in header, size/color on line items, and warranty section is gone.

- [ ] **Step 5: Commit**

```bash
git add src/components/invoice/receiptHTML.ts
git commit -m "feat: RIVONLAK invoice branding, variant line items, loyalty footer"
```

---

## Task 21: Final Typecheck + Push

- [ ] **Step 1: Full typecheck**

```bash
npm run typecheck
```

Expected: exit 0 with no errors.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Step 3: Push to retail remote**

```bash
git push retail dev
```

- [ ] **Step 4: Confirm on GitHub**

Open `https://github.com/Lunor-Labs/retail-pos` and verify all commits are present on the `dev` branch.

---

## Self-Review Checklist (completed inline)

- [x] DB migration covers all 10 schema changes from spec
- [x] `product_variants` table created with correct columns
- [x] `loyalty_transactions` and `app_settings` tables created
- [x] TypeScript types added for all new tables
- [x] `VariantRepository`, `VariantService` cover CRUD + low stock
- [x] `LoyaltyRepository`, `LoyaltyService` cover earn/redeem/settings
- [x] `SalesService.CreateSaleInput` updated: `variant_id` added, warranty removed
- [x] POS: VariantPicker opens on product select, handles decimal qty for fabric
- [x] POS: LoyaltyPanel shows only when customer selected (walk-in = no points)
- [x] Cart rows show size + color
- [x] Returns: `variant_id` in return items, decimal qty for fabric
- [x] Referral Agents renamed Sales Staff, type values updated
- [x] Dashboard: today's top sellers + variant-level low stock alerts
- [x] Reports: brand, gender, category, variant size, loyalty summary
- [x] Settings: loyalty earn/redeem rate persisted to `app_settings`
- [x] Invoice: RIVONLAK branding, warranty removed, variant info on items, loyalty footer
