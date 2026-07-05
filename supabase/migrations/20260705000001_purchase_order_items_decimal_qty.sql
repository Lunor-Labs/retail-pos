-- Allow fractional quantities on purchase order line items (e.g. yard/meter units).
ALTER TABLE purchase_order_items
  ALTER COLUMN quantity TYPE numeric;
