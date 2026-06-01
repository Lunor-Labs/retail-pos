# POS System — Commercial Packaging & Pricing Design

**Date:** 2026-06-01
**Author:** Dinesh Sandaruwan
**Market:** Sri Lanka — Clothing Retail Shops

---

## 1. Overview

Package the existing RIVONLAK POS system as a commercial SaaS product to sell to other clothing retail shops in Sri Lanka. The system runs on React + Supabase and is already multi-tenant capable. Each customer gets their own Supabase project (data isolation) deployed and managed by the vendor.

The model is **SaaS with flexible billing**: monthly subscription, annual subscription (discounted), or one-time lifetime deal. Three feature-gated tiers target shops from small boutiques to established retailers.

---

## 2. Target Market

| Segment | Description |
|---|---|
| Small boutiques & street stalls | 1-person operations, up to ~500 products, tight budget |
| Established clothing shops | 2–5 staff, active inventory management, want loyalty & vouchers |
| Larger clothing retailers | 5+ staff, referral agents, high volume, need custom branding |

Sri Lankan market notes:
- Price-sensitive market; position below international competitors (Vend, Lightspeed) and on par or below local alternatives (SimplBooks ~LKR 2,500–5,000/month)
- One-time lifetime deals are highly appealing post-2022 economic crisis — shops distrust recurring fees
- WhatsApp is the primary support and communication channel
- Full in-person or remote onboarding is expected at this price point

---

## 3. Tiers & Features

### 3.1 Starter
**Target:** Small boutique, street stall, 1-person shop

| Feature | Included |
|---|---|
| POS billing (cart, variants, discounts) | ✅ |
| Barcode generation | ✅ |
| Invoice & receipt printing | ✅ |
| Product management (up to 500 variants) | ✅ |
| Customer records | ✅ |
| Returns | ✅ |
| Basic sales reports (last 30 days) | ✅ |
| 2 user accounts (1 admin + 1 cashier) | ✅ |
| Full inventory + purchase orders | ❌ |
| Supplier management | ❌ |
| Loyalty points | ❌ |
| Gift vouchers | ❌ |
| Staff commissions | ❌ |
| Cost price encoding | ❌ |
| Bulk product import | ❌ |
| Referral agent tracking | ❌ |
| Custom branding on receipts | ❌ |
| Priority support | ❌ |

---

### 3.2 Professional
**Target:** Established clothing shop, 2–5 staff

Everything in Starter, plus:

| Feature | Included |
|---|---|
| Unlimited products & variants | ✅ |
| 5 user accounts | ✅ |
| Full inventory management + purchase orders | ✅ |
| Supplier management | ✅ |
| Loyalty points system | ✅ |
| Gift vouchers (PDF generation + WhatsApp delivery) | ✅ |
| Returns with voucher tracking | ✅ |
| Sales staff commission tracking | ✅ |
| Cost price encoding (hide margins from staff) | ✅ |
| Bulk product import (CSV) | ✅ |
| Full sales report history (up to 1 year) | ✅ |

---

### 3.3 Business
**Target:** Larger clothing retailer, 5+ staff, high volume

Everything in Professional, plus:

| Feature | Included |
|---|---|
| Unlimited user accounts | ✅ |
| Referral agent management & tracking | ✅ |
| Custom branding on invoices & receipts (shop logo) | ✅ |
| Unlimited report history | ✅ |
| Priority WhatsApp support (same-day response) | ✅ |

---

## 4. Pricing (LKR)

| Plan | Monthly | Annual | Lifetime (one-time) |
|---|---|---|---|
| **Starter** | LKR 2,500 | LKR 25,000 *(save LKR 5,000)* | LKR 75,000 |
| **Professional** | LKR 5,500 | LKR 55,000 *(save LKR 11,000)* | LKR 160,000 |
| **Business** | LKR 11,000 | LKR 110,000 *(save LKR 22,000)* | LKR 320,000 |

### Pricing rationale
- **Monthly** is priced below local competitors to win on value
- **Annual** = ~17% off monthly (equivalent to 2 months free) — incentivises commitment
- **Lifetime** = 30 months of monthly — strong appeal in Sri Lankan market; gives vendor upfront cash flow
- All tiers include a **14-day free trial** before payment is required

---

## 5. What Every Customer Gets (All Tiers)

- **Full onboarding** — vendor sets up the customer's Supabase instance, imports initial product data, trains staff in person or via video call
- **14-day free trial** — no payment required upfront
- **Free feature updates** — new features added to their tier are deployed automatically
- **WhatsApp support** during business hours (priority response guaranteed same-day for Business tier)

---

## 6. Add-ons (Optional Upsells)

| Add-on | Price |
|---|---|
| Extra branch (Starter or Pro customers) | LKR 2,000/month per branch |
| Extra user beyond tier limit | LKR 500/month per user |
| Data migration from existing system | LKR 10,000 one-time |
| Extra staff training session | LKR 3,000 per session |

Add-ons allow shops to grow beyond their tier limits without forcing a full upgrade, generating additional revenue for the vendor.

