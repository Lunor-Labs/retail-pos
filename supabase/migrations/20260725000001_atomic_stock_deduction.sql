-- Atomic stock deduction for sales.
--
-- Stock used to be deducted from the client as read-then-write:
--   read current_quantity → compute current_quantity - qty → write the absolute result
-- (InventoryService.deductStock, SalesService.syncOfflineSale). Two terminals
-- selling the last unit both read 1, both wrote 0, and the shop oversold without
-- the CHECK (current_quantity >= 0) constraint ever firing — the written value was
-- never negative, just wrong. The per-item loop was also un-transactional, so a
-- failure partway through left earlier items deducted with no sale recorded.
--
-- deduct_batch_stock moves both the arithmetic and the availability check into a
-- single UPDATE, so availability is evaluated against the row the statement itself
-- locks, and the whole item list runs in one transaction (a plpgsql function body
-- is atomic).
--
-- p_items: [{"batch_id": "<uuid>", "quantity": <numeric>}, ...]
--
-- p_allow_shortfall = false (online checkout): an item short of stock aborts the
--   whole call with INSUFFICIENT_STOCK and nothing is deducted.
-- p_allow_shortfall = true (offline sale sync): the sale already happened at the
--   counter and must not be discarded, so deduct what is actually there, floor at
--   zero, and hand the shortfalls back for the caller to flag.
--
-- Returns a jsonb array of shortfalls (empty when every item deducted in full):
--   [{"batch_id": "...", "batch_number": "...", "requested": 3, "deducted": 1}]

CREATE OR REPLACE FUNCTION deduct_batch_stock(
  p_items jsonb,
  p_allow_shortfall boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_item          record;
  v_available     numeric;
  v_batch_number  text;
  v_shortfalls    jsonb := '[]'::jsonb;
BEGIN
  FOR v_item IN
    SELECT (value->>'batch_id')::uuid   AS batch_id,
           (value->>'quantity')::numeric AS quantity
    FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item.batch_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_BATCH: missing batch_id in %', p_items;
    END IF;

    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: batch % quantity %', v_item.batch_id, v_item.quantity;
    END IF;

    -- The availability guard lives in the WHERE clause, so it is re-checked at
    -- write time against the locked row instead of against a value read earlier.
    UPDATE product_batches
       SET current_quantity = current_quantity - v_item.quantity,
           updated_at = now()
     WHERE id = v_item.batch_id
       AND current_quantity >= v_item.quantity;

    CONTINUE WHEN FOUND;

    -- Nothing updated: the batch is either gone or short of stock. Lock it so the
    -- number we report (and the floor-at-zero write below) cannot drift again.
    SELECT pb.current_quantity, pb.batch_number
      INTO v_available, v_batch_number
      FROM product_batches pb
     WHERE pb.id = v_item.batch_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BATCH_NOT_FOUND: %', v_item.batch_id;
    END IF;

    IF NOT p_allow_shortfall THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: batch % has % available, % required',
        v_batch_number, v_available, v_item.quantity;
    END IF;

    UPDATE product_batches
       SET current_quantity = 0,
           updated_at = now()
     WHERE id = v_item.batch_id;

    v_shortfalls := v_shortfalls || jsonb_build_object(
      'batch_id',     v_item.batch_id,
      'batch_number', v_batch_number,
      'requested',    v_item.quantity,
      'deducted',     v_available
    );
  END LOOP;

  RETURN v_shortfalls;
END;
$$;

-- Give stock back, relative like the deduction so it cannot clobber a concurrent
-- change. Used to compensate when a sale fails to record after its stock was
-- already taken; safe to reuse for returns.
--
-- p_items: [{"batch_id": "<uuid>", "quantity": <numeric>}, ...]

CREATE OR REPLACE FUNCTION restore_batch_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_item record;
BEGIN
  FOR v_item IN
    SELECT (value->>'batch_id')::uuid    AS batch_id,
           (value->>'quantity')::numeric AS quantity
    FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: batch % quantity %', v_item.batch_id, v_item.quantity;
    END IF;

    UPDATE product_batches
       SET current_quantity = current_quantity + v_item.quantity,
           updated_at = now()
     WHERE id = v_item.batch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BATCH_NOT_FOUND: %', v_item.batch_id;
    END IF;
  END LOOP;
END;
$$;

-- SECURITY INVOKER, so the caller's RLS still applies — the existing
-- "Cashier can update batch quantity" policy on product_batches is what permits
-- the write. Only signed-in users may call these.
REVOKE ALL ON FUNCTION deduct_batch_stock(jsonb, boolean) FROM public;
REVOKE ALL ON FUNCTION restore_batch_stock(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION deduct_batch_stock(jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_batch_stock(jsonb) TO authenticated;
