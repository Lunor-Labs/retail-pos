CREATE TABLE IF NOT EXISTS product_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type  text NOT NULL,
  actor_id     uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  actor_name   text NOT NULL DEFAULT '',
  product_id   uuid,
  product_name text NOT NULL DEFAULT '',
  detail       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON product_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_product  ON product_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor    ON product_audit_log(actor_id);

ALTER TABLE product_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit log"
  ON product_audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert audit log"
  ON product_audit_log FOR INSERT TO authenticated WITH CHECK (true);
