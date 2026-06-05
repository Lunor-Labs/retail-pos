-- Add phone_number and address to staff_members (non-login staff)
ALTER TABLE staff_members
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Add phone_number and address to user_profiles (system-access staff)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;
