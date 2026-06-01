# Voucher Payment & Return Tracking

**Date:** 2026-05-31
**Scope:** Gift Vouchers page only (not POS reward mini-modal)

## Problem

When a customer pays money for a gift voucher to send to someone else, that cash-in is currently untracked. Similarly, when a voucher is returned and a refund is given, there is no record of the cash-out. This creates a gap in financial accuracy — the Gift Vouchers page shows counts and face values but not actual money movement.

## Goal

Track cash collected when a voucher is sold and cash returned when a voucher is refunded. Distinguish sold vouchers (money exchanged) from reward vouchers (shop-initiated, free). Surface a financial summary — Cash In, Cash Out, Net — directly on the Gift Vouchers page.

---

## Data Model

### New columns on `gift_vouchers`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `issued_source` | `text` | No | `'sold'` (Gift Vouchers page) or `'reward'` (POS mini-modal). Set at insert time. |
| `paid_amount` | `decimal(10,2)` | Yes | Amount collected from buyer. Only populated when `issued_source = 'sold'`. |
| `paid_via` | `text` | Yes | `'cash'` or `'card'`. Only for `sold` vouchers. |
| `returned_at` | `timestamptz` | Yes | Timestamp of return. Null until returned. |
| `refund_amount` | `decimal(10,2)` | Yes | Refund given — can be partial. Set when returned. |
| `refund_via` | `text` | Yes | `'cash'` or `'card'`. Set when returned. |
| `return_note` | `text` | Yes | Optional reason for return. |

### Status enum change

Add `'returned'` to the existing check constraint alongside `'active'`, `'used'`, `'voided'`.

- `voided` = admin cancellation, no money exchanged
- `returned` = customer returned voucher, refund was issued

### Migration

A new migration file adds all columns and updates the status check constraint. Existing rows get `issued_source = 'reward'` as a safe default (they predate this feature and have no payment data).

---

## UI Changes

### IssueModal (Gift Vouchers page)

Two new fields added above the action buttons:

- **Amount Paid** — number input, pre-filled with the voucher face value (editable to allow discounts or goodwill adjustments)
- **Paid Via** — Cash / Card pill selector, defaults to Cash

Both are optional so the form can still be submitted without payment info (e.g. a complimentary sold voucher). Sets `issued_source = 'sold'` on insert.

The submit button label changes from "Issue & Download Card" to "Issue Voucher" (PDF card was removed in a prior change).

### POS mini-modal

No payment fields. Sets `issued_source = 'reward'` on insert. No change to existing behaviour.

### Return Modal (new)

A small modal triggered by a ↩ Return button on active `sold` vouchers.

Fields:
- **Refund Amount** — pre-filled from `paid_amount`, editable for partial refunds
- **Refund Via** — Cash / Card pill selector
- **Note** — optional text

On confirm: sets `status = 'returned'`, writes `returned_at`, `refund_amount`, `refund_via`, `return_note`.

### Void button

Remains for admin cancellations where no money was exchanged. Only shown to admins. The Return button is shown separately — both can coexist on active sold vouchers, admins see both.

### Voucher list rows

- A small `Sold` or `Reward` badge appears on each row to make the source immediately visible.
- Returned vouchers show the refund amount and date below the status badge.

### KPI strip

Three new financial cards added after the existing four:

| Card | Value |
|---|---|
| **Cash In** | Sum of `paid_amount` for `sold` vouchers that are not `returned` |
| **Cash Out** | Sum of `refund_amount` for `returned` vouchers |
| **Net** | Cash In − Cash Out (highlighted card) |

### Filter tabs

`Returned` tab added alongside All / Active / Redeemed / Voided.

---

## Error Handling

- Refund amount must be > 0 and ≤ `paid_amount` (or ≤ voucher face value if `paid_amount` is null). Show inline validation error if exceeded.
- `issued_source` is required at insert; the application sets it — no user input needed.
- DB constraint on `status` will reject unknown values; any insert/update error surfaces as a toast.

---

## Out of Scope

- Payment tracking for POS reward vouchers (these are free by definition)
- Partial return of a voucher's value (a voucher is returned whole; only the refund amount is flexible)
- Multi-currency support
- Reporting page integration (financial summary lives on the Gift Vouchers page only)
