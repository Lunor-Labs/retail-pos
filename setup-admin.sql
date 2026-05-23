-- Vehicle Parts POS System - Admin User Setup
--
-- IMPORTANT: Before running this script:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" and create a user with:
--    Email: admin@demo.com
--    Password: demo123 (or your choice)
--    Auto Confirm User: YES
-- 3. Copy the User ID (UUID) from the created user
-- 4. Replace 'PASTE_USER_ID_HERE' below with that UUID
-- 5. Run this script in Supabase SQL Editor

-- Create admin profile
INSERT INTO user_profiles (id, email, full_name, role, active)
VALUES (
  'PASTE_USER_ID_HERE',  -- Replace with your user ID from auth.users
  'admin@demo.com',
  'System Administrator',
  'admin',
  true
);

-- Verify the user was created
SELECT * FROM user_profiles WHERE email = 'admin@demo.com';
