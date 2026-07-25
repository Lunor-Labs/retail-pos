# Bill-less Returns & Store Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a returns desk accept items by scanning their barcode — no bill required — and issue a printed store-credit slip. The customer shops, and at the till the cashier scans the slip: the credit comes off the new purchase, and any remainder either stays on the code or is paid out in cash. Cash payouts above a configurable limit need an admin PIN.

**Architecture:** A return is recorded with `sale_id`/`sale_item_id` left null; the refund amount comes from the batch the desk selects, which is also the batch stock is returned to. The credit itself is a `gift_vouchers` row with `issued_source = 'return_credit'`, so the existing redemption path at the till (`applyVoucher`) is reused rather than duplicated. Vouchers gain a `balance` column so credit can be spent across several visits — this also fixes gift vouchers, which currently forfeit unspent value. Every money-moving step (issue, redeem, cash payout, PIN check) runs inside a single Postgres function so it cannot be half-completed or bypassed from the browser, following the same reasoning as `deduct_batch_stock`.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres functions, pgcrypto), Tailwind + inline styles, lucide-react, jsbarcode

**Decisions already made (do not re-litigate):**
- Approvals are **admin only**. `stock_manager` and `staff` cannot approve.
- PIN is **4 digits**, per-admin (not one shared shop PIN), stored hashed.
- All three limits are **configurable** via `app_settings`.
- The desk does **not** choose cash vs exchange — that is decided at the till, where the customer knows what they want.
- There is **no sale-lookup path**. The bill-number dropdown is removed, not kept alongside.

---

## File Map

**Create:**
- `supabase/migrations/20260726000001_return_store_credit.sql` — voucher `balance`/`return_id`/`return_credit` source, `credit_payouts` table, `approval_attempts` table, `user_profiles.approval_pin_hash`, `app_settings` seed rows, RLS
- `supabase/migrations/20260726000002_return_credit_functions.sql` — `set_admin_pin`, `verify_admin_pin`, `issue_return_credit`, `redeem_credit_to_sale`, `payout_credit_cash`
- `src/services/StoreCreditService.ts` — thin wrapper over the RPCs; the only place the frontend talks to credits
- `src/components/returns/ReturnScanPanel.tsx` — barcode input → variant → batch picker → line list
- `src/components/returns/ReturnSlip.tsx` — slip preview modal (print + WhatsApp)
- `src/components/returns/returnSlipHTML.ts` — printable slip HTML incl. a jsbarcode-rendered code image
- `src/components/pos/CreditPanel.tsx` — applied credit, remaining balance, "pay out in cash" control
- `src/components/ui/PinPrompt.tsx` — 4-digit admin PIN dialog, reusable

**Modify:**
- `src/lib/database.types.ts` — new columns/tables/functions
- `src/repositories/base/DatabaseAdapter.ts` / `SupabaseAdapter.ts` — nothing (the `rpc()` added in `20260725000001` is sufficient)
- `src/services/ReturnService.ts` — add `createScannedReturn()` calling `issue_return_credit`; leave the existing approve/reject paths alone
- `src/services/index.ts` — wire `StoreCreditService`
- `src/components/Returns.tsx` — replace the sale `<select>` (line ~206) with `ReturnScanPanel`; show slip after save
- `src/components/POS.tsx` — credit lookup by code, balance-based discount, atomic redemption on checkout, cash payout, scan routing for `RET-`/`RVL-` codes, offline guard
- `src/components/pos/CartItemsList.tsx` — nothing
- `src/components/DayManagement.tsx` — subtract cash refunds from expected cash; add a "Cash refunds" line
- `src/components/Settings.tsx` — admin PIN set/change; three limit inputs
- `src/components/invoice/InvoicePreview.tsx` + `receiptHTML.ts` — show credit applied and remaining

**Note:** `src/components/products/VariantForm.tsx`, `VariantGrid.tsx` and `src/hooks/useVariants.ts` are dead code (nothing imports them). Do not build on them.

---

## Task 1: Schema migration

**Files:** `supabase/migrations/20260726000001_return_store_credit.sql`

