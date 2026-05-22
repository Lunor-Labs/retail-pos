# Mobile Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dashboard's mobile and tablet layout via four targeted CSS/JSX changes — no desktop behavior changes.

**Architecture:** Add three CSS utility classes to `index.css` for grid, status bar, and chart stat row responsive behaviour. Apply those classes in `Dashboard.tsx`. Swap `Layout.tsx`'s fixed `<main>` padding for Tailwind responsive classes (which the Layout already uses elsewhere).

**Tech Stack:** React, Tailwind CSS, CSS custom properties, Vite

---

## File Map

| File | Change |
|------|--------|
| `src/index.css` | Add `.grid-kpi`, `.dashboard-status`, `.chart-stat-row` |
| `src/components/Layout.tsx` | Responsive padding on `<main>` (line 291) |
| `src/components/Dashboard.tsx` | Add class names on KPI strip (line 633), status bar (line 618), chart stat row (line 121) |

---

### Task 1: Add responsive CSS classes to `index.css`

**Files:**
- Modify: `src/index.css` — append after the `.custom-scrollbar` block at the end of the file

- [ ] **Step 1: Append the three utility classes**

Open `src/index.css` and add this block at the very end of the file:

```css
/* ── Dashboard mobile ───────────────────────────────────── */
.grid-kpi {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
@media (min-width: 640px) {
  .grid-kpi { grid-template-columns: repeat(3, 1fr); gap: var(--gap); }
}
@media (min-width: 1024px) {
  .grid-kpi { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--gap); }
}

@media (max-width: 639px) {
  .dashboard-status { display: none; }
  .chart-stat-row   { display: none; }
}
```

- [ ] **Step 2: Verify the CSS parses without errors**

```bash
cd /home/dinesh-s/Documents/Dinesh/gasithmotors.lk && npm run build 2>&1 | tail -5
```

Expected: build completes with no CSS errors. (Vite surfaces CSS parse errors in the build output.)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add responsive dashboard utility classes for mobile"
```

---

### Task 2: Responsive content padding in `Layout.tsx`

**Files:**
- Modify: `src/components/Layout.tsx` line 291

- [ ] **Step 1: Replace fixed padding with Tailwind responsive classes**

Find this line in `Layout.tsx` (currently line 291):

```tsx
<main className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
```

Replace it with:

```tsx
<main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
```

This gives 12px on phones, 16px on tablets, 24px on desktop — matching the existing Tailwind breakpoints used elsewhere in Layout.tsx (`lg:hidden`, `hidden lg:flex`, etc.).

- [ ] **Step 2: Verify build still passes**

```bash
cd /home/dinesh-s/Documents/Dinesh/gasithmotors.lk && npm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "style: reduce content padding on mobile and tablet"
```

---

### Task 3: Apply class names in `Dashboard.tsx`

**Files:**
- Modify: `src/components/Dashboard.tsx` — three locations

#### 3a — KPI grid strip (line 633)

- [ ] **Step 1: Add `className="grid-kpi"` and remove inline grid styles**

Find this line in `Dashboard.tsx` (currently line 633):

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--gap)' }}>
```

Replace it with:

```tsx
<div className="grid-kpi">
```

The `.grid-kpi` class takes over `display: grid`, `grid-template-columns`, and `gap` at all breakpoints.

#### 3b — Status bar pill (line 618)

- [ ] **Step 2: Add `className="dashboard-status"` to the status bar div**

Find this line in `Dashboard.tsx` (currently line 618):

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10 }}>
```

Replace it with:

```tsx
<div className="dashboard-status" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10 }}>
```

#### 3c — Revenue chart stat row (line 121)

- [ ] **Step 3: Add `className="chart-stat-row"` to the ChartStat container**

Find this line inside the `RevenueChart` function (currently line 121):

```tsx
<div style={{ padding: '14px 18px 6px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
```

Replace it with:

```tsx
<div className="chart-stat-row" style={{ padding: '14px 18px 6px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
```

This hides the Total Revenue / Total Cost / Gross Margin stats and the Revenue/Cost legend dots on phones. The period buttons (7D / 30D / 90D / YTD) are in a sibling div and remain visible.

- [ ] **Step 4: Verify build passes**

```bash
cd /home/dinesh-s/Documents/Dinesh/gasithmotors.lk && npm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "style: apply mobile class names to dashboard KPI grid, status bar, chart stats"
```

---

### Task 4: Manual browser verification

**Files:** none — verification only

- [ ] **Step 1: Start the dev server**

```bash
cd /home/dinesh-s/Documents/Dinesh/gasithmotors.lk && npm run dev
```

Open the app at `http://localhost:5173` (or whichever port Vite reports).

- [ ] **Step 2: Check phone layout (375px)**

In Chrome DevTools, open the device toolbar and set viewport to **375 × 812** (iPhone SE / 14 portrait).

Verify:
- KPI cards show as **2 columns × 3 rows** (not a single column)
- The "Store Open · Pending returns" pill is **hidden**
- The Revenue & Cost chart's stat row (Total Revenue, Total Cost, Gross Margin) is **hidden**
- The period buttons (7D / 30D / 90D / YTD) are **still visible**
- Content has **12px padding** on left and right (no horizontal overflow)

- [ ] **Step 3: Check tablet layout (768px)**

Set DevTools viewport to **768 × 1024**.

Verify:
- KPI cards show as **3 columns × 2 rows**
- The "Store Open · Pending returns" pill is **visible**
- The Revenue chart stat row is **visible**
- Content has **16px padding**

- [ ] **Step 4: Check desktop layout (1440px)**

Set DevTools viewport to **1440 × 900** (or resize browser to full width).

Verify:
- KPI cards show as **6 in a row** (auto-fit, all on one row at typical desktop widths)
- Everything looks identical to before this change

- [ ] **Step 5: Stop the dev server** with `Ctrl+C`
