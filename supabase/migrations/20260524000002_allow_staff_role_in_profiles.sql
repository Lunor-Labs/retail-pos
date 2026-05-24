-- Allow 'staff' role in user_profiles for accounts that have been downgraded
-- (auth account exists but system access is removed)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'cashier', 'stock_manager', 'staff'));
