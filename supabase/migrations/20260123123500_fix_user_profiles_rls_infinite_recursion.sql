/*
  # Fix Infinite Recursion in user_profiles RLS Policies

  ## Problem
  The current RLS policies on user_profiles table cause infinite recursion because they query
  the user_profiles table itself to check if a user is an admin.

  ## Solution
  1. Drop existing problematic policies
  2. Create a security definer function to get current user's role without triggering RLS
  3. Recreate policies using the helper function

  ## Changes
  - Drop and recreate user_profiles policies
  - Add `get_current_user_role()` helper function with SECURITY DEFINER
  - Fix all policies that previously caused recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON user_profiles;

-- Create a helper function to get current user's role without triggering RLS
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$;

-- Recreate policies using the helper function
CREATE POLICY "Admin can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Admin can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admin can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- Update all other policies that query user_profiles to use the helper function
DROP POLICY IF EXISTS "Admin can insert suppliers" ON suppliers;
CREATE POLICY "Admin can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update suppliers" ON suppliers;
CREATE POLICY "Admin can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can delete suppliers" ON suppliers;
CREATE POLICY "Admin can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert products" ON products;
CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update products" ON products;
CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can delete products" ON products;
CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert purchase orders" ON purchase_orders;
CREATE POLICY "Admin can insert purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update purchase orders" ON purchase_orders;
CREATE POLICY "Admin can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert purchase order items" ON purchase_order_items;
CREATE POLICY "Admin can insert purchase order items"
  ON purchase_order_items FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update purchase order items" ON purchase_order_items;
CREATE POLICY "Admin can update purchase order items"
  ON purchase_order_items FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert batches" ON product_batches;
CREATE POLICY "Admin can insert batches"
  ON product_batches FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update batches" ON product_batches;
CREATE POLICY "Admin can update batches"
  ON product_batches FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert referral agents" ON referral_agents;
CREATE POLICY "Admin can insert referral agents"
  ON referral_agents FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update referral agents" ON referral_agents;
CREATE POLICY "Admin can update referral agents"
  ON referral_agents FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update referral commissions" ON referral_commissions;
CREATE POLICY "Admin can update referral commissions"
  ON referral_commissions FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
