# Sales Staff Monthly Commission Report — Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

Add a **Commission Report** tab to the existing Sales Staff page. Admins can view each staff member's monthly commission, drill down into a day-by-day breakdown showing whether they hit their daily target, mark commissions as paid, and print/export the report.

---

## Commission Calculation

Commission is earned on days where a staff member's total revenue **meets or exceeds** their daily target. The entire day's revenue qualifies on those days — days below the target contribute nothing.

```
for each day in month:
  if day_revenue >= daily_target:
    commission_base += day_revenue
  else:
    commission_base += 0

commission_amount = commission_base × (commission_rate / 100)
```

**Example** (rate = 3%, target = LKR 15,000):

| Date  | Revenue | Target | Hit? | Commission |
|-------|---------|--------|------|------------|
| May 1 | 22,000  | 15,000 | ✓    | 660        |
| May 2 | 12,000  | 15,000 | ✗    | —          |
| May 3 | 18,500  | 15,000 | ✓    | 555        |
| **Total** | | | | **1,215** |

---

## Data Model Changes

### 1. Add `commission_rate` column

```sql
ALTER TABLE user_profiles  ADD COLUMN commission_rate decimal(5,2) NOT NULL DEFAULT 0;
ALTER TABLE staff_members  ADD COLUMN commission_rate decimal(5,2) NOT NULL DEFAULT 0;
```

### 2. New `staff_commission_payments` table

Tracks when an admin marks a staff member's monthly commission as paid.

```sql
CREATE TABLE staff_commission_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL,
  staff_source  text NOT NULL CHECK (staff_source IN ('profile', 'member')),
  month         text NOT NULL,       -- 'YYYY-MM'
  commission_amount decimal(10,2) NOT NULL,
  paid_at       timestamptz NOT NULL DEFAULT now(),
  paid_by       uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  UNIQUE (staff_id, month)
);

ALTER TABLE staff_commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view commission payments"
  ON staff_commission_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage commission payments"
  ON staff_commission_payments FOR ALL TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
```

---

## UI — Tab Structure

The Sales Staff page gains two tabs in the header area:

- **Staff** — existing split-panel view (unchanged)
- **Commission Report** — new tab

---

## UI — Commission Report Tab

### Month Selector
A row at the top with left/right arrows to navigate months. Defaults to the current month. Label shows `"May 2026"` format.

### KPI Strip (4 cards)
| Card | Value |
|------|-------|
| Total Commissions Due | Sum of all pending commission amounts |
| Staff Earning Commission | Count with commission_amount > 0 |
| Total Paid | Sum of paid amounts for the month |
| Pending Payout | Total Due − Total Paid |

### Staff Commission Table

One row per staff member, sorted by commission amount descending.

**Columns:**
| Column | Notes |
|--------|-------|
| Name + avatar | Same avatar style as Staff tab |
| Rate | `commission_rate %` — editable inline by admin |
| Monthly Revenue | Total revenue for the month |
| Qualifying Days | Count of days that hit the target |
| Commission Base | Sum of revenue on qualifying days |
| Commission Amount | Base × rate% |
| Status | `✓ Paid` badge or `Pending` |
| Action | **Pay** button (admin, pending only) / locked when paid |
| Expand | `▶` / `▼` chevron |

### Day-by-Day Breakdown (expand on click)

Clicking a row expands an inline sub-table beneath it:

**Columns:**
| Column | Notes |
|--------|-------|
| Date | `May 1` format |
| Revenue | That day's total sales |
| Target | Their daily target |
| Hit? | ✓ green / ✗ neutral |
| Commission Earned | Revenue × rate% if hit, else `—` |

- Rows where target was hit are highlighted with a subtle green background
- Days with no sales are shown with `—` for Revenue and `✗` for Hit
- Only shows days up to today if viewing the current month

### Print / Export

A **Print** button top-right. Uses `window.print()` with a `@media print` stylesheet that:
- Hides the sidebar, nav, tabs, and action buttons
- Renders a clean table with month header and generation timestamp
- Does not include expanded day-breakdown rows

---

## Commission Rate Editing

`commission_rate` is editable in two places:

1. **Add Staff modal** — new numeric field "Commission Rate (%)" below "Daily Target"
2. **Staff detail panel** — new editable row matching the existing "Daily Target" edit pattern (pencil icon → inline input → save)

---

## Mark as Paid Flow

1. Admin clicks **Pay** on a pending row
2. A confirmation appears inline: `"Mark LKR 3,600 as paid for Kasun P. — May 2026? [Confirm] [Cancel]"`
3. On confirm: insert a record into `staff_commission_payments`, row flips to `✓ Paid` and locks
4. Paid rows cannot be un-paid from the UI (requires DB-level intervention)

---

## Error & Edge Cases

- Staff with no `commission_rate` set (0%) → show row with `LKR 0` and a subtle "No rate set" note; no Pay button
- Staff with no sales in the month → qualifying days = 0, commission = LKR 0
- Future months → show empty state: "No data yet for this month"
- Staff added mid-month → only days from their `created_at` onward are evaluated (days before join have no sales anyway, so no special handling needed)

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_commission_report.sql` | New migration (commission_rate cols + payments table) |
| `src/components/SalesStaff.tsx` | Add tab switcher, CommissionReport component |
| `src/components/SalesStaff.tsx` | Add commission_rate field to Add Staff modal + detail panel |
| `src/index.css` | Print styles for commission report |
