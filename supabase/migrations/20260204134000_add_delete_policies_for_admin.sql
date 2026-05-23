-- Add DELETE policies for administrators on sales-related tables

-- Sales table delete policy
CREATE POLICY "Admin can delete sales"
  ON sales FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sale items table delete policy
CREATE POLICY "Admin can delete sale items"
  ON sale_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Referral commissions table delete policy
CREATE POLICY "Admin can delete referral commissions"
  ON referral_commissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
