# RIVONLAK Clothing Retail POS — Conversion Design

**Date:** 2026-05-21  
**Base system:** gasithmotors.lk (spare parts POS)  
**Target:** Full clothing retail POS for RIVONLAK

---

## 1. Overview

Convert the existing spare parts POS into a clothing retail POS for RIVONLAK. The core architecture (React + TypeScript + Vite + Supabase, repository/service pattern, roles, auth) stays unchanged. The conversion adapts the domain model for clothing retail: product variants (size × color), flexible units, loyalty points, and updated branding.

---

## 2. Data Model Changes

### 2.1 `products` table — becomes "styles"

**Add columns:**
- `brand` (text, nullable) — e.g., Nike, Zara, local brand
- `gender` (enum: `men | women | kids | unisex`, nullable)
- `material` (text, nullable) — e.g., Cotton, Polyester

**Keep:** `id`, `sku`, `name`, `description`, `category`, `image_url`, `active`, `unit`

**`unit` values extended:** `piece | yard | meter | pack`  
(Previously automotive units — replaced with retail units)

**`category` values updated to clothing:**  
T-Shirts, Shirts, Pants, Dresses, Skirts, Jackets, Shoes, Belts, Bags, Sunglasses, Underwear, Socks, Accessories, Fabric, Other

**Remove:** nothing at the products table level (all removed fields were already not here)

---

### 2.2 New `product_variants` table

Each row represents one sellable size × color combination of a style.

```sql
product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references products(id) not null,
  size            text,           -- "S","M","L","XL","UK 7","44 inch","One Size", etc.
  color           text,           -- "Red","Black Frame","Floral Print", etc. (nullable)
  sku             text unique not null,
  barcode         text unique,
  reorder_level   integer default 0,
  active          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
)
```

- `size` and `color` are free-text — no fixed enum — so all categories (shoes, belts, sunglasses, fabric) work without schema changes.
- `color` is nullable for items that only vary by size.

---

### 2.3 `product_batches` table

**Change:** `product_id` → `variant_id` (uuid references product_variants)  
**Remove:** `expiry_date` (not relevant for clothing)  
**Keep:** `batch_number`, `supplier_id`, `purchase_order_id`, `cost_price`, `selling_price`, `markup_percentage`, `initial_quantity`, `current_quantity`, `received_date`, `notes`

---

### 2.4 `sale_items` table

**Add:** `variant_id` (uuid references product_variants, nullable)  
**Remove:** `warranty_duration`, `warranty_unit`, `warranty_type`  
**Keep:** all other columns  
**Note:** `quantity` supports decimals (numeric) for fabric sold by yard/meter.

---

### 2.5 `return_items` table

**Add:** `variant_id` (uuid references product_variants, nullable)  
**Keep:** `batch_id`, `sale_item_id`, `product_id`, `quantity`, `unit_price`, `subtotal`  
**Note:** `quantity` supports decimals for fabric returns.

---

### 2.6 `referral_agents` table — repurposed as "Sales Staff"

**Change:** `type` enum from `garage | individual` → `full_time | part_time`  
**UI rename:** "Referral Agents" → "Sales Staff", "Referral Commissions" → "Staff Commissions"  
**No structural changes** to commissions logic.

---

### 2.7 `customers` table

**Add:** `loyalty_points` (integer default 0) — current redeemable balance

---

### 2.8 New `loyalty_transactions` table

Audit log for every points earn/redeem event.

```sql
loyalty_transactions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references customers(id) not null,
  sale_id         uuid references sales(id) nullable,
  type            text check (type in ('earn', 'redeem')),
  points          integer not null,    -- positive for earn, negative for redeem
  balance_after   integer not null,
  notes           text,
  created_at      timestamptz default now()
)
```

---

### 2.9 Settings (new keys)

Two new configurable values stored in a new `app_settings` key-value table (id, key, value) and editable from the Settings page:
- `loyalty_earn_rate` — LKR per point earned (e.g., 100 = 1 point per 100 LKR)
- `loyalty_redeem_rate` — points per LKR discount (e.g., 100 = 100 points → 100 LKR off)

