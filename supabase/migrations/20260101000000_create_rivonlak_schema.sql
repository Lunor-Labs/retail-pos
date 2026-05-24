/*
  ============================================================
  RIVONLAK — Clothing Retail POS — Complete Fresh Schema
  ============================================================

  Run this entire file in the Supabase SQL Editor on a fresh
  (empty) project to set up the full database.

  Tables
  ──────
  1.  user_profiles          — staff accounts (admin / cashier)
  2.  suppliers              — fabric & clothing suppliers
  3.  products               — clothing styles (master catalog)
  4.  product_variants       — size × color combinations per style
  5.  product_batches        — stock arrivals per variant
  6.  purchase_orders        — orders placed with suppliers
  7.  purchase_order_items   — line items in purchase orders
  8.  customers              — customer accounts with credit & loyalty
  9.  sales_staff            — staff who earn commissions (referral_agents)
  10. sales                  — sale transactions
  11. sale_items             — line items in sales
  12. returns                — return transactions
  13. return_items           — line items in returns
  14. staff_commissions      — commission tracking (referral_commissions)
  15. loyalty_transactions   — loyalty points earn / redeem log
  16. app_settings           — key-value store for app config

  Security
  ────────
  - RLS enabled on all tables
  - get_current_user_role() helper avoids infinite recursion
  - Admin: full access everywhere
  - Cashier: read most tables, create sales / returns / customers
*/

