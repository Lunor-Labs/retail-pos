ALTER TABLE reference_data
  DROP CONSTRAINT reference_data_type_check;

ALTER TABLE reference_data
  ADD CONSTRAINT reference_data_type_check
  CHECK (type IN ('brand', 'category', 'material', 'product_name', 'size', 'color'));