---

## 3. Component Changes

### 3.1 Branding
- App title, login page, favicon, invoice header → **RIVONLAK**
- Remove all "Gasith Motors" / automotive references from UI text

### 3.2 Products Page
- Product list shows **style cards**: name, brand, gender, material, category, total stock
- Click a style → **variant management panel**: grid of size × color cells with stock per variant
- "Add Variant" button per style to create new size+color combinations
- Variant-level barcode generation (each variant gets its own barcode)
- ProductForm adds fields: Brand, Gender, Material, Unit (piece/yard/meter/pack)

### 3.3 POS — Variant Picker (main flow change)

**Standard items (piece/pack):**
1. Cashier searches for a style name or scans a variant barcode
2. If searched by style: variant picker popup opens (size × color grid)
3. Cashier taps cell → quantity input (integer) → added to cart
4. If scanned by barcode: variant resolved directly, go to quantity input

**Fabric items (yard/meter):**
1. Search or scan as above
2. Variant picker opens (shows width/color options)
3. Quantity input accepts decimals (e.g., 3.5)

**Cart line item format:**  
`[Style Name] · [Color] · [Size] · qty × price`  
(Color/size omitted if null)

**Loyalty points at checkout:**
- If a customer is selected, show their current points balance
- "Redeem points" toggle → points converted to LKR discount
- Points earned calculated on final sale amount, recorded after payment
- If no customer is selected, loyalty points are not tracked for that sale (walk-in / anonymous)

### 3.4 Invoice
- Header: **RIVONLAK** (name, address, contact)
- Line items: include size + color + unit (e.g., "2.5 meters")
- Loyalty points earned shown at bottom of receipt
- Warranty section removed

### 3.5 Returns
- Return flow unchanged: find sale → select items → choose refund method
- `return_items` now references `variant_id` — stock restored to correct variant batch
- Decimal quantities supported for fabric returns

### 3.6 Sales Staff (renamed from Referral Agents)
- Page renamed to "Sales Staff"
- Type options: Full-time / Part-time
- Commission logic unchanged

### 3.7 Dashboard
- **Updated metrics:**
  - Low stock alerts show variant detail (Style · Color · Size — N left)
  - "Today's Top Sellers" widget: top items by quantity sold today
- **Kept metrics:** revenue today/week/month, recent sales

### 3.8 Reports
- **New/updated:**
  - Sales by variant (size, color breakdown)
  - Sales by brand / gender / category
  - Stock levels by variant (full size × color grid per style)
  - Fabric report: total yards/meters sold per product
  - Low stock by variant
- **Kept:** sales history, returns, purchase orders, customer credit, staff commissions
- **Loyalty report:** points earned vs redeemed per period, top loyalty customers

---

## 4. Removed Features

| Feature | Reason |
|---------|--------|
| Warranty fields (sale_items) | Not applicable to clothing |
| Expiry date (product_batches) | Not applicable to clothing |
| Garage / Individual agent types | Replaced by Full-time / Part-time |

---

## 5. Supabase Migrations Required

1. Add `brand`, `gender`, `material` columns to `products`
2. Update `unit` check constraint to `piece | yard | meter | pack`
3. Create `product_variants` table
4. Alter `product_batches`: replace `product_id` with `variant_id`, drop `expiry_date`
5. Alter `sale_items`: add `variant_id`, drop warranty columns, change `quantity` to numeric
6. Alter `return_items`: add `variant_id`, change `quantity` to numeric
7. Alter `referral_agents.type` enum to `full_time | part_time`
8. Add `loyalty_points` to `customers`
9. Create `loyalty_transactions` table
10. Add loyalty settings (earn rate, redeem rate)

---

## 6. What Is NOT Changing

- Auth system (admin / cashier roles)
- Repository / service layer architecture
- Suppliers and Purchase Orders flow
- Customer credit management
- Payment methods (cash / card / credit / mixed)
- Barcode scanning
- Batch inventory tracking
- Toast notifications, modals, UI component library
