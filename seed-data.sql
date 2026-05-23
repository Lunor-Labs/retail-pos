-- Vehicle Parts POS System - Sample Data
-- Run this AFTER creating your admin user to populate the system with test data

-- Insert sample suppliers
INSERT INTO suppliers (name, contact_person, phone, email, address, active)
VALUES
  ('Auto Parts Wholesale', 'John Smith', '555-0100', 'john@autoparts.com', '123 Industry St, Chicago IL', true),
  ('Premier Vehicle Supplies', 'Sarah Johnson', '555-0101', 'sarah@premier.com', '456 Commerce Ave, Detroit MI', true),
  ('Global Auto Distributors', 'Mike Chen', '555-0102', 'mike@globalauto.com', '789 Trade Blvd, Los Angeles CA', true);

-- Insert sample products
INSERT INTO products (sku, barcode, name, description, category, unit, reorder_level, active)
VALUES
  ('BRK-001', '1234567890123', 'Brake Pads - Front', 'Premium ceramic brake pads for front wheels', 'Brakes', 'piece', 10, true),
  ('BRK-002', '1234567890124', 'Brake Pads - Rear', 'Premium ceramic brake pads for rear wheels', 'Brakes', 'piece', 10, true),
  ('BRK-003', '1234567890125', 'Brake Discs', 'Ventilated brake disc rotors', 'Brakes', 'piece', 5, true),
  ('OIL-001', '1234567890126', 'Engine Oil 5W-30', 'Synthetic engine oil 1L', 'Fluids', 'liter', 20, true),
  ('OIL-002', '1234567890127', 'Engine Oil 10W-40', 'Semi-synthetic engine oil 1L', 'Fluids', 'liter', 20, true),
  ('FLT-001', '1234567890128', 'Oil Filter', 'Standard oil filter', 'Filters', 'piece', 15, true),
  ('FLT-002', '1234567890129', 'Air Filter', 'High-flow air filter', 'Filters', 'piece', 15, true),
  ('FLT-003', '1234567890130', 'Fuel Filter', 'Inline fuel filter', 'Filters', 'piece', 12, true),
  ('SPK-001', '1234567890131', 'Spark Plugs', 'Iridium spark plugs (set of 4)', 'Ignition', 'box', 8, true),
  ('BAT-001', '1234567890132', 'Car Battery 12V', 'Maintenance-free car battery', 'Electrical', 'piece', 3, true),
  ('WPR-001', '1234567890133', 'Wiper Blades', 'Universal wiper blade set', 'Accessories', 'piece', 10, true),
  ('CLT-001', '1234567890134', 'Coolant 1L', 'Engine coolant concentrate', 'Fluids', 'liter', 15, true);

-- Insert sample customers
INSERT INTO customers (name, phone, email, address, credit_limit, current_credit, active)
VALUES
  ('John Doe', '555-0200', 'john.doe@email.com', '456 Main St, Springfield', 1000.00, 0, true),
  ('Jane Smith', '555-0201', 'jane.smith@email.com', '789 Oak Ave, Springfield', 1500.00, 0, true),
  ('Bob Johnson', '555-0202', 'bob.johnson@email.com', '321 Pine Rd, Springfield', 2000.00, 250.00, true),
  ('Alice Williams', '555-0203', 'alice.w@email.com', '654 Elm St, Springfield', 500.00, 0, true),
  ('Charlie Brown', '555-0204', 'charlie.b@email.com', '987 Maple Dr, Springfield', 1200.00, 150.00, true);

-- Insert sample referral agents
INSERT INTO referral_agents (name, type, phone, email, address, commission_rate, active)
VALUES
  ('City Auto Garage', 'garage', '555-0300', 'info@cityauto.com', '100 Service Lane, Springfield', 5.00, true),
  ('Speedy Repairs', 'garage', '555-0301', 'contact@speedyrepairs.com', '200 Workshop Blvd, Springfield', 4.50, true),
  ('Tom Anderson', 'individual', '555-0302', 'tom.anderson@email.com', '300 Residential St, Springfield', 3.00, true),
  ('Quick Fix Auto', 'garage', '555-0303', 'hello@quickfix.com', '400 Mechanic Ave, Springfield', 5.50, true);

-- Create a sample purchase order (you'll need to replace SUPPLIER_ID and CREATED_BY with actual UUIDs)
-- Get supplier ID first:
-- SELECT id FROM suppliers WHERE name = 'Auto Parts Wholesale';
-- Get your user ID:
-- SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1;

-- Then uncomment and run:
-- WITH supplier AS (SELECT id FROM suppliers WHERE name = 'Auto Parts Wholesale' LIMIT 1),
--      user_admin AS (SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1)
-- INSERT INTO purchase_orders (po_number, supplier_id, order_date, total_amount, status, created_by)
-- SELECT 'PO-2024-001', supplier.id, CURRENT_DATE, 1500.00, 'pending', user_admin.id
-- FROM supplier, user_admin;

-- Sample verification queries
SELECT 'Suppliers Created:' as info, COUNT(*) as count FROM suppliers;
SELECT 'Products Created:' as info, COUNT(*) as count FROM products;
SELECT 'Customers Created:' as info, COUNT(*) as count FROM customers;
SELECT 'Referral Agents Created:' as info, COUNT(*) as count FROM referral_agents;

-- Display all created data
SELECT 'Sample suppliers:' as section;
SELECT name, contact_person, phone FROM suppliers ORDER BY name;

SELECT 'Sample products:' as section;
SELECT sku, name, category, unit FROM products ORDER BY category, name;

SELECT 'Sample customers:' as section;
SELECT name, phone, credit_limit, current_credit FROM customers ORDER BY name;

SELECT 'Sample referral agents:' as section;
SELECT name, type, commission_rate FROM referral_agents ORDER BY name;

-- Fix missing columns in sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;

-- Fix missing columns in sale_items table
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) DEFAULT 0;
