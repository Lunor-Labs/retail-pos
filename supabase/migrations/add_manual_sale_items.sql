-- Migration: Add manual item support to sale_items
-- Manual items are ad-hoc line items (e.g. bus fare, repair charge) not linked to any product/batch.

-- 1. Make product_id and batch_id nullable (manual items have no product/batch)
ALTER TABLE sale_items
    ALTER COLUMN product_id DROP NOT NULL,
    ALTER COLUMN batch_id DROP NOT NULL;

-- 2. Add is_manual flag (default false = regular product item)
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Add free-text description for manual items
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS manual_description TEXT;

-- 4. Add warranty columns if they don't exist yet
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS warranty_duration INTEGER,
    ADD COLUMN IF NOT EXISTS warranty_unit TEXT,
    ADD COLUMN IF NOT EXISTS warranty_type TEXT;