- [ ] **Step 1: Verify pgcrypto is reachable.** Run `select extnamespace::regnamespace, extname from pg_extension where extname = 'pgcrypto';`. On Supabase it is normally in `extensions`, so calls must be `extensions.crypt(...)` / `extensions.gen_salt(...)`. Record the correct prefix and use it consistently in Task 2. Do not assume `public`.
- [ ] **Step 2: Extend `gift_vouchers`.**
  - allow `'return_credit'` in the `issued_source` CHECK (currently `'sold' | 'reward'`, from `20260531000003`)
  - `balance decimal(10,2)` — backfill `case when status = 'active' then amount else 0 end`, then set NOT NULL with `CHECK (balance >= 0 AND balance <= amount)`
  - `return_id uuid REFERENCES returns(id) ON DELETE SET NULL`
  - index on `return_id`
- [ ] **Step 3: Allow `'store_credit'` in `returns.refund_method`.** Existing values `'cash' | 'credit_note' | 'exchange'` keep their current meanings — `credit_note` still means "reduce this customer's debt" and is untouched by this feature.
- [ ] **Step 4: Create `credit_payouts`.** `id`, `voucher_id` (NOT NULL, FK), `amount decimal(10,2) CHECK (amount > 0)`, `sale_id` (nullable — set when the payout happened alongside a sale), `paid_by_staff_id`, `approved_by_admin_id` (nullable — null means it was under the PIN limit), `created_at`. Index on `created_at` (the day-end query filters by date) and on `voucher_id`. A separate table rather than columns on the voucher, because partial balances mean one credit can be paid out more than once.
- [ ] **Step 5: Add `user_profiles.approval_pin_hash text`.** Add an RLS policy so the column is never readable by non-admins — simplest correct approach is to leave existing SELECT policies alone and rely on the PIN only ever being compared inside a SECURITY DEFINER function (Task 2), never selected by the client.
- [ ] **Step 6: Create `approval_attempts`.** `id`, `attempted_by` (the calling user), `succeeded boolean`, `created_at`. Index on `(attempted_by, created_at)`. Used to lock out PIN guessing.
- [ ] **Step 7: Seed `app_settings`** (key/value text, upsert so re-running is safe):
  - `return_pin_limit` = `'5000'` — a desk return whose total exceeds this needs an admin PIN
  - `cash_payout_pin_limit` = `'500'` — a cash payout above this needs an admin PIN
  - `return_credit_validity_days` = `'30'`
- [ ] **Step 8: RLS on the new tables.** `credit_payouts`: authenticated may SELECT; INSERT only via the function (revoke direct insert). `approval_attempts`: no client SELECT or INSERT at all — function-only.
- [ ] **Verify:** apply to a scratch Postgres (`docker run postgres:15`) with the existing schema loaded; confirm the backfill leaves `balance = amount` for active vouchers and `0` for used ones, and that `balance <= amount` holds for every row.

---

## Task 2: Database functions

**Files:** `supabase/migrations/20260726000002_return_credit_functions.sql`

All functions must state their security mode explicitly and be granted to `authenticated` only, with `REVOKE ALL ... FROM public` first — same pattern as `20260725000001_atomic_stock_deduction.sql`.

- [ ] **Step 1: `set_admin_pin(p_pin text)`.** SECURITY DEFINER. Caller must be an active `admin` (check via `get_current_user_role()`, which already exists). Reject a PIN that is not exactly 4 digits. Reject a PIN already in use by another admin — loop the other admins and test `crypt(p_pin, their_hash) = their_hash` — so an approval can always be attributed to one person. Store `crypt(p_pin, gen_salt('bf'))`.
- [ ] **Step 2: `verify_admin_pin(p_pin text) returns uuid`.** SECURITY DEFINER. Returns the matching admin's id, or raises. Before comparing: count rows in `approval_attempts` for the calling user where `succeeded = false` and `created_at > now() - interval '15 minutes'`; if `>= 5`, raise `PIN_LOCKED`. Then test the PIN against every active admin's hash. Record the attempt either way. Raise `PIN_INVALID` on no match. **A 4-digit PIN is only 10,000 combinations — without this lockout the PIN is guessable in minutes over the API.**
- [ ] **Step 3: `issue_return_credit(p_items jsonb, p_reason text, p_phone text, p_customer_id uuid, p_pin text)`.** SECURITY INVOKER. One transaction doing all of:
  1. validate each item: batch exists, `quantity > 0`, `amount <= batch.selling_price * quantity` (the "never above tag price" rule) — raise `AMOUNT_ABOVE_TAG` otherwise
  2. sum the total; if it exceeds `return_pin_limit`, require `p_pin` and call `verify_admin_pin`, recording the admin on the return
  3. insert `returns` (`sale_id` null, `refund_method = 'store_credit'`, `status = 'approved'`)
  4. insert `return_items` (`sale_item_id` null, `batch_id` set)
  5. call `restore_batch_stock` to put stock back into those exact batches
  6. insert the `gift_vouchers` row: generated code, `amount` = total, `balance` = total, `issued_source = 'return_credit'`, `return_id`, `expires_at` from `return_credit_validity_days`
  7. return the code, amount and expiry as jsonb