-- ============================================================
-- HELPER FUNCTION (avoids RLS infinite recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  RETURN user_role;
END;
$$;


-- ============================================================
-- 1. USER PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin', 'cashier')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON user_profiles FOR SELECT TO authenticated
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Admin can insert profiles"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update profiles"
  ON user_profiles FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');


-- ============================================================
-- 2. SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  contact_person text,
  phone          text,
  email          text,
  address        text,
  notes          text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert suppliers"
  ON suppliers FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update suppliers"
  ON suppliers FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can delete suppliers"
  ON suppliers FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');


-- ============================================================
-- 3. PRODUCTS (clothing styles — master catalog)
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  category      text,               -- T-Shirts, Shirts, Pants, Shoes, Fabric, etc.
  brand         text,               -- Nike, Zara, local brand, etc.
  gender        text CHECK (gender IN ('men', 'women', 'kids', 'unisex')),
  material      text,               -- Cotton, Polyester, Leather, etc.
  unit          text NOT NULL DEFAULT 'piece'
                     CHECK (unit IN ('piece', 'yard', 'meter', 'pack')),
  image_url     text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update products"
  ON products FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');


-- ============================================================
-- 4. PRODUCT VARIANTS (size × color per style)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size          text,               -- S / M / L / XL / UK 7 / 44 inch / One Size
  color         text,               -- Red / Black Frame / Floral Print (nullable)
  sku           text UNIQUE NOT NULL,
  barcode       text UNIQUE,
  reorder_level integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode    ON product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku        ON product_variants(sku);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product variants"
  ON product_variants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert product variants"
  ON product_variants FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update product variants"
  ON product_variants FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can delete product variants"
  ON product_variants FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');


-- ============================================================
-- 5. PURCHASE ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number     text UNIQUE NOT NULL,
  supplier_id   uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  order_date    date NOT NULL DEFAULT CURRENT_DATE,
  received_date date,
  status        text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'received', 'cancelled')),
  total_amount  decimal(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes         text,
  created_by    uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase orders"
  ON purchase_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert purchase orders"
  ON purchase_orders FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update purchase orders"
  ON purchase_orders FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');


-- ============================================================
-- 6. PURCHASE ORDER ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          uuid REFERENCES products(id) ON DELETE RESTRICT,
  quantity            integer NOT NULL CHECK (quantity > 0),
  cost_price          decimal(10,2) NOT NULL CHECK (cost_price >= 0),
  selling_price       decimal(10,2) NOT NULL CHECK (selling_price >= 0),
  subtotal            decimal(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase order items"
  ON purchase_order_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert purchase order items"
  ON purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update purchase order items"
  ON purchase_order_items FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');


-- ============================================================
-- 7. PRODUCT BATCHES (stock arrivals per variant)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id          uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_number        text NOT NULL,
  purchase_order_id   uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id         uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  cost_price          decimal(10,2) NOT NULL CHECK (cost_price >= 0),
  selling_price       decimal(10,2) NOT NULL CHECK (selling_price >= 0),
  markup_percentage   decimal(5,2) NOT NULL DEFAULT 0,
  initial_quantity    numeric NOT NULL CHECK (initial_quantity >= 0),
  current_quantity    numeric NOT NULL CHECK (current_quantity >= 0),
  received_date       date NOT NULL DEFAULT CURRENT_DATE,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(variant_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_product_batches_variant ON product_batches(variant_id);

ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view batches"
  ON product_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert batches"
  ON product_batches FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update batches"
  ON product_batches FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Cashier can update batch quantity"
  ON product_batches FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 8. CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  phone           text,
  email           text,
  address         text,
  credit_limit    decimal(10,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  current_credit  decimal(10,2) NOT NULL DEFAULT 0 CHECK (current_credit >= 0),
  loyalty_points  integer NOT NULL DEFAULT 0,
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- 9. SALES STAFF (commission agents — formerly referral_agents)
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  type            text CHECK (type IN ('full_time', 'part_time')),
  phone           text,
  email           text,
  address         text,
  commission_rate decimal(5,2) NOT NULL DEFAULT 0
                               CHECK (commission_rate >= 0 AND commission_rate <= 100),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referral_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales staff"
  ON referral_agents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert sales staff"
  ON referral_agents FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update sales staff"
  ON referral_agents FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');


-- ============================================================
-- 10. SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS sales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number         text UNIQUE NOT NULL,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  referral_agent_id   uuid REFERENCES referral_agents(id) ON DELETE SET NULL,
  sale_date           timestamptz NOT NULL DEFAULT now(),
  subtotal            decimal(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount          decimal(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount     decimal(10,2) NOT NULL DEFAULT 0,
  service_charge      decimal(10,2) NOT NULL DEFAULT 0,
  total_amount        decimal(10,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount         decimal(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  payment_method      text CHECK (payment_method IN ('cash', 'card', 'credit', 'mixed')),
  status              text NOT NULL DEFAULT 'completed'
                           CHECK (status IN ('completed', 'partial', 'credit')),
  notes               text,
  cashier_id          uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales(sale_date);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin can delete sales"
  ON sales FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');


-- ============================================================
-- 11. SALE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS sale_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id             uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id          uuid REFERENCES products(id) ON DELETE RESTRICT,
  variant_id          uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_id            uuid REFERENCES product_batches(id) ON DELETE RESTRICT,
  quantity            numeric NOT NULL CHECK (quantity > 0),
  unit_price          decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  selling_price       decimal(10,2),
  cost_price          decimal(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  subtotal            decimal(10,2) NOT NULL CHECK (subtotal >= 0),
  is_manual           boolean NOT NULL DEFAULT false,
  manual_description  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch   ON sale_items(batch_id);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sale items"
  ON sale_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sale items"
  ON sale_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can delete sale items"
  ON sale_items FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');


-- ============================================================
-- 12. RETURNS
-- ============================================================

CREATE TABLE IF NOT EXISTS returns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text UNIQUE NOT NULL,
  sale_id       uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_id   uuid REFERENCES customers(id) ON DELETE SET NULL,
  return_date   timestamptz NOT NULL DEFAULT now(),
  total_amount  decimal(10,2) NOT NULL CHECK (total_amount >= 0),
  refund_method text CHECK (refund_method IN ('cash', 'credit_note', 'exchange')),
  reason        text,
  status        text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_by  uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view returns"
  ON returns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert returns"
  ON returns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update returns"
  ON returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- 13. RETURN ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS return_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id  uuid REFERENCES sale_items(id) ON DELETE SET NULL,
  product_id    uuid REFERENCES products(id) ON DELETE RESTRICT,
  variant_id    uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_id      uuid REFERENCES product_batches(id) ON DELETE RESTRICT,
  quantity      numeric NOT NULL CHECK (quantity > 0),
  unit_price    decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal      decimal(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view return items"
  ON return_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert return items"
  ON return_items FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- 14. STAFF COMMISSIONS (formerly referral_commissions)
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_commissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id             uuid REFERENCES sales(id) ON DELETE CASCADE,
  referral_agent_id   uuid REFERENCES referral_agents(id) ON DELETE RESTRICT,
  commission_rate     decimal(5,2) NOT NULL CHECK (commission_rate >= 0),
  sale_amount         decimal(10,2) NOT NULL CHECK (sale_amount >= 0),
  commission_amount   decimal(10,2) NOT NULL CHECK (commission_amount >= 0),
  status              text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'paid')),
  payment_date        date,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_agent  ON referral_commissions(referral_agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON referral_commissions(status);

ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view commissions"
  ON referral_commissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert commissions"
  ON referral_commissions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update commissions"
  ON referral_commissions FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can delete commissions"
  ON referral_commissions FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');


-- ============================================================
-- 15. LOYALTY TRANSACTIONS
-- ============================================================

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

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view loyalty transactions"
  ON loyalty_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert loyalty transactions"
  ON loyalty_transactions FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- 16. APP SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
  ON app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can upsert settings"
  ON app_settings FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update settings"
  ON app_settings FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');


-- ============================================================
-- SEED DATA — Default Settings
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
  ('loyalty_earn_rate',   '100'),   -- 1 point earned per LKR 100 spent
  ('loyalty_redeem_rate', '100')    -- 100 points = LKR 100 discount
ON CONFLICT (key) DO NOTHING;
