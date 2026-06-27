-- Allow the stock_manager role to create (and edit) reference data items.
--
-- The add-product page now lets users add a new Product Name / Brand / Category /
-- Material / Size / Colour inline (the dropdown "+ Add" row), which INSERTs into
-- reference_data. RLS previously allowed only `admin` to write reference_data, so
-- a stock manager's inline add would fail the same way product saves did. These
-- additive policies grant stock_manager INSERT + UPDATE (no delete).
--
-- Idempotent: drop-then-create so the migration is safe to re-run.

DROP POLICY IF EXISTS "Stock manager can insert reference data" ON reference_data;
CREATE POLICY "Stock manager can insert reference data"
  ON reference_data FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'stock_manager');

DROP POLICY IF EXISTS "Stock manager can update reference data" ON reference_data;
CREATE POLICY "Stock manager can update reference data"
  ON reference_data FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'stock_manager')
  WITH CHECK (get_current_user_role() = 'stock_manager');
