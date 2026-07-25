-- Bill-less returns and store credit — functions.
--
-- Every money-moving step lives here rather than in the client, for the same reason
-- stock deduction moved into deduct_batch_stock: a rule the browser enforces is a
-- rule that can be skipped by anyone who can open developer tools, and a multi-step
-- write from the client can be left half-finished.
--
-- ── Error signalling ───────────────────────────────────────────────────────
-- Two deliberate styles:
--
--   * A wrong or locked-out PIN is returned as {"ok": false, "error": ...}, NOT
--     raised. Raising would roll back the transaction, and that would erase the
--     approval_attempts row recording the failure — which is exactly the row the
--     lockout counts. So PIN verification happens FIRST, before any other write,
--     and a failure returns early with nothing else done.
--
--   * Every other problem (amount above tag price, credit already spent, batch
--     missing) is RAISEd, because there rollback is precisely what we want.
--
-- ── search_path ───────────────────────────────────────────────────────────
-- SECURITY DEFINER functions pin search_path, both as standard practice and because
-- pgcrypto lives in `extensions` on Supabase but `public` on a plain Postgres —
-- listing both means crypt()/gen_salt() resolve without hardcoding either.


-- ── set_admin_pin ──────────────────────────────────────────────────────────
-- An admin sets their own 4-digit approval PIN. Stored as a bcrypt hash.
--
-- PINs must be unique across admins: an approval is attributed to whoever's PIN was
-- entered, so two admins sharing 1234 would make the audit trail meaningless.
-- bcrypt hashes of the same PIN differ (random salt), so uniqueness is checked by
-- testing the new PIN against each existing hash.

CREATE OR REPLACE FUNCTION set_admin_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_role   text;
  v_other  record;
BEGIN
  SELECT role INTO v_role FROM user_profiles WHERE id = v_caller AND active;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'NOT_ADMIN: only an admin can set an approval PIN';
  END IF;

  IF p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN_FORMAT: the PIN must be exactly 4 digits';
  END IF;

  FOR v_other IN
    SELECT id, approval_pin_hash
      FROM user_profiles
     WHERE role = 'admin'
       AND active
       AND approval_pin_hash IS NOT NULL
       AND id <> v_caller
  LOOP
    IF v_other.approval_pin_hash = crypt(p_pin, v_other.approval_pin_hash) THEN
      RAISE EXCEPTION 'PIN_TAKEN: another admin already uses this PIN';
    END IF;
  END LOOP;

  UPDATE user_profiles
     SET approval_pin_hash = crypt(p_pin, gen_salt('bf')),
         updated_at = now()
   WHERE id = v_caller;
END;
$$;


-- ── verify_admin_pin ───────────────────────────────────────────────────────
-- Checks a PIN against every active admin and returns who it belongs to.
--
-- Returns {"ok": true, "admin_id": "..."} or {"ok": false, "error": "..."}. Never
-- raises, so the caller can record the failed attempt and still commit — see the
-- note at the top of this file.
--
-- A 4-digit PIN is 10,000 combinations, which is a few minutes of guessing against
-- an HTTP endpoint. The lockout below is what makes a short PIN acceptable at all:
-- 5 failures from the same user within 15 minutes and verification stops.

CREATE OR REPLACE FUNCTION verify_admin_pin(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_fails  integer;
  v_admin  uuid;
BEGIN
  SELECT count(*) INTO v_fails
    FROM approval_attempts
   WHERE attempted_by IS NOT DISTINCT FROM v_caller
     AND NOT succeeded
     AND created_at > now() - interval '15 minutes';

  IF v_fails >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_LOCKED');
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    INSERT INTO approval_attempts (attempted_by, succeeded) VALUES (v_caller, false);
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_INVALID');
  END IF;

  SELECT p.id INTO v_admin
    FROM user_profiles p
   WHERE p.role = 'admin'
     AND p.active
     AND p.approval_pin_hash IS NOT NULL
     AND p.approval_pin_hash = crypt(p_pin, p.approval_pin_hash)
   LIMIT 1;

  INSERT INTO approval_attempts (attempted_by, succeeded) VALUES (v_caller, v_admin IS NOT NULL);

  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PIN_INVALID');
  END IF;

  RETURN jsonb_build_object('ok', true, 'admin_id', v_admin);
END;
$$;


-- ── setting helper ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_setting_numeric(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT NULLIF(value, '')::numeric FROM app_settings WHERE key = p_key), p_default);
$$;


