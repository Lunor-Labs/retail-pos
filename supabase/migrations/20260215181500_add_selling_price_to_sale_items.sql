-- Migration to add selling_price to sale_items
-- This column stores the original selling price before any discounts

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2);

-- Update existing rows to use the current batch selling_price as an approximation
UPDATE sale_items
SET selling_price = product_batches.selling_price
FROM product_batches
WHERE sale_items.batch_id = product_batches.id
AND sale_items.selling_price IS NULL;