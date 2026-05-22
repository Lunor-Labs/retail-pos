# Mobile Dashboard Improvements — Design Spec

**Date:** 2026-05-22  
**Scope:** `src/components/Dashboard.tsx`, `src/components/Layout.tsx`, `src/index.css`

---

## Goal

Improve the Dashboard's mobile and tablet experience without changing the desktop layout. Staff use the dashboard on phones (≤ 428px) and tablets (768px–1024px) to check store performance at a glance.

---

## Changes

### 1. Content padding — `Layout.tsx`

Replace the fixed `padding: '24px'` inline style on `<main>` with Tailwind responsive classes:

```
className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6"
```

Breakpoints: 12px (phone) → 16px (tablet) → 24px (desktop).

### 2. KPI grid — `index.css` + `Dashboard.tsx`

Add `.grid-kpi` class to `index.css`:

```css
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
```

In `Dashboard.tsx`, add `className="grid-kpi"` to the KPI strip div and remove the inline `gridTemplateColumns` and `gap` from its `style` prop.

Result: 2 columns on phone, 3 on tablet, auto-fit on desktop.

### 3. Status bar — `index.css` + `Dashboard.tsx`

Add `.dashboard-status` class to `index.css`:

```css
@media (max-width: 639px) {
  .dashboard-status { display: none; }
}
```

Add `className="dashboard-status"` to the store hours + pending returns pill div in the page header section of `Dashboard.tsx`.

### 4. Revenue chart stat row — `index.css` + `Dashboard.tsx`

Add `.chart-stat-row` class to `index.css`:

```css
@media (max-width: 639px) {
  .chart-stat-row { display: none; }
}
```

Add `className="chart-stat-row"` to the `<div>` in `RevenueChart` that wraps the three `ChartStat` components and the `LegendDot` row (the `padding: '14px 18px 6px'` div). Period buttons remain visible at all sizes.

---

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Add `.grid-kpi`, `.dashboard-status`, `.chart-stat-row` |
| `src/components/Layout.tsx` | Responsive padding on `<main>` |
| `src/components/Dashboard.tsx` | Add class names to KPI strip, status bar, chart stat row |

---

## What is NOT changed

- Desktop layout — untouched
- The section grids (Revenue+TopSellers, Invoices+Stock, Staff+Activity) already stack correctly via `auto-fit` — no changes needed
- The revenue chart SVG itself — already responsive via `width="100%"`
- All data, logic, and component structure
