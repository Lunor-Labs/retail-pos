-- Add cash_amount and card_amount columns to sales for mixed payment breakdown
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS cash_amount  numeric(12,2),
  ADD COLUMN IF NOT EXISTS card_amount  numeric(12,2);

COMMENT ON COLUMN sales.cash_amount IS 'Cash portion of payment (used for mixed payments)';
COMMENT ON COLUMN sales.card_amount  IS 'Card portion of payment (used for mixed payments)';
