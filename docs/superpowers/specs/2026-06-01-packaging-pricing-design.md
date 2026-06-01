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

To enforce tier gating in the app, a `subscription` table or config record per tenant must be added. The frontend reads the current tier and shows/hides features accordingly. Minimum fields needed:

```
subscription {
  shop_id
  tier: 'starter' | 'professional' | 'business'
  billing_type: 'monthly' | 'annual' | 'lifetime'
  started_at
  expires_at (null for lifetime)
  active: boolean
}
```

Feature flags are checked at component level — locked features show an upgrade prompt rather than being hidden entirely, to drive upsells.

---

## 9. Out of Scope (Future)

- **Multi-branch support** — not built yet; current workaround is a separate account per branch with the extra-branch add-on fee
- **Online payment integration** (PayHere, iPay) for subscription billing — manual collection initially
- **Customer self-signup portal** — onboarding is manual for now
- **Mobile app** — web app is mobile-responsive but no native app

---

## 10. Success Criteria

- A new customer can be fully onboarded within 1 business day
- Feature gating enforces tier limits without breaking the app for any tier
- Pricing is competitive with local alternatives while reflecting the system's full feature value
