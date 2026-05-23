-- Add service_charge field to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10,2) DEFAULT 0;

-- Update existing rows to have default values if needed
UPDATE sales SET service_charge = 0 WHERE service_charge IS NULL;
