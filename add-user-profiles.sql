-- Script to add user profiles for existing Supabase authentication users
-- Run this in the Supabase SQL Editor after creating users in Authentication

-- Option 1: Add a specific user by email (RECOMMENDED)
-- Replace 'user@example.com' with the actual email and adjust full_name and role
INSERT INTO user_profiles (id, email, full_name, role, active)
SELECT 
  id,
  email,
  'Admin User',  -- Change this to the actual full name
  'admin',       -- Change to 'cashier' if needed
  true
FROM auth.users
WHERE email = 'user@example.com'  -- Replace with actual email
ON CONFLICT (id) DO NOTHING;

-- Option 2: Add ALL existing auth users as admins (USE WITH CAUTION)
-- This will create profiles for all users that don't have one yet
INSERT INTO user_profiles (id, email, full_name, role, active)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),  -- Use metadata name or email
  'admin',  -- Default role
  true
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Option 3: Add multiple specific users at once
-- Uncomment and modify as needed
/*
INSERT INTO user_profiles (id, email, full_name, role, active)
SELECT 
  au.id,
  au.email,
  u.full_name,
  u.role,
  true
FROM auth.users au
CROSS JOIN (
  VALUES 
    ('admin@gasithmotors.lk', 'Admin User', 'admin'),
    ('cashier@gasithmotors.lk', 'Cashier User', 'cashier')
) AS u(email, full_name, role)
WHERE au.email = u.email
ON CONFLICT (id) DO NOTHING;
*/

-- Verify the inserted profiles
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.active,
  up.created_at
FROM user_profiles up
ORDER BY up.created_at DESC;
