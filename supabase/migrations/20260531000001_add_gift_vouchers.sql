CREATE TABLE IF NOT EXISTS gift_vouchers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL UNIQUE,
  amount               decimal(10,2) NOT NULL CHECK (amount > 0),
  issued_to            text,
  issued_by_name       text,
  message              text,
  issued_by_staff_id   uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  expires_at           date,
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'used', 'voided')),
  redeemed_at          timestamptz,
  redeemed_in_sale_id  uuid REFERENCES sales(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_vouchers_code    ON gift_vouchers(code);
CREATE INDEX IF NOT EXISTS idx_gift_vouchers_status  ON gift_vouchers(status);

ALTER TABLE gift_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gift vouchers"
  ON gift_vouchers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert gift vouchers"
  ON gift_vouchers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update gift vouchers"
  ON gift_vouchers FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('admin', 'cashier'))
  WITH CHECK (get_current_user_role() IN ('admin', 'cashier'));

CREATE POLICY "Admin can delete gift vouchers"
  ON gift_vouchers FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');