- [ ] **Step 4: Code generation.** Mirror the existing scheme in `POS.tsx:747` — charset `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no ambiguous I/O/0/1), format `RET-XXXX-XXX`. Retry on unique-violation. The `RET-` prefix is what lets the till's scan handler tell a credit from a product barcode.
- [ ] **Step 5: `redeem_credit_to_sale(p_code text, p_amount numeric, p_sale_id uuid)`.** SECURITY INVOKER. `update gift_vouchers set balance = balance - p_amount where code = p_code and status = 'active' and balance >= p_amount and (expires_at is null or expires_at >= current_date)`; if not FOUND, raise `CREDIT_UNAVAILABLE`. When the new balance is 0, set `status = 'used'`, `redeemed_at = now()`, `redeemed_in_sale_id`. **Relative decrement in one statement — the same reason stock deduction had to move into SQL. Two tills could otherwise spend the same credit.**
- [ ] **Step 6: `payout_credit_cash(p_code text, p_amount numeric, p_sale_id uuid, p_pin text)`.** SECURITY INVOKER. Read `cash_payout_pin_limit`; if `p_amount` exceeds it, require and verify the PIN. Decrement the balance with the same guarded UPDATE as Step 5, then insert `credit_payouts`. Return the approving admin id (or null) so the UI can show who authorised it.
- [ ] **Verify:** in a scratch Postgres, prove each of these:
  - correct PIN succeeds; wrong PIN raises `PIN_INVALID`; 5 wrong attempts then a *correct* PIN raises `PIN_LOCKED`
  - `issue_return_credit` with an amount above the batch price raises `AMOUNT_ABOVE_TAG` and writes nothing (no orphan `returns` row)
  - two concurrent `redeem_credit_to_sale` calls for the full balance: one succeeds, one raises — same two-session test used for `deduct_batch_stock`
  - a payout under the limit needs no PIN; over the limit without a PIN raises

---

## Task 3: Service layer

**Files:** `src/services/StoreCreditService.ts`, `src/services/ReturnService.ts`, `src/services/index.ts`, `src/lib/database.types.ts`

- [ ] **Step 1:** Add the new tables, columns and function signatures to `database.types.ts` so the RPC calls stay typed (the `Functions` block already has the two stock functions to follow as a pattern).
- [ ] **Step 2:** `StoreCreditService` with `lookup(code)`, `redeemToSale(code, amount, saleId)`, `payoutCash(code, amount, saleId, pin?)`. `lookup` returns code, amount, balance, `issued_source`, expiry and status so the UI can label it "Return credit" or "Gift voucher".
- [ ] **Step 3:** Map raised exceptions to cashier-readable messages, as `InventoryService.deductStock` does for `INSUFFICIENT_STOCK`: `CREDIT_UNAVAILABLE` → "This credit has already been used or has expired.", `PIN_INVALID` → "Incorrect PIN.", `PIN_LOCKED` → "Too many wrong PINs. Try again in 15 minutes.", `AMOUNT_ABOVE_TAG` → "Refund cannot be more than the item's price."
- [ ] **Step 4:** `ReturnService.createScannedReturn(...)` calling `issue_return_credit`. Do not touch `approveReturn`/`rejectReturn`/`restoreStockForItems`.
- [ ] **Verify:** `npm run typecheck` shows no new errors against the current baseline of 27; `npx eslint` on touched files matches baseline.

---

## Task 4: Admin PIN dialog + Settings

**Files:** `src/components/ui/PinPrompt.tsx`, `src/components/ui/index.ts`, `src/components/Settings.tsx`

- [ ] **Step 1:** `PinPrompt` — modal, 4 digit boxes, auto-advance, auto-submit on the 4th, `type="password"`, Escape cancels. Returns the entered PIN to its caller; it does **not** verify anything itself. Verification only ever happens server-side.
- [ ] **Step 2:** Settings — admin-only section to set/change own PIN (confirm by entering twice). Surface `PIN_TAKEN` as "Another admin already uses this PIN — choose a different one."
- [ ] **Step 3:** Settings — three numeric inputs for the limits, written to `app_settings` with the existing upsert helper (`Settings.tsx:887`). Label them in plain language, e.g. "Cash refunds above this need admin approval".
- [ ] **Verify:** set a PIN as admin; confirm a `cashier` account sees neither the PIN section nor the limit inputs.

---

## Task 5: Returns page — scan-based intake

**Files:** `src/components/returns/ReturnScanPanel.tsx`, `src/components/Returns.tsx`

- [ ] **Step 1:** Build `ReturnScanPanel`. Barcode input (autofocused, accepts scanner or typing) → `variantService.findByBarcode` then fall back to SKU → resolve the variant with its batches.
- [ ] **Step 2:** Batch picker listing that variant's batches: received date, selling price, current stock — the same information and ordering as `VariantPicker`'s batch step (`VariantPicker.tsx:242`), which cashiers already know. Selecting one adds a line with the amount prefilled to `selling_price × qty`.
- [ ] **Step 3:** Line list: item name, size/colour, batch, qty, amount. Amount is editable **downward**; typing above the batch price warns inline that it needs admin approval (the server enforces this regardless).
- [ ] **Step 4:** Reason (required) and phone (optional). Running total shown. If the total exceeds `return_pin_limit`, the Confirm button opens `PinPrompt` first.
- [ ] **Step 5:** Rip out the sale `<select>` at `Returns.tsx:206` and the query that loads every sale to populate it. Leave the returns *list*, filters and approve/reject flow untouched — it already renders `ret.sale?.sale_number ?? '—'` (`Returns.tsx:341`), so bill-less rows display correctly with no change.
- [ ] **Step 6:** Block the whole panel when `!navigator.onLine` with a clear message. Issuing credit needs the server; there is no offline path and it must not appear to work.
- [ ] **Verify:** scan an item with two batches, pick the older one, confirm stock rises **on that batch only** and the credit amount equals that batch's price.

---

## Task 6: Slip — print and WhatsApp

**Files:** `src/components/returns/returnSlipHTML.ts`, `src/components/returns/ReturnSlip.tsx`

- [ ] **Step 1:** Build the slip HTML following `vouchers/voucherCardHTML.ts` — same structure, `@media print` block, and `openVoucherCard`-style new-window-then-print (`voucherCardHTML.ts:357`).
- [ ] **Step 2:** Render the code as a **scannable Code128 image**: `JsBarcode` onto a canvas, `toDataURL()`, embed as `<img>`. Follow the canvas setup in `BarcodeGenerator.tsx:115`. Print the code as text underneath as well, so it can be typed if the print is smudged.
- [ ] **Step 3:** Show items, amount, expiry date and a short "how to use" line.
- [ ] **Step 4:** Reuse `normalisePhone` + `buildWhatsAppMessage`/`openWhatsApp` (`voucherCardHTML.ts:325-353`) so the code can also be sent to the customer — this is what makes a lost slip a non-event.
- [ ] **Verify:** print to PDF and scan the barcode from the screen with the shop scanner; the scanned text must equal the code exactly.

---

## Task 7: POS — redeem, remainder, cash payout

**Files:** `src/components/POS.tsx`, `src/components/pos/CreditPanel.tsx`

- [ ] **Step 1:** Replace `applyVoucher` (`POS.tsx:783`) with a `StoreCreditService.lookup` call. Keep the same input box. Show the type ("Return credit" / "Gift voucher") and the **balance**, not the face amount.
- [ ] **Step 2:** Change `voucherDiscount` (`POS.tsx:681`) to `Math.min(credit.balance, ...)`. Rename the state from `appliedVoucher` for clarity if it stays readable.
- [ ] **Step 3:** `CreditPanel` in the cart: credit applied, amount used on this sale, remainder. When there is a remainder, offer **Keep on the code** (default) or **Pay out in cash**. Cash above `cash_payout_pin_limit` opens `PinPrompt`.
- [ ] **Step 4:** On checkout, call `redeem_credit_to_sale` with the applied amount and the new sale id, replacing the blind `status = 'used'` update at `POS.tsx:893-897`. **That update currently consumes the whole voucher regardless of value — it is the bug that loses customers' money today.** If a cash remainder was chosen, call `payout_credit_cash` after the sale exists.
- [ ] **Step 5:** Empty-cart payout: scanning a credit with nothing in the cart offers a full cash payout (`sale_id` null), PIN-gated by the same limit.
- [ ] **Step 6:** Scan routing. The global key handler builds `barcodeBuffer` and calls `searchProductByBarcode` on Enter (`POS.tsx:264`). Route buffers starting `RET-` or `RVL-` to the credit lookup instead, so the cashier scans the slip rather than typing the code.
- [ ] **Step 7:** Offline guard — if `!navigator.onLine`, refuse to apply a credit with a clear message. Do **not** attempt an optimistic local balance; a credit spent offline cannot be validated and would let the same code be used at two tills. This is the one place the offline-first design must say no.
- [ ] **Verify:** credit 1,200 against an 800 sale → 400 remains on the code and can be applied to a later sale. Then repeat choosing cash → balance 0, one `credit_payouts` row, correct approving admin recorded.

---

## Task 8: Receipt

**Files:** `src/components/invoice/InvoicePreview.tsx`, `src/components/invoice/receiptHTML.ts`

- [ ] **Step 1:** Show "Return credit" as its own line with the amount applied, distinct from the existing discount lines.
- [ ] **Step 2:** When a balance remains, print the code and remaining amount so the customer knows what they still hold.
- [ ] **Step 3:** When cash was paid out, print it as a separate line — it is not change.
- [ ] **Verify:** all three cases on the printed receipt and the WhatsApp/preview version, which are generated separately.

---

## Task 9: Day-end cash reconciliation

**Files:** `src/components/DayManagement.tsx`

- [ ] **Step 1:** `totalCashInDrawer` (`DayManagement.tsx:111`) is currently cash sales + mixed cash portions, derived only from `sales`. Subtract the day's `credit_payouts` total. **Without this the drawer reads short by every cash refund given, with nothing on screen to explain it.**
- [ ] **Step 2:** Add a "Cash refunds" line to the summary showing the total and count, alongside the existing expected-cash breakdown (`DayManagement.tsx:223-231`).
- [ ] **Verify:** issue a credit, pay it out in cash, and confirm expected cash falls by exactly that amount and the new line matches.

---

## Task 10: Check voucher reporting

**Files:** wherever vouchers are aggregated — search `issued_source`, `gift_vouchers`

- [ ] **Step 1:** Find every place vouchers are summed or counted (Settings/reports/dashboard).
- [ ] **Step 2:** Exclude or separate `issued_source = 'return_credit'`. A sold voucher is money received; a return credit is money owed. **If any report sums vouchers as income, return credits will silently inflate revenue.**
- [ ] **Verify:** issue one return credit and confirm no revenue or voucher-sales figure moves.

---

## Task 11: Port to the other two repos

- [ ] **Step 1:** `silora-fashion-pos` and `sktex-pos` hold the same codebase; only branding files differ (`BusinessProfileContext.tsx`, `Login.tsx`, `Layout.tsx`, `invoice/*`, `Customers.tsx`, `SalesStaff.tsx`, `vouchers/voucherCardHTML.ts`, assets). Before copying, confirm each target file still matches retail-pos's pre-change version, as was done for `20260725000001`.
- [ ] **Step 2:** `returnSlipHTML.ts` will contain shop name/branding — treat it as a **per-brand** file like `voucherCardHTML.ts` and adapt it, do not copy blindly.
- [ ] **Step 3:** Run both migrations against all three Supabase projects **before** deploying any build.
- [ ] **Verify:** all three repos typecheck and build; branding files still differ between repos.

---

## Deliberately out of scope

- **Bill-number lookup.** Removed entirely, per decision. If discount arbitrage (buy on sale, return at tag price) becomes a real loss, the cheapest countermeasure is an optional bill-number field feeding the existing `findSaleByNumber`, which would give the true price paid.
- **Per-unit serial tracking.** The only way to know *which* physical item is being returned. Not worth it for garments.
- **Offline returns or offline redemption.** Both need server validation.
- **Cash refunds from the desk.** The desk has no drawer; the till pays out.

## Risks

1. **Task 7 Step 4 changes existing gift-voucher behaviour.** Vouchers currently consume in full; after this they consume partially. That is the intended fix, but it changes live behaviour for a feature already in use — worth telling staff before deploying.
2. **4-digit PINs are weak by nature.** The lockout in Task 2 Step 2 is what makes them acceptable. Do not ship the PIN check without it.
3. **Deploy order.** Both migrations must be applied before the frontend, or credit lookup fails with "function does not exist" at the till.
