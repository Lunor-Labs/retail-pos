-- Tracks commission_rate and daily_target changes over time.
-- The commission report for any month uses the latest snapshot whose
-- effective_from <= last day of that month (Option A: one rate per month).
-- Multiple changes on the same day upsert the single daily record.
CREATE TABLE IF NOT EXISTS staff_rate_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         uuid NOT NULL,
  staff_source     text NOT NULL CHECK (staff_source IN ('profile', 'member')),
  commission_rate  decimal(5,2) NOT NULL DEFAULT 0,
  daily_target     numeric      NOT NULL DEFAULT 0,
  effective_from   date         NOT NULL DEFAULT CURRENT_DATE,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (staff_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_rate_history_lookup
  ON staff_rate_history(staff_id, effective_from DESC);

ALTER TABLE staff_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rate history"
  ON staff_rate_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage rate history"
  ON staff_rate_history FOR ALL TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
