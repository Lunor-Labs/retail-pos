-- Add warranty fields to sale_items table
ALTER TABLE sale_items 
ADD COLUMN IF NOT EXISTS warranty_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS warranty_unit TEXT CHECK (warranty_unit IN ('days', 'months', 'years')),
ADD COLUMN IF NOT EXISTS warranty_type TEXT;

-- Update existing rows to have default values if needed
UPDATE sale_items SET warranty_duration = 0 WHERE warranty_duration IS NULL;
