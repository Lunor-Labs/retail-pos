-- Add payment and return tracking to gift_vouchers

ALTER TABLE gift_vouchers
  ADD COLUMN IF NOT EXISTS issued_source text NOT NULL DEFAULT 'reward'
    CHECK (issued_source IN ('sold', 'reward')),
  ADD COLUMN IF NOT EXISTS paid_amount   decimal(10,2),
  ADD COLUMN IF NOT EXISTS paid_via      text CHECK (paid_via IN ('cash', 'card')),
  ADD COLUMN IF NOT EXISTS returned_at   timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount decimal(10,2),
  ADD COLUMN IF NOT EXISTS refund_via    text CHECK (refund_via IN ('cash', 'card')),
  ADD COLUMN IF NOT EXISTS return_note   text;

-- Extend status to include 'returned'
ALTER TABLE gift_vouchers
  DROP CONSTRAINT IF EXISTS gift_vouchers_status_check;

ALTER TABLE gift_vouchers
  ADD CONSTRAINT gift_vouchers_status_check
    CHECK (status IN ('active', 'used', 'voided', 'returned'));
