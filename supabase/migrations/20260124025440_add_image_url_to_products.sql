/*
  # Add image URL support to products

  1. Changes
    - Add `image_url` column to `products` table
      - `image_url` (text, nullable) - URL to product image
  
  2. Notes
    - Allows products to have an associated image via URL
    - Column is nullable to maintain backward compatibility
    - Can accept URLs from image hosting services or stock photo sites
*/

-- Add image_url column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url text;
  END IF;
END $$;