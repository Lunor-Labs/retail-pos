ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS daily_target numeric NOT NULL DEFAULT 0;
