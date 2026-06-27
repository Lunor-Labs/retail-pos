-- Allow the stock_manager role to add and edit products, variants and stock.
--
-- The app UI grants stock managers access to the Products page and the
-- Add/Edit-Product flow, but the original RLS only permitted `admin` to write
-- to products / product_variants / product_batches. A stock manager saving a
-- product therefore hit: "new row violates row-level security policy for table
-- products". These additive policies grant stock managers INSERT + UPDATE on
-- those three tables (alongside the existing admin policies). Deleting a whole
-- product remains admin-only.
--
-- Idempotent: drop-then-create so the migration is safe to re-run.

-- ── products ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Stock manager can insert products" ON products;
CREATE POLICY "Stock manager can insert products"
  ON products FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'stock_manager');

DROP POLICY IF EXISTS "Stock manager can update products" ON products;
CREATE POLICY "Stock manager can update products"
  ON products FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'stock_manager')
  WITH CHECK (get_current_user_role() = 'stock_manager');

-- ── product_variants ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Stock manager can insert product variants" ON product_variants;
CREATE POLICY "Stock manager can insert product variants"
  ON product_variants FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'stock_manager');

DROP POLICY IF EXISTS "Stock manager can update product variants" ON product_variants;
CREATE POLICY "Stock manager can update product variants"
  ON product_variants FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'stock_manager')
  WITH CHECK (get_current_user_role() = 'stock_manager');

-- ── product_batches ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Stock manager can insert batches" ON product_batches;
CREATE POLICY "Stock manager can insert batches"
  ON product_batches FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'stock_manager');

DROP POLICY IF EXISTS "Stock manager can update batches" ON product_batches;
CREATE POLICY "Stock manager can update batches"
  ON product_batches FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'stock_manager')
  WITH CHECK (get_current_user_role() = 'stock_manager');
