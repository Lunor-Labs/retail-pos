-- Add commission_rate to staff tables
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS commission_rate decimal(5,2) NOT NULL DEFAULT 0
  CHECK (commission_rate >= 0 AND commission_rate <= 100);

ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS commission_rate decimal(5,2) NOT NULL DEFAULT 0
  CHECK (commission_rate >= 0 AND commission_rate <= 100);

-- Track monthly commission payments
CREATE TABLE IF NOT EXISTS staff_commission_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         uuid NOT NULL,
  staff_source     text NOT NULL CHECK (staff_source IN ('profile', 'member')),
  month            text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  commission_amount decimal(10,2) NOT NULL CHECK (commission_amount >= 0),
  paid_at          timestamptz NOT NULL DEFAULT now(),
  paid_by          uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  UNIQUE (staff_id, month)
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_month ON staff_commission_payments(month);

ALTER TABLE staff_commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view commission payments"
  ON staff_commission_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage commission payments"
  ON staff_commission_payments FOR ALL TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
