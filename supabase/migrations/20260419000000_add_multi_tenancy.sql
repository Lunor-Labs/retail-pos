/*
  # Multi-Tenancy Foundation
  
  1. Creates `tenants` table
  2. Adds `tenant_id` to all existing tables
  3. Drops existing RLS policies and recreates them with tenant isolation
  4. Fixes UNIQUE constraints to be per-tenant
*/

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  business_name text NOT NULL,
  business_type text NOT NULL,
  logo_url text,
  currency text DEFAULT 'LKR',
  timezone text DEFAULT 'Asia/Colombo',
  subscription_plan text DEFAULT 'trial',
  subscription_expires_at timestamptz,
  active boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 2. Add tenant_id to all tables
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE referral_agents ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE referral_commissions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- 3. Modify Role Constraint to allow 'platform_admin'
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'cashier', 'platform_admin'));

-- 4. Create Security Definer functions
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN v_tenant_id;
END;
$$;

-- Modify get_current_user_role to handle platform_admin
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

-- 5. Helper function for policies: is platform admin?
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- 6. Modify UNIQUE Constraints to be tenant-scoped
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_tenant_key;
ALTER TABLE products ADD CONSTRAINT products_sku_tenant_key UNIQUE (sku, tenant_id);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_tenant_key;
ALTER TABLE products ADD CONSTRAINT products_barcode_tenant_key UNIQUE (barcode, tenant_id);

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_tenant_key;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_po_number_tenant_key UNIQUE (po_number, tenant_id);

ALTER TABLE product_batches DROP CONSTRAINT IF EXISTS product_batches_product_id_batch_number_key;
ALTER TABLE product_batches DROP CONSTRAINT IF EXISTS product_batches_product_id_batch_number_tenant_key;
ALTER TABLE product_batches ADD CONSTRAINT product_batches_product_id_batch_number_tenant_key UNIQUE (product_id, batch_number, tenant_id);

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_number_key;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_number_tenant_key;
ALTER TABLE sales ADD CONSTRAINT sales_sale_number_tenant_key UNIQUE (sale_number, tenant_id);

ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_return_number_key;
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_return_number_tenant_key;
ALTER TABLE returns ADD CONSTRAINT returns_return_number_tenant_key UNIQUE (return_number, tenant_id);

-- 7. Drop existing policies
DO $$ 
DECLARE
  t text;
  pol record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'user_profiles', 'suppliers', 'products', 'purchase_orders', 
    'purchase_order_items', 'product_batches', 'customers', 
    'referral_agents', 'sales', 'sale_items', 'returns', 
    'return_items', 'referral_commissions'
  ])
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- 8. Create NEW Policies with Tenant Isolation

-- tenants
CREATE POLICY "Platform admins can do everything on tenants" ON tenants TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY "Users can view their own tenant" ON tenants FOR SELECT TO authenticated USING (id = get_my_tenant_id());

-- user_profiles (avoid infinite recursion by not querying user_profiles inside user_profiles policy directly, use the helper function)
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id OR is_platform_admin());
-- For admin, since the function uses auth.uid() directly against user_profiles, it doesn't loop.
CREATE POLICY "Admin can view tenant profiles" ON user_profiles FOR SELECT TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());
CREATE POLICY "Admin can insert tenant profiles" ON user_profiles FOR INSERT TO authenticated WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());
CREATE POLICY "Admin can update tenant profiles" ON user_profiles FOR UPDATE TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- suppliers
CREATE POLICY "Users can view tenant suppliers" ON suppliers FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant suppliers" ON suppliers FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- products
CREATE POLICY "Users can view tenant products" ON products FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant products" ON products FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- purchase_orders
CREATE POLICY "Users can view tenant purchase orders" ON purchase_orders FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant purchase orders" ON purchase_orders FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- purchase_order_items
CREATE POLICY "Users can view tenant purchase order items" ON purchase_order_items FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant purchase order items" ON purchase_order_items FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- product_batches
CREATE POLICY "Users can view tenant batches" ON product_batches FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant batches" ON product_batches FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- customers
CREATE POLICY "Users can view tenant customers" ON customers FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can insert tenant customers" ON customers FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can update tenant customers" ON customers FOR UPDATE TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin()) WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- referral_agents
CREATE POLICY "Users can view tenant referral agents" ON referral_agents FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant referral agents" ON referral_agents FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());

-- sales
CREATE POLICY "Users can view tenant sales" ON sales FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can insert tenant sales" ON sales FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can update tenant sales" ON sales FOR UPDATE TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin()) WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- sale_items
CREATE POLICY "Users can view tenant sale items" ON sale_items FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can insert tenant sale items" ON sale_items FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- returns
CREATE POLICY "Users can view tenant returns" ON returns FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can insert tenant returns" ON returns FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can update tenant returns" ON returns FOR UPDATE TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin()) WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- return_items
CREATE POLICY "Users can view tenant return items" ON return_items FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can insert tenant return items" ON return_items FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- referral_commissions
CREATE POLICY "Users can view tenant referral commissions" ON referral_commissions FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Users can insert tenant referral commissions" ON referral_commissions FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id() OR is_platform_admin());
CREATE POLICY "Admin can modify tenant referral commissions" ON referral_commissions FOR ALL TO authenticated USING ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin()) WITH CHECK ((get_current_user_role() = 'admin' AND tenant_id = get_my_tenant_id()) OR is_platform_admin());