-- ── code generation ────────────────────────────────────────────────────────
-- Mirrors the charset already used for voucher codes in the app: no I, O, 0 or 1,
-- because these get read off a printed slip and dictated over the phone.
-- The RET- prefix is what lets the counter's scan handler tell a credit slip from a
-- product barcode.

CREATE OR REPLACE FUNCTION gen_credit_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code  text;
  v_try   integer := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_code := 'RET-';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    v_code := v_code || '-';
    FOR i IN 1..3 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM gift_vouchers WHERE code = v_code);

    IF v_try > 50 THEN
      RAISE EXCEPTION 'CODE_GENERATION_FAILED: could not find an unused credit code';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;


-- ── issue_return_credit ────────────────────────────────────────────────────
-- The returns desk action. One transaction covering: validation, the return record,
-- the returned lines, putting stock back, and the credit itself. Anything failing
-- leaves nothing behind — no orphan return with no credit, no restocked item with no
-- record of why.
--
-- p_items: [{"batch_id": "<uuid>", "quantity": <numeric>, "amount": <numeric>}, ...]
--   amount is the refund for the whole line, not per unit.
--
-- The refund can never exceed the batch's selling price — the price printed on the
-- item's own label, since labels are generated per batch. Staff may refund LESS (the
-- customer bought it at a discount), but going above needs a manager, which in
-- practice means it is refused here and the desk lowers the figure.
--
-- Returns {"ok": true, "code": ..., "amount": ..., "expires_at": ..., "return_number": ...}
-- or {"ok": false, "error": "PIN_INVALID" | "PIN_LOCKED"}.

