-- Staff members who don't need system login (tracked for targets/performance only)
CREATE TABLE IF NOT EXISTS staff_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  email        text NOT NULL DEFAULT '',
  active       boolean NOT NULL DEFAULT true,
  daily_target numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to staff_members"
  ON staff_members FOR ALL TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- Add stock_manager role to user_profiles
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'cashier', 'stock_manager'));
