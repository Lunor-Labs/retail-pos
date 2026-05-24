CREATE TABLE IF NOT EXISTS reference_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('brand', 'category', 'material', 'product_name')),
  name        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reference_data_type_name_idx
  ON reference_data (type, lower(name));

ALTER TABLE reference_data ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (including view inactive)
CREATE POLICY "Admins manage reference data"
  ON reference_data FOR ALL TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- All authenticated users can read active entries (for product form dropdowns)
CREATE POLICY "Authenticated users read active reference data"
  ON reference_data FOR SELECT TO authenticated
  USING (active = true);
