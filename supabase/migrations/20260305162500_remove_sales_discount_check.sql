-- Remove the constraint that prevents negative discount amounts
-- This allows us to store markups (selling price > configured price) as negative discounts
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_discount_amount_check;