CREATE OR REPLACE FUNCTION issue_return_credit(
  p_items       jsonb,
  p_reason      text,
  p_phone       text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_pin         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_item       record;
  v_batch      record;
  v_total      numeric := 0;
  v_limit      numeric;
  v_pin_result jsonb;
  v_admin      uuid := NULL;
  v_return_id  uuid;
  v_return_no  text;
  v_code       text;
  v_expires    date;
  v_days       numeric;
  v_stock      jsonb := '[]'::jsonb;
  v_count      integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS: a return needs at least one item';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'NO_REASON: a reason is required';
  END IF;

  -- Pass 1: validate everything and total it up, writing nothing yet, so a bad line
  -- cannot leave a partly-built return behind.
  FOR v_item IN
    SELECT (value->>'batch_id')::uuid  AS batch_id,
           (value->>'quantity')::numeric AS quantity,
           (value->>'amount')::numeric   AS amount
    FROM jsonb_array_elements(p_items)
  LOOP
    IF v_item.batch_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_ITEM: missing batch_id';
    END IF;

    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: batch % quantity %', v_item.batch_id, v_item.quantity;
    END IF;

    IF v_item.amount IS NULL OR v_item.amount < 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: batch % amount %', v_item.batch_id, v_item.amount;
    END IF;

    -- Derive the variant and product from the batch rather than trusting the client,
    -- so a mismatched trio can never be recorded.
    SELECT pb.id, pb.selling_price, pb.batch_number, pv.id AS variant_id, pv.product_id
      INTO v_batch
      FROM product_batches pb
      JOIN product_variants pv ON pv.id = pb.variant_id
     WHERE pb.id = v_item.batch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'BATCH_NOT_FOUND: %', v_item.batch_id;
    END IF;

    IF v_item.amount > v_batch.selling_price * v_item.quantity THEN
      RAISE EXCEPTION 'AMOUNT_ABOVE_TAG: batch % sells at %, refund of % for % units is higher',
        v_batch.batch_number, v_batch.selling_price, v_item.amount, v_item.quantity;
    END IF;

    v_total := v_total + v_item.amount;
    v_count := v_count + 1;
    v_stock := v_stock || jsonb_build_object('batch_id', v_item.batch_id, 'quantity', v_item.quantity);
  END LOOP;

  -- A high-value return needs an admin PIN. Checked before any write, so returning
  -- early leaves only the approval_attempts row (see the note at the top).
  v_limit := app_setting_numeric('return_pin_limit', 5000);

  IF v_total > v_limit THEN
    v_pin_result := verify_admin_pin(p_pin);
    IF NOT (v_pin_result->>'ok')::boolean THEN
      RETURN v_pin_result;
    END IF;
    v_admin := (v_pin_result->>'admin_id')::uuid;
  END IF;

  -- Pass 2: write.
  v_return_no := 'RTN-' || to_char(now(), 'YYMMDD') || '-' ||
                 upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));

  INSERT INTO returns (
    return_number, sale_id, customer_id, return_date, total_amount,
    refund_method, reason, status, processed_by, approved_by_admin_id
  ) VALUES (
    v_return_no, NULL, p_customer_id, now(), v_total,
    'store_credit', btrim(p_reason), 'approved', v_caller, v_admin
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN
    SELECT (value->>'batch_id')::uuid    AS batch_id,
           (value->>'quantity')::numeric AS quantity,
           (value->>'amount')::numeric   AS amount
    FROM jsonb_array_elements(p_items)
  LOOP
    SELECT pv.id AS variant_id, pv.product_id
      INTO v_batch
      FROM product_batches pb
      JOIN product_variants pv ON pv.id = pb.variant_id
     WHERE pb.id = v_item.batch_id;

    INSERT INTO return_items (
      return_id, sale_item_id, product_id, variant_id, batch_id,
      quantity, unit_price, subtotal
    ) VALUES (
      v_return_id, NULL, v_batch.product_id, v_batch.variant_id, v_item.batch_id,
      v_item.quantity, v_item.amount / v_item.quantity, v_item.amount
    );
  END LOOP;

  -- Put the stock back into the exact batches it came from, so cost prices — and
  -- therefore margins — stay correct. Relative, so a concurrent sale is not undone.
  PERFORM restore_batch_stock(v_stock);

  v_days    := app_setting_numeric('return_credit_validity_days', 30);
  v_expires := (current_date + (v_days || ' days')::interval)::date;
  v_code    := gen_credit_code();

  INSERT INTO gift_vouchers (
    code, amount, balance, status, issued_source, return_id,
    issued_to, recipient_phone, issued_by_staff_id, expires_at
  ) VALUES (
    v_code, v_total, v_total, 'active', 'return_credit', v_return_id,
    NULL, NULLIF(btrim(COALESCE(p_phone, '')), ''), v_caller, v_expires
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'amount', v_total,
    'expires_at', v_expires,
    'return_number', v_return_no,
    'return_id', v_return_id,
    'item_count', v_count
  );
END;
$$;


-- ── redeem_credit_to_sale ──────────────────────────────────────────────────
-- Spend part or all of a credit against a sale.
--
-- The decrement is one guarded UPDATE for the same reason stock deduction had to be:
-- read-then-write lets two counters spend the same credit at the same moment, each
-- seeing the balance before the other's write.
--
-- SECURITY DEFINER because the guard lives in this statement. The condition cannot
-- be sidestepped, so the elevated write is safe, and redemption works for any till
-- role rather than depending on the gift_vouchers UPDATE policy.

CREATE OR REPLACE FUNCTION redeem_credit_to_sale(
  p_code    text,
  p_amount  numeric,
  p_sale_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id      uuid;
  v_balance numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: %', p_amount;
  END IF;

  UPDATE gift_vouchers
     SET balance = balance - p_amount
   WHERE code = upper(btrim(p_code))
     AND status = 'active'
     AND balance >= p_amount
     AND (expires_at IS NULL OR expires_at >= current_date)
  RETURNING id, balance INTO v_id, v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CREDIT_UNAVAILABLE: % cannot cover %', p_code, p_amount;
  END IF;

  -- Nothing left: close it out and record where it landed.
  IF v_balance = 0 THEN
    UPDATE gift_vouchers
       SET status = 'used',
           redeemed_at = now(),
           redeemed_in_sale_id = COALESCE(p_sale_id, redeemed_in_sale_id)
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'remaining', v_balance);
END;
$$;


-- ── payout_credit_cash ─────────────────────────────────────────────────────
-- Hand back part or all of a credit as cash at the counter.
--
-- This is the only path that turns goods into money, so it is the one that needs a
-- PIN — above a configurable limit, so small change from an exchange does not hold
-- up the queue.
--
-- The payout is recorded in credit_payouts, which the day-end screen subtracts from
-- expected cash. Without that row the drawer simply reads short.

CREATE OR REPLACE FUNCTION payout_credit_cash(
  p_code    text,
  p_amount  numeric,
  p_sale_id uuid DEFAULT NULL,
  p_pin     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_limit      numeric;
  v_pin_result jsonb;
  v_admin      uuid := NULL;
  v_id         uuid;
  v_balance    numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: %', p_amount;
  END IF;

  -- PIN first, before any write, so a failure can return early and still commit the
  -- record of the attempt.
  v_limit := app_setting_numeric('cash_payout_pin_limit', 500);

  IF p_amount > v_limit THEN
    v_pin_result := verify_admin_pin(p_pin);
    IF NOT (v_pin_result->>'ok')::boolean THEN
      RETURN v_pin_result;
    END IF;
    v_admin := (v_pin_result->>'admin_id')::uuid;
  END IF;

  UPDATE gift_vouchers
     SET balance = balance - p_amount
   WHERE code = upper(btrim(p_code))
     AND status = 'active'
     AND balance >= p_amount
     AND (expires_at IS NULL OR expires_at >= current_date)
  RETURNING id, balance INTO v_id, v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CREDIT_UNAVAILABLE: % cannot cover %', p_code, p_amount;
  END IF;

  INSERT INTO credit_payouts (voucher_id, amount, sale_id, paid_by_staff_id, approved_by_admin_id)
  VALUES (v_id, p_amount, p_sale_id, v_caller, v_admin);

  IF v_balance = 0 THEN
    UPDATE gift_vouchers
       SET status = 'used',
           redeemed_at = now(),
           redeemed_in_sale_id = COALESCE(p_sale_id, redeemed_in_sale_id)
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining', v_balance,
    'approved_by', v_admin
  );
END;
$$;


-- ── grants ─────────────────────────────────────────────────────────────────
-- Signed-in users only, and only the four actions the app actually calls.
--
-- verify_admin_pin, app_setting_numeric and gen_credit_code are revoked and never
-- granted: they are reachable only from the SECURITY DEFINER functions above, which
-- run as the owner. Leaving verify_admin_pin uncallable from the client matters —
-- exposing it would hand out a bare PIN-guessing endpoint, whereas going through the
-- actions means every guess is tied to a real payout or return attempt.
REVOKE ALL ON FUNCTION set_admin_pin(text)                                    FROM public;
REVOKE ALL ON FUNCTION verify_admin_pin(text)                                 FROM public;
REVOKE ALL ON FUNCTION app_setting_numeric(text, numeric)                     FROM public;
REVOKE ALL ON FUNCTION gen_credit_code()                                      FROM public;
REVOKE ALL ON FUNCTION issue_return_credit(jsonb, text, text, uuid, text)     FROM public;
REVOKE ALL ON FUNCTION redeem_credit_to_sale(text, numeric, uuid)             FROM public;
REVOKE ALL ON FUNCTION payout_credit_cash(text, numeric, uuid, text)          FROM public;

GRANT EXECUTE ON FUNCTION set_admin_pin(text)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION issue_return_credit(jsonb, text, text, uuid, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_credit_to_sale(text, numeric, uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION payout_credit_cash(text, numeric, uuid, text)       TO authenticated;