---

## 7. Delivery & Operations

### Per-customer setup
1. Create a new Supabase project for the customer
2. Run schema migrations to set up their database
3. Deploy the web app (Vercel or Netlify) pointed at their Supabase project
4. Configure their shop name, logo, and initial settings
5. Conduct onboarding session (in person or via video call)

### Ongoing operations
- Vendor is responsible for Supabase project upkeep, backups, and updates
- Feature flags (to be implemented) enforce tier limits in the frontend
- Support is handled via WhatsApp; Business tier gets priority queue

---

## 8. Feature Flags — Implementation Requirement

Each tenant's Supabase database gets a `subscription` table. The frontend reads this on app load and stores the active tier in React context. All feature-gated components read from this context.

### 8.1 `subscription` table schema

```sql
subscription (
  id              uuid primary key default gen_random_uuid(),
  shop_name       text not null,
  tier            text not null check (tier in ('starter', 'professional', 'business')),
  billing_type    text not null check (billing_type in ('monthly', 'annual', 'lifetime')),
  started_at      timestamptz not null default now(),
  expires_at      timestamptz,          -- null for lifetime deals
  active          boolean not null default true,
  notes           text,                 -- vendor notes, e.g. "paid via bank transfer 2026-06-01"
  updated_at      timestamptz not null default now()
)
```

Only one row exists per tenant. The app reads the single active row on load.

### 8.2 Per-feature flag map

The frontend maps tier → enabled features via a constant:

```ts
const TIER_FEATURES = {
  starter: [
    'pos', 'products_basic', 'customers', 'returns',
    'barcode', 'invoice', 'reports_basic', 'sales_history_30d'
  ],
  professional: [
    ...TIER_FEATURES.starter,
    'products_unlimited', 'inventory', 'purchase_orders',
    'suppliers', 'loyalty', 'vouchers', 'commissions',
    'cost_encoding', 'bulk_import', 'reports_1yr'
  ],
  business: [
    ...TIER_FEATURES.professional,
    'referral_agents', 'custom_branding', 'reports_unlimited', 'priority_support'
  ]
}
```

### 8.3 Gating behaviour

- Features the current tier **includes**: shown and fully functional
- Features the current tier **excludes**: shown with a lock icon + "Upgrade to Pro/Business" prompt — never hidden entirely, to encourage upsells
- If `subscription.active = false` (expired or suspended): app shows a full-screen "Account suspended — contact support" gate; POS still works in read-only mode so the shop isn't completely blocked mid-trading day

---

## 9. Super Admin — Subscription Management

### 9.1 Approach: Hybrid (manual now, portal later)

**Phase 1 (now):** The vendor (Dinesh) manages subscriptions by directly updating the `subscription` table in each tenant's Supabase project via the Supabase dashboard. No extra app needed. Practical for up to ~30 shops.

**Phase 2 (future, when needed):** A protected `/super-admin` route in the app gives the vendor a single-screen dashboard to view and manage all tenant subscriptions. This route is only accessible to a user with `role = 'super_admin'` — a new role value added to the existing `user_profiles` table.

### 9.2 Super admin role

A `super_admin` role is added alongside the existing `admin | cashier | stock_manager` roles. It is:
- Only ever assigned to the vendor (Dinesh) — one account per tenant Supabase
- Not visible to the shop owner in the UI
- Able to access the `/super-admin` route and modify the `subscription` table
- Excluded from all normal shop workflows (does not appear in staff lists, commission reports, etc.)

### 9.3 Phase 1 workflow (manual)

When a customer pays:
1. Open their Supabase project dashboard
2. Update the `subscription` row: set `tier`, `billing_type`, `expires_at`, `active = true`, add a `notes` entry
3. The app picks up the change on the customer's next page load (or immediately via Supabase realtime)

When a subscription expires or is suspended:
1. Set `active = false` in their `subscription` row
2. App shows the suspension gate; shop can still view past sales but cannot process new ones

### 9.4 Phase 2 super admin portal (future scope)

A single protected page at `/super-admin` showing:
- Table of all tenants: shop name, tier, billing type, expiry date, active status
- Inline edit controls: change tier, extend expiry, toggle active
- Filter by tier, expiry status

This page is built only once the manual approach becomes unmanageable (estimated threshold: 30+ active tenants).

---

## 10. Out of Scope (Future)

- **Multi-branch support** — not built yet; current workaround is a separate account per branch with the extra-branch add-on fee
- **Online payment integration** (PayHere, iPay) for subscription billing — manual collection initially
- **Customer self-signup portal** — onboarding is manual for now
- **Mobile app** — web app is mobile-responsive but no native app
- **Super admin portal (Phase 2)** — deferred until 30+ active tenants

---

## 11. Success Criteria

- A new customer can be fully onboarded within 1 business day
- Feature gating enforces tier limits without breaking the app for any tier
- Vendor can activate, suspend, or change tier for any tenant in under 2 minutes via Supabase dashboard
- Pricing is competitive with local alternatives while reflecting the system's full feature value
