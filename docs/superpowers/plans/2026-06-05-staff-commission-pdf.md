# Staff Commission PDF Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-staff monthly commission PDF download button to the Commission tab, opening a print popup with a formatted A4 report.

**Architecture:** A new `commissionReportHTML.ts` file builds a self-contained HTML string (inline CSS + JS) for a given staff member's monthly data. `SalesStaff.tsx` calls it from a `FileDown` icon button on each commission row, opens the popup, and the popup auto-prints then closes.

**Tech Stack:** TypeScript, React, browser `window.open()` / `window.print()` — no new dependencies.

---

## Files

| Action | Path |
|--------|------|
| Create | `src/components/staff/commissionReportHTML.ts` |
| Modify | `src/components/SalesStaff.tsx` (imports, print function, Actions cell) |

---

### Task 1: Create the commission report HTML builder

**Files:**
- Create: `src/components/staff/commissionReportHTML.ts`

- [ ] **Step 1: Create the file with the data interface and builder function**

```ts
export interface CommissionReportData {
  memberName: string;
  memberRole: string;
  memberEmail: string;
  month: string;           // 'YYYY-MM'
  effectiveRate: number;
  effectiveTarget: number;
  days: Array<{ date: string; revenue: number; hit: boolean; commission: number }>;
  totalRevenue: number;
  qualifyingDays: number;
  commissionBase: number;
  commissionAmount: number;
  isPaid: boolean;
  storeName: string;
}

export function buildCommissionReportHTML(data: CommissionReportData): string {
  const {
    memberName, memberRole, memberEmail, month, effectiveRate, effectiveTarget,
    days, totalRevenue, qualifyingDays, commissionAmount, isPaid, storeName,
  } = data;

  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const generatedDate = new Date().toLocaleDateString('en-US', { dateStyle: 'long' });

  function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
  function fmtDay(dateStr: string) {
    const [, dm, dd] = dateStr.split('-').map(Number);
    return new Date(2000, dm - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const rowsHTML = days.map(d => `
    <tr class="${d.hit ? 'hit' : ''}">
      <td>${fmtDay(d.date)}</td>
      <td class="num">${d.revenue > 0 ? fmtLKR(d.revenue) : '—'}</td>
      <td class="num">${effectiveTarget > 0 ? fmtLKR(effectiveTarget) : '—'}</td>
      <td class="center">${effectiveTarget > 0 ? (d.hit ? '✓' : '✗') : '—'}</td>
      <td class="num">${d.commission > 0 ? fmtLKR(d.commission) : '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Commission Report – ${memberName} – ${monthLabel}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }

  .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .store { font-size: 16pt; font-weight: 800; letter-spacing: -0.02em; }
  .report-title { font-size: 11pt; font-weight: 700; margin-top: 2px; color: #333; }
  .meta { text-align: right; font-size: 9pt; color: #555; line-height: 1.6; }

  .staff-block { margin-bottom: 14px; }
  .staff-name { font-size: 14pt; font-weight: 700; }
  .staff-sub { font-size: 9pt; color: #555; margin-top: 2px; }

  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
  .summary-card { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; }
  .summary-label { font-size: 7.5pt; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
  .summary-value { font-size: 11pt; font-weight: 700; color: #111; }
  .summary-value.accent { color: #1B6B4F; }

  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #f4f4f4; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #555; padding: 6px 8px; border-bottom: 1px solid #ccc; text-align: left; }
  th.num { text-align: right; }
  th.center { text-align: center; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  tr.hit td { background: #f0faf5; }
  tr.hit td:first-child { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .center { text-align: center; }
  tfoot td { font-weight: 700; border-top: 2px solid #999; border-bottom: none; background: #f9f9f9; }

  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 8.5pt; font-weight: 700; }
  .status-paid { background: #e6f4ee; color: #1B6B4F; }
  .status-pending { background: #fff4e5; color: #b35c00; }

  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 7.5pt; color: #888; text-align: center; }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div>
      <div class="store">${storeName}</div>
      <div class="report-title">Commission Report</div>
    </div>
    <div class="meta">
      <div>${monthLabel}</div>
      <div>Generated ${generatedDate}</div>
    </div>
  </div>
</div>

<div class="staff-block">
  <div class="staff-name">${memberName}</div>
  <div class="staff-sub">${memberRole}${memberEmail ? ' · ' + memberEmail : ''}</div>
</div>

<div class="summary">
  <div class="summary-card">
    <div class="summary-label">Commission Rate</div>
    <div class="summary-value">${effectiveRate > 0 ? effectiveRate + '%' : '—'}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Daily Target</div>
    <div class="summary-value">${effectiveTarget > 0 ? fmtLKR(effectiveTarget) : '—'}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Total Revenue</div>
    <div class="summary-value">${totalRevenue > 0 ? fmtLKR(totalRevenue) : '—'}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Qualifying Days</div>
    <div class="summary-value">${qualifyingDays} <span style="font-size:9pt;font-weight:400;color:#666">/ ${days.length} days</span></div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Commission Amount</div>
    <div class="summary-value accent">${commissionAmount > 0 ? fmtLKR(commissionAmount) : '—'}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Payment Status</div>
    <div class="summary-value">
      <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">${isPaid ? 'Paid' : 'Pending'}</span>
    </div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Date</th>
      <th class="num">Revenue</th>
      <th class="num">Target</th>
      <th class="center">Hit?</th>
      <th class="num">Commission</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHTML}
  </tbody>
  <tfoot>
    <tr>
      <td>Total</td>
      <td class="num">${fmtLKR(totalRevenue)}</td>
      <td></td>
      <td class="center">${qualifyingDays}d</td>
      <td class="num">${commissionAmount > 0 ? fmtLKR(commissionAmount) : '—'}</td>
    </tr>
  </tfoot>
</table>

<div class="footer">Generated by ${storeName} POS · ${monthLabel}</div>

<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 150);
  });
  window.addEventListener('afterprint', function() { window.close(); });
</script>
</body>
</html>`;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npm run typecheck 2>&1 | grep "commissionReportHTML"
```
Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add src/components/staff/commissionReportHTML.ts
git commit -m "feat: add commission report HTML builder for PDF print"
```

---

### Task 2: Wire up the download button in SalesStaff.tsx

**Files:**
- Modify: `src/components/SalesStaff.tsx`

- [ ] **Step 1: Add `FileDown` to the lucide-react import (line 2)**

Replace:
```ts
import { Plus, Search, X, Pencil, ChevronRight, ChevronLeft, Users, Target, Check, ChevronDown, TrendingUp } from 'lucide-react';
```
With:
```ts
import { Plus, Search, X, Pencil, ChevronRight, ChevronLeft, Users, Target, Check, ChevronDown, TrendingUp, FileDown } from 'lucide-react';
```

- [ ] **Step 2: Add the import for `buildCommissionReportHTML` after the existing imports**

After this line:
```ts
import { supabase } from '../lib/supabase';
```
Add:
```ts
import { buildCommissionReportHTML } from './staff/commissionReportHTML';
```

- [ ] **Step 3: Add `printCommissionReportForRow` function inside `CommissionReport`**

Find the `navMonth` function inside `CommissionReport` (around line 760):
```ts
  function navMonth(delta: number) {
```
Add this new function directly above it:

```ts
  function printCommissionReportForRow(row: CommissionRow) {
    const html = buildCommissionReportHTML({
      memberName: row.member.full_name,
      memberRole: ROLE_LABEL[row.member.role],
      memberEmail: row.member.email,
      month,
      effectiveRate: row.effectiveRate,
      effectiveTarget: row.effectiveTarget,
      days: row.days,
      totalRevenue: row.totalRevenue,
      qualifyingDays: row.qualifyingDays,
      commissionBase: row.commissionBase,
      commissionAmount: row.commissionAmount,
      isPaid: row.isPaid,
      storeName: 'RIVONLAK',
    });
    const popup = window.open('', '_blank', 'width=820,height=700');
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
  }
```

- [ ] **Step 4: Add the `FileDown` button to the Actions cell**

Find the Actions cell in the commission table (around line 901):
```tsx
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="commission-print-hide">
                  {isAdmin && !row.isPaid && row.commissionAmount > 0 && !isConfirming && (
                    <button onClick={() => setConfirming(row.member.id)} className="btn" style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}>
                      Pay
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(prev => {
```

Replace that entire `{/* Actions */}` block with:

```tsx
                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="commission-print-hide">
                  {isAdmin && !row.isPaid && row.commissionAmount > 0 && !isConfirming && (
                    <button onClick={() => setConfirming(row.member.id)} className="btn" style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}>
                      Pay
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => printCommissionReportForRow(row)}
                      title="Download PDF report"
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: '1px solid var(--line)',
                        background: 'transparent', cursor: 'pointer', display: 'grid',
                        placeItems: 'center', color: 'var(--muted)',
                      }}
                    >
                      <FileDown size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded(prev => {
```

- [ ] **Step 5: Verify types compile with no new errors in SalesStaff**

```bash
npm run typecheck 2>&1 | grep "SalesStaff"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/SalesStaff.tsx
git commit -m "feat: add per-staff commission PDF download button"
```

---

## Verification

1. Run `npm run typecheck` — must pass with no new errors.
2. Start the dev server: `npm run dev`
3. Navigate to **Sales Staff → Commission tab**.
4. Confirm a download icon (`↓` arrow) appears on each staff row in the Actions column.
5. Click the icon for a staff member — a print dialog should open with:
   - Store name + "Commission Report" header
   - Staff name, role, email
   - Month and generated date
   - 6-card summary grid (rate, target, revenue, qualifying days, commission, status)
   - Day-by-day table with qualifying days highlighted in green
   - Total row at the bottom
6. Use "Save as PDF" in the print dialog — confirm file downloads correctly.
7. Verify the popup closes after printing.
