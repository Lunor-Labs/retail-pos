/*
  # Vehicle Parts Inventory & POS System Schema

  ## Overview
  Complete database schema for a vehicle parts inventory and POS system with batch tracking,
  referral commissions, and role-based access control.

  ## New Tables

  ### 1. `user_profiles`
  Extended user information with role management
  - `id` (uuid, references auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (text) - 'admin' or 'cashier'
  - `active` (boolean) - whether user account is active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `suppliers`
  Supplier/vendor management
  - `id` (uuid, primary key)
  - `name` (text)
  - `contact_person` (text)
  - `phone` (text)
  - `email` (text)
  - `address` (text)
  - `notes` (text)
  - `active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `products`
  Vehicle parts catalog
  - `id` (uuid, primary key)
  - `sku` (text, unique) - stock keeping unit
  - `barcode` (text, unique) - for barcode scanning
  - `name` (text)
  - `description` (text)
  - `category` (text)
  - `unit` (text) - piece, box, liter, etc.
  - `reorder_level` (integer) - minimum stock alert
  - `active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `product_batches`
  Batch/lot tracking for inventory (each stock arrival)
  - `id` (uuid, primary key)
  - `product_id` (uuid, references products)
  - `batch_number` (text) - unique batch identifier
  - `purchase_order_id` (uuid, references purchase_orders)
  - `supplier_id` (uuid, references suppliers)
  - `cost_price` (decimal) - purchase cost per unit
  - `selling_price` (decimal) - retail price per unit
  - `initial_quantity` (integer) - quantity received
  - `current_quantity` (integer) - remaining quantity
  - `received_date` (date)
  - `expiry_date` (date, nullable)
  - `notes` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `customers`
  Customer management with credit tracking
  - `id` (uuid, primary key)
  - `name` (text)
  - `phone` (text)
  - `email` (text)
  - `address` (text)
  - `credit_limit` (decimal) - maximum credit allowed
  - `current_credit` (decimal) - current outstanding balance
  - `notes` (text)
  - `active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. `referral_agents`
  Garages/persons who refer customers
  - `id` (uuid, primary key)
  - `name` (text)
  - `type` (text) - 'garage' or 'individual'
  - `phone` (text)
  - `email` (text)
  - `address` (text)
  - `commission_rate` (decimal) - percentage (e.g., 5.00 for 5%)
  - `active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `purchase_orders`
  Stock receiving from suppliers
  - `id` (uuid, primary key)
  - `po_number` (text, unique) - purchase order number
  - `supplier_id` (uuid, references suppliers)
  - `order_date` (date)
  - `received_date` (date, nullable)
  - `status` (text) - 'pending', 'received', 'cancelled'
  - `total_amount` (decimal)
  - `notes` (text)
  - `created_by` (uuid, references user_profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. `purchase_order_items`
  Line items in purchase orders
  - `id` (uuid, primary key)
  - `purchase_order_id` (uuid, references purchase_orders)
  - `product_id` (uuid, references products)
  - `quantity` (integer)
  - `cost_price` (decimal)
  - `selling_price` (decimal)
  - `subtotal` (decimal)
  - `created_at` (timestamptz)

  ### 9. `sales`
  Sales transactions
  - `id` (uuid, primary key)
  - `sale_number` (text, unique)
  - `customer_id` (uuid, references customers, nullable)
  - `referral_agent_id` (uuid, references referral_agents, nullable)
  - `sale_date` (timestamptz)
  - `subtotal` (decimal)
  - `tax_amount` (decimal)
  - `discount_amount` (decimal)
  - `total_amount` (decimal)
  - `paid_amount` (decimal)
  - `payment_method` (text) - 'cash', 'card', 'credit', 'mixed'
  - `status` (text) - 'completed', 'partial', 'credit'
  - `notes` (text)
  - `cashier_id` (uuid, references user_profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. `sale_items`
  Line items in sales (with batch tracking)
  - `id` (uuid, primary key)
  - `sale_id` (uuid, references sales)
  - `product_id` (uuid, references products)
  - `batch_id` (uuid, references product_batches)
  - `quantity` (integer)
  - `unit_price` (decimal) - price sold at
  - `cost_price` (decimal) - for profit calculation
  - `subtotal` (decimal)
  - `created_at` (timestamptz)

  ### 11. `returns`
  Product returns and refunds
  - `id` (uuid, primary key)
  - `return_number` (text, unique)
  - `sale_id` (uuid, references sales, nullable)
  - `customer_id` (uuid, references customers, nullable)
  - `return_date` (timestamptz)
  - `total_amount` (decimal)
  - `refund_method` (text) - 'cash', 'credit_note', 'exchange'
  - `reason` (text)
  - `status` (text) - 'pending', 'approved', 'rejected'
  - `processed_by` (uuid, references user_profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 12. `return_items`
  Line items in returns
  - `id` (uuid, primary key)
  - `return_id` (uuid, references returns)
  - `sale_item_id` (uuid, references sale_items, nullable)
  - `product_id` (uuid, references products)
  - `batch_id` (uuid, references product_batches)
  - `quantity` (integer)
  - `unit_price` (decimal)
  - `subtotal` (decimal)
  - `created_at` (timestamptz)

  ### 13. `referral_commissions`
  Commission tracking for referral agents
  - `id` (uuid, primary key)
  - `sale_id` (uuid, references sales)
  - `referral_agent_id` (uuid, references referral_agents)
  - `commission_rate` (decimal)
  - `sale_amount` (decimal)
  - `commission_amount` (decimal)
  - `status` (text) - 'pending', 'paid'
  - `payment_date` (date, nullable)
  - `notes` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Admin role has full access to all operations
  - Cashier role can:
    * Read all product, supplier, customer data
    * Create sales and process returns
    * Read purchase orders (view only)
    * Cannot modify products, suppliers, purchase orders
  - All policies check authentication and role
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'cashier')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  barcode text UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  unit text DEFAULT 'piece',
  reorder_level integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  order_date date DEFAULT CURRENT_DATE,
  received_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled')),
  total_amount decimal(10,2) DEFAULT 0,
  notes text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  cost_price decimal(10,2) NOT NULL CHECK (cost_price >= 0),
  selling_price decimal(10,2) NOT NULL CHECK (selling_price >= 0),
  subtotal decimal(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Create product_batches table
CREATE TABLE IF NOT EXISTS product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  batch_number text NOT NULL,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT,
  cost_price decimal(10,2) NOT NULL CHECK (cost_price >= 0),
  selling_price decimal(10,2) NOT NULL CHECK (selling_price >= 0),
  initial_quantity integer NOT NULL CHECK (initial_quantity >= 0),
  current_quantity integer NOT NULL CHECK (current_quantity >= 0),
  received_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, batch_number)
);

ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  credit_limit decimal(10,2) DEFAULT 0 CHECK (credit_limit >= 0),
  current_credit decimal(10,2) DEFAULT 0 CHECK (current_credit >= 0),
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create referral_agents table
CREATE TABLE IF NOT EXISTS referral_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('garage', 'individual')),
  phone text,
  email text,
  address text,
  commission_rate decimal(5,2) DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE referral_agents ENABLE ROW LEVEL SECURITY;

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  referral_agent_id uuid REFERENCES referral_agents(id) ON DELETE SET NULL,
  sale_date timestamptz DEFAULT now(),
  subtotal decimal(10,2) DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount decimal(10,2) DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount decimal(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount decimal(10,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount decimal(10,2) DEFAULT 0 CHECK (paid_amount >= 0),
  payment_method text CHECK (payment_method IN ('cash', 'card', 'credit', 'mixed')),
  status text DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'credit')),
  notes text,
  cashier_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES product_batches(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  cost_price decimal(10,2) NOT NULL CHECK (cost_price >= 0),
  subtotal decimal(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Create returns table
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text UNIQUE NOT NULL,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  return_date timestamptz DEFAULT now(),
  total_amount decimal(10,2) NOT NULL CHECK (total_amount >= 0),
  refund_method text CHECK (refund_method IN ('cash', 'credit_note', 'exchange')),
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

-- Create return_items table
CREATE TABLE IF NOT EXISTS return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES product_batches(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal decimal(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- Create referral_commissions table
CREATE TABLE IF NOT EXISTS referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  referral_agent_id uuid REFERENCES referral_agents(id) ON DELETE RESTRICT,
  commission_rate decimal(5,2) NOT NULL CHECK (commission_rate >= 0),
  sale_amount decimal(10,2) NOT NULL CHECK (sale_amount >= 0),
  commission_amount decimal(10,2) NOT NULL CHECK (commission_amount >= 0),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_batch_number ON product_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch ON sale_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_agent ON referral_commissions(referral_agent_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for suppliers (Admin: full access, Cashier: read only)
CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for purchase_orders
CREATE POLICY "Authenticated users can view purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for purchase_order_items
CREATE POLICY "Authenticated users can view purchase order items"
  ON purchase_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert purchase order items"
  ON purchase_order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update purchase order items"
  ON purchase_order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for product_batches
CREATE POLICY "Authenticated users can view batches"
  ON product_batches FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert batches"
  ON product_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update batches"
  ON product_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for referral_agents
CREATE POLICY "Authenticated users can view referral agents"
  ON referral_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert referral agents"
  ON referral_agents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update referral agents"
  ON referral_agents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for sales
CREATE POLICY "Authenticated users can view sales"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sale_items
CREATE POLICY "Authenticated users can view sale items"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sale items"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for returns
CREATE POLICY "Authenticated users can view returns"
  ON returns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert returns"
  ON returns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update returns"
  ON returns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for return_items
CREATE POLICY "Authenticated users can view return items"
  ON return_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert return items"
  ON return_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for referral_commissions
CREATE POLICY "Authenticated users can view referral commissions"
  ON referral_commissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert referral commissions"
  ON referral_commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update referral commissions"
  ON referral_commissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );