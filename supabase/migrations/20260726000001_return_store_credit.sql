-- Bill-less returns and store credit — schema.
--
-- A return can now be taken without the original bill: the desk scans the item,
-- picks the batch it came from, and the customer leaves with a credit code. The
-- credit lives in gift_vouchers (issued_source = 'return_credit') so the existing
-- redemption path at the counter is reused rather than duplicated.
--
-- Vouchers gain `balance` so credit can be spent across visits. Until now checkout
-- flipped a voucher straight to 'used' regardless of how much of it was spent, so
-- unspent value was silently forfeited — that applies to gift vouchers already in
-- circulation, which this corrects.

-- pgcrypto provides crypt()/gen_salt() for the admin PIN hash. Supabase ships it in
-- the `extensions` schema, a plain Postgres installs it into `public`; the functions
-- in the companion migration pin a search_path covering both, so neither location
-- needs to be hardcoded here.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ── gift_vouchers: return credit + partial balance ──────────────────────────
ALTER TABLE gift_vouchers
  DROP CONSTRAINT IF EXISTS gift_vouchers_issued_source_check;

ALTER TABLE gift_vouchers
  ADD CONSTRAINT gift_vouchers_issued_source_check
    CHECK (issued_source IN ('sold', 'reward', 'return_credit'));

ALTER TABLE gift_vouchers
  ADD COLUMN IF NOT EXISTS balance   decimal(10,2),
  ADD COLUMN IF NOT EXISTS return_id uuid REFERENCES returns(id) ON DELETE SET NULL;

-- Existing rows predate partial spending: an active voucher still has its full face
-- value, anything else has nothing left.
UPDATE gift_vouchers
   SET balance = CASE WHEN status = 'active' THEN amount ELSE 0 END
 WHERE balance IS NULL;

ALTER TABLE gift_vouchers
  ALTER COLUMN balance SET NOT NULL;

ALTER TABLE gift_vouchers
  DROP CONSTRAINT IF EXISTS gift_vouchers_balance_check;

ALTER TABLE gift_vouchers
  ADD CONSTRAINT gift_vouchers_balance_check
    CHECK (balance >= 0 AND balance <= amount);

CREATE INDEX IF NOT EXISTS idx_gift_vouchers_return ON gift_vouchers(return_id);


-- ── returns: a credit-issuing return is its own kind ───────────────────────
-- 'credit_note' keeps its existing meaning (reduce a customer's outstanding debt,
-- which needs a customer record) and is untouched by this feature.
ALTER TABLE returns
  DROP CONSTRAINT IF EXISTS returns_refund_method_check;

ALTER TABLE returns
  ADD CONSTRAINT returns_refund_method_check
    CHECK (refund_method IN ('cash', 'credit_note', 'exchange', 'store_credit'));

-- Who authorised a return above the value limit, when one was needed.
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS approved_by_admin_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;


-- ── credit_payouts: cash handed back against a credit ──────────────────────
-- A table rather than columns on the voucher, because a partial balance can be paid
-- out more than once (buy something today, take the remainder in cash next week).
-- Day-end cash reconciliation sums this by date.
CREATE TABLE IF NOT EXISTS credit_payouts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id           uuid NOT NULL REFERENCES gift_vouchers(id) ON DELETE RESTRICT,
  amount               decimal(10,2) NOT NULL CHECK (amount > 0),
  -- Null when the customer bought nothing and simply took cash.
  sale_id              uuid REFERENCES sales(id) ON DELETE SET NULL,
  paid_by_staff_id     uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Null means the amount was at or below the no-approval limit.
  approved_by_admin_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_payouts_created ON credit_payouts(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_payouts_voucher ON credit_payouts(voucher_id);

ALTER TABLE credit_payouts ENABLE ROW LEVEL SECURITY;

-- Readable for reporting and the day-end screen; only ever written by
-- payout_credit_cash(), which checks the PIN. No client INSERT policy exists, so a
-- direct insert from the browser is refused.
DROP POLICY IF EXISTS "Authenticated users can view credit payouts" ON credit_payouts;
CREATE POLICY "Authenticated users can view credit payouts"
  ON credit_payouts FOR SELECT TO authenticated USING (true);


-- ── admin approval PIN ─────────────────────────────────────────────────────
-- Stored as a bcrypt hash, never the digits. Only ever compared inside
-- verify_admin_pin(), never selected by the client.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS approval_pin_hash text;


-- ── approval_attempts: PIN lockout ─────────────────────────────────────────
-- A 4-digit PIN is 10,000 combinations, which is minutes of guessing against an
-- API. verify_admin_pin() refuses after 5 failures in 15 minutes, counted here.
-- Function-only: no policies at all, so the client can neither read nor write it.
CREATE TABLE IF NOT EXISTS approval_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  succeeded    boolean NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_attempts_by_time
  ON approval_attempts(attempted_by, created_at);

ALTER TABLE approval_attempts ENABLE ROW LEVEL SECURITY;


-- ── configurable limits ────────────────────────────────────────────────────
-- return_pin_limit          — a desk return totalling more than this needs a PIN
-- cash_payout_pin_limit     — cash handed back above this needs a PIN
-- return_credit_validity_days — how long an issued credit stays usable
INSERT INTO app_settings (key, value) VALUES
  ('return_pin_limit',            '5000'),
  ('cash_payout_pin_limit',       '500'),
  ('return_credit_validity_days', '30')
ON CONFLICT (key) DO NOTHING;
