# Subscription & Feature Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a subscription/tier system that gates features by package (Starter / Professional / Business), enforces limits, and lets the vendor manage subscriptions per tenant via Supabase dashboard.

**Architecture:** A `subscription` table per tenant holds the active tier and expiry. A `SubscriptionContext` reads it on app load and exposes `hasFeature()`. Feature-locked pages render an `UpgradePrompt` via a `FeatureGate` wrapper. A `SuspensionGate` overlays the entire app when the subscription is inactive. A `super_admin` role is added to `user_profiles` for vendor-only access.

**Tech Stack:** React 18 + TypeScript, Supabase, Vitest (unit tests for `features.ts`), Tailwind CSS, lucide-react

---

## File Map

**Create:**
- `supabase/migrations/20260601000001_add_subscription.sql` — subscription table + RLS + seed row
- `src/lib/features.ts` — `Tier` type, `FeatureName` type, `TIER_FEATURES` map, `hasFeature()`, `TIER_REQUIRED_FOR`, `REPORT_HISTORY_DAYS`, `MAX_VARIANTS`
- `src/lib/features.test.ts` — Vitest unit tests for `features.ts`
- `src/contexts/SubscriptionContext.tsx` — loads subscription row, exposes `tier`, `active`, `hasFeature()`, `reportHistoryDays`, `maxVariants`
- `src/components/ui/UpgradePrompt.tsx` — lock icon + tier name + contact message
- `src/components/ui/FeatureGate.tsx` — wraps children, renders `UpgradePrompt` if feature locked
- `src/components/ui/SuspensionGate.tsx` — full-screen overlay when `subscription.active = false`

**Modify:**
- `vite.config.ts` — add Vitest `test` config block
- `src/lib/database.types.ts` — add `subscription` table types; add `'super_admin'` to `user_profiles` role union
- `src/contexts/AuthContext.tsx` — add `isSuperAdmin` flag; exclude `super_admin` from `isAdmin`
- `src/components/ui/index.ts` — export `UpgradePrompt`, `FeatureGate`, `SuspensionGate`
- `src/App.tsx` — wrap with `SubscriptionProvider`; add `SuspensionGate`; wrap locked views with `FeatureGate`
- `src/components/Layout.tsx` — add `requiredFeature` to `NavItem`; show lock icon on gated items
- `src/components/POS.tsx` — wrap `<LoyaltyPanel>` in `FeatureGate`
- `src/components/products/ProductImporter.tsx` — gate with `FeatureGate` at render site; check `maxVariants` before import
- `src/components/SalesStaff.tsx` — gated at page level in App.tsx; gate referral-agent sub-tab with `FeatureGate` inside
- `src/components/Reports.tsx` — clamp date range start based on `reportHistoryDays`; show tier banner

---

## Task 1: Vitest setup

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json` (scripts only)

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add test config to `vite.config.ts`**

Replace the entire file contents with:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In the `"scripts"` block, add after the `"lint"` line:

```json
"test": "vitest run",
```

- [ ] **Step 4: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected output: `No test files found` (or similar — no error exit code).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore: add Vitest for unit testing"
```

---

## Task 2: Subscription table migration

**Files:**
- Create: `supabase/migrations/20260601000001_add_subscription.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260601000001_add_subscription.sql

create table if not exists subscription (
  id           uuid primary key default gen_random_uuid(),
  shop_name    text not null default '',
  tier         text not null default 'business'
                 check (tier in ('starter', 'professional', 'business')),
  billing_type text not null default 'lifetime'
                 check (billing_type in ('monthly', 'annual', 'lifetime')),
  started_at   timestamptz not null default now(),
  expires_at   timestamptz,
  active       boolean not null default true,
  notes        text,
  updated_at   timestamptz not null default now()
);

-- Only authenticated users can read; vendor manages via Supabase dashboard
alter table subscription enable row level security;

create policy "authenticated users can read subscription"
  on subscription for select
  to authenticated
  using (true);

-- Seed: existing tenants get business/lifetime so nothing breaks before the row is set properly
insert into subscription (shop_name, tier, billing_type, active, notes)
values ('', 'business', 'lifetime', true, 'Initial seed — update with actual plan details')
on conflict do nothing;
```

- [ ] **Step 2: Apply the migration to the tenant's Supabase project**

In Supabase dashboard → SQL Editor, paste and run the file contents.

Verify: Table `subscription` appears in Table Editor with one seed row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260601000001_add_subscription.sql
git commit -m "feat: add subscription table migration"
```

---

## Task 3: Feature constants and types

**Files:**
- Create: `src/lib/features.ts`
- Create: `src/lib/features.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/features.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hasFeature, TIER_REQUIRED_FOR, REPORT_HISTORY_DAYS, MAX_VARIANTS } from './features';

describe('hasFeature', () => {
  it('starter includes pos', () => {
    expect(hasFeature('starter', 'pos')).toBe(true);
  });
  it('starter excludes vouchers', () => {
    expect(hasFeature('starter', 'vouchers')).toBe(false);
  });
  it('starter excludes suppliers', () => {
    expect(hasFeature('starter', 'suppliers')).toBe(false);
  });
  it('professional includes vouchers', () => {
    expect(hasFeature('professional', 'vouchers')).toBe(true);
  });
  it('professional includes suppliers', () => {
    expect(hasFeature('professional', 'suppliers')).toBe(true);
  });
  it('professional excludes referral_agents', () => {
    expect(hasFeature('professional', 'referral_agents')).toBe(false);
  });
  it('business includes all features', () => {
    expect(hasFeature('business', 'referral_agents')).toBe(true);
    expect(hasFeature('business', 'custom_branding')).toBe(true);
    expect(hasFeature('business', 'pos')).toBe(true);
  });
});

describe('TIER_REQUIRED_FOR', () => {
  it('pos requires starter', () => {
    expect(TIER_REQUIRED_FOR['pos']).toBe('starter');
  });
  it('vouchers requires professional', () => {
    expect(TIER_REQUIRED_FOR['vouchers']).toBe('professional');
  });
  it('referral_agents requires business', () => {
    expect(TIER_REQUIRED_FOR['referral_agents']).toBe('business');
  });
});

describe('REPORT_HISTORY_DAYS', () => {
  it('starter is 30 days', () => {
    expect(REPORT_HISTORY_DAYS['starter']).toBe(30);
  });
  it('professional is 365 days', () => {
    expect(REPORT_HISTORY_DAYS['professional']).toBe(365);
  });
  it('business is null (unlimited)', () => {
    expect(REPORT_HISTORY_DAYS['business']).toBeNull();
  });
});

describe('MAX_VARIANTS', () => {
  it('starter is 500', () => {
    expect(MAX_VARIANTS['starter']).toBe(500);
  });
  it('professional is null (unlimited)', () => {
    expect(MAX_VARIANTS['professional']).toBeNull();
  });
  it('business is null (unlimited)', () => {
    expect(MAX_VARIANTS['business']).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: `Cannot find module './features'` or similar.

- [ ] **Step 3: Create `src/lib/features.ts`**

```typescript
export type Tier = 'starter' | 'professional' | 'business';

export type FeatureName =
  | 'pos' | 'products' | 'customers' | 'returns' | 'barcode' | 'invoice'
  | 'reports' | 'sales_history'
  | 'suppliers' | 'purchase_orders' | 'inventory' | 'loyalty' | 'vouchers'
  | 'commissions' | 'cost_encoding' | 'bulk_import' | 'products_unlimited'
  | 'referral_agents' | 'custom_branding' | 'reports_unlimited';

const STARTER_FEATURES: FeatureName[] = [
  'pos', 'products', 'customers', 'returns', 'barcode', 'invoice',
  'reports', 'sales_history',
];

const PROFESSIONAL_FEATURES: FeatureName[] = [
  ...STARTER_FEATURES,
  'suppliers', 'purchase_orders', 'inventory', 'loyalty', 'vouchers',
  'commissions', 'cost_encoding', 'bulk_import', 'products_unlimited',
];

const BUSINESS_FEATURES: FeatureName[] = [
  ...PROFESSIONAL_FEATURES,
  'referral_agents', 'custom_branding', 'reports_unlimited',
];

export const TIER_FEATURES: Record<Tier, FeatureName[]> = {
  starter: STARTER_FEATURES,
  professional: PROFESSIONAL_FEATURES,
  business: BUSINESS_FEATURES,
};

export function hasFeature(tier: Tier, feature: FeatureName): boolean {
  return TIER_FEATURES[tier].includes(feature);
}

// For each feature, the minimum tier required to access it
export const TIER_REQUIRED_FOR = (() => {
  const map = {} as Record<FeatureName, Tier>;
  for (const tier of ['starter', 'professional', 'business'] as Tier[]) {
    for (const feature of TIER_FEATURES[tier]) {
      if (!map[feature]) map[feature] = tier;
    }
  }
  return map;
})();

export const REPORT_HISTORY_DAYS: Record<Tier, number | null> = {
  starter: 30,
  professional: 365,
  business: null,
};

export const MAX_VARIANTS: Record<Tier, number | null> = {
  starter: 500,
  professional: null,
  business: null,
};

export const TIER_LABELS: Record<Tier, string> = {
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
};
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: All 12 tests pass, 0 failing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features.ts src/lib/features.test.ts
git commit -m "feat: add subscription tier features constants and types"
```

---

## Task 4: SubscriptionContext

**Files:**
- Create: `src/contexts/SubscriptionContext.tsx`

- [ ] **Step 1: Create the context**

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  hasFeature as checkFeature,
  FeatureName,
  Tier,
  REPORT_HISTORY_DAYS,
  MAX_VARIANTS,
} from '../lib/features';

interface SubscriptionContextType {
  tier: Tier;
  active: boolean;
  loading: boolean;
  hasFeature: (feature: FeatureName) => boolean;
  reportHistoryDays: number | null;
  maxVariants: number | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<Tier>('business');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('subscription')
      .select('tier, active, expires_at')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const expired = data.expires_at
            ? new Date(data.expires_at) < new Date()
            : false;
          setTier(data.tier as Tier);
          setActive(data.active && !expired);
        }
        // No row → keep defaults (business/active) so existing tenants aren't locked out
        setLoading(false);
      });
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        active,
        loading,
        hasFeature: (feature) => checkFeature(tier, feature),
        reportHistoryDays: REPORT_HISTORY_DAYS[tier],
        maxVariants: MAX_VARIANTS[tier],
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: No errors in `SubscriptionContext.tsx`. (There may be a TS error about `subscription` not in `Database` types — that will be fixed in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add src/contexts/SubscriptionContext.tsx
git commit -m "feat: add SubscriptionContext to load tier from Supabase"
```

---

## Task 5: UI components — UpgradePrompt, FeatureGate, SuspensionGate

**Files:**
- Create: `src/components/ui/UpgradePrompt.tsx`
- Create: `src/components/ui/FeatureGate.tsx`
- Create: `src/components/ui/SuspensionGate.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create `UpgradePrompt.tsx`**

```typescript
import { Lock } from 'lucide-react';
import { Tier, TIER_LABELS } from '../../lib/features';

interface UpgradePromptProps {
  requiredTier: Tier;
  featureLabel: string;
}

export function UpgradePrompt({ requiredTier, featureLabel }: UpgradePromptProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 280,
      textAlign: 'center',
      gap: 16,
      padding: '40px 32px',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-alt)',
      }}>
        <Lock size={26} style={{ color: 'var(--muted)' }} />
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>
          {featureLabel}
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
          Available on the <strong>{TIER_LABELS[requiredTier]}</strong> plan and above.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Contact us on WhatsApp to upgrade your plan.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `FeatureGate.tsx`**

```typescript
import { FeatureName, TIER_REQUIRED_FOR } from '../../lib/features';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { UpgradePrompt } from './UpgradePrompt';

interface FeatureGateProps {
  feature: FeatureName;
  featureLabel: string;
  children: React.ReactNode;
}

export function FeatureGate({ feature, featureLabel, children }: FeatureGateProps) {
  const { hasFeature } = useSubscription();
  if (hasFeature(feature)) return <>{children}</>;
  return <UpgradePrompt requiredTier={TIER_REQUIRED_FOR[feature]} featureLabel={featureLabel} />;
}
```

- [ ] **Step 3: Create `SuspensionGate.tsx`**

```typescript
import { AlertCircle } from 'lucide-react';

interface SuspensionGateProps {
  children: React.ReactNode;
  active: boolean;
}

export function SuspensionGate({ children, active }: SuspensionGateProps) {
  if (active) return <>{children}</>;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      background: 'var(--background)',
    }}>
      <AlertCircle size={48} color="var(--danger, #ef4444)" />
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Account Suspended
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Your subscription is inactive.
        </p>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
          Please contact us on WhatsApp to reactivate your account.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Export from `src/components/ui/index.ts`**

Append these three lines to the existing file:

```typescript
export * from './UpgradePrompt';
export * from './FeatureGate';
export * from './SuspensionGate';
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: No errors in any of the three new files.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/UpgradePrompt.tsx src/components/ui/FeatureGate.tsx \
        src/components/ui/SuspensionGate.tsx src/components/ui/index.ts
git commit -m "feat: add UpgradePrompt, FeatureGate, SuspensionGate UI components"
```

---

## Task 6: database.types.ts and AuthContext — add subscription type + super_admin role

**Files:**
- Modify: `src/lib/database.types.ts`
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Add `subscription` table to `database.types.ts`**

In `src/lib/database.types.ts`, inside the `Tables` object (after the last table entry, before the closing `}`), add:

```typescript
      subscription: {
        Row: {
          id: string
          shop_name: string
          tier: 'starter' | 'professional' | 'business'
          billing_type: 'monthly' | 'annual' | 'lifetime'
          started_at: string
          expires_at: string | null
          active: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          shop_name?: string
          tier?: 'starter' | 'professional' | 'business'
          billing_type?: 'monthly' | 'annual' | 'lifetime'
          started_at?: string
          expires_at?: string | null
          active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          shop_name?: string
          tier?: 'starter' | 'professional' | 'business'
          billing_type?: 'monthly' | 'annual' | 'lifetime'
          expires_at?: string | null
          active?: boolean
          notes?: string | null
          updated_at?: string
        }
      }
```

- [ ] **Step 2: Add `super_admin` to the `user_profiles` role union in `database.types.ts`**

Find the `user_profiles` `Row` type. The current `role` field is:

```typescript
role: 'admin' | 'cashier' | 'stock_manager' | 'staff'
```

Change it to:

```typescript
role: 'admin' | 'cashier' | 'stock_manager' | 'staff' | 'super_admin'
```

Do the same for the `Insert` and `Update` type blocks in `user_profiles`.

- [ ] **Step 3: Add `isSuperAdmin` to `AuthContext.tsx`**

In `AuthContext.tsx`, find the `AuthContextType` interface and add:

```typescript
isSuperAdmin: boolean;
```

In the `value` object at the bottom of `AuthProvider`, add:

```typescript
isSuperAdmin: profile?.role === 'super_admin',
```

Also update the existing `isAdmin` line so `super_admin` is excluded from shop admin powers:

```typescript
isAdmin: profile?.role === 'admin',
```

(This is unchanged — just confirm `'super_admin'` is NOT included here.)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts src/contexts/AuthContext.tsx
git commit -m "feat: add subscription table types and super_admin role"
```

---

## Task 7: Wire SubscriptionProvider and SuspensionGate into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import new providers and components**

At the top of `src/App.tsx`, add these imports after the existing context imports:

```typescript
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { FeatureGate, SuspensionGate } from './components/ui';
```

- [ ] **Step 2: Wrap AppContent with SuspensionGate**

Inside `AppContent`, add a call to `useSubscription` directly after the existing `useAuth` call:

```typescript
const { active } = useSubscription();
```

Then wrap the entire returned JSX (the `<Layout>` element and its contents) with `<SuspensionGate active={active}>`:

```typescript
  return (
    <SuspensionGate active={active}>
      <Layout currentView={currentView} onNavigate={(view) => handleNavigate(view)}>
        {/* ... all existing view renders unchanged ... */}
      </Layout>
    </SuspensionGate>
  );
```

- [ ] **Step 3: Gate page-level features with FeatureGate**

Inside `AppContent`'s return, replace these view renders with gated versions:

```typescript
      {currentView === 'suppliers' && (
        <FeatureGate feature="suppliers" featureLabel="Supplier Management">
          <Suppliers />
        </FeatureGate>
      )}

      {currentView === 'gift-vouchers' && (
        <FeatureGate feature="vouchers" featureLabel="Gift Vouchers">
          <GiftVouchers />
        </FeatureGate>
      )}

      {currentView === 'referral-agents' && (
        <FeatureGate feature="commissions" featureLabel="Sales Staff & Commissions">
          <SalesStaff />
        </FeatureGate>
      )}
```

Leave all other view renders (`dashboard`, `pos`, `products`, `customers`, `returns`, `sales-history`, `reports`, `settings`) unchanged — these are available on all tiers.

- [ ] **Step 4: Wrap App() with SubscriptionProvider**

In the `App()` function, wrap the existing providers with `SubscriptionProvider`:

```typescript
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CostCodeProvider>
          <SubscriptionProvider>
            <AppContent />
            <ToastContainer />
          </SubscriptionProvider>
        </CostCodeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`. Log in. Confirm the app loads normally and all views still work.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire SubscriptionProvider and SuspensionGate into App"
```

---

## Task 8: Layout — lock icons on gated nav items

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Import Lock icon and useSubscription**

At the top of `src/components/Layout.tsx`, add to the existing lucide-react import:

```typescript
  Lock,
```

And add this import after the existing context imports:

```typescript
import { useSubscription } from '../contexts/SubscriptionContext';
import type { FeatureName } from '../lib/features';
```

- [ ] **Step 2: Add `requiredFeature` to the `NavItem` type**

Find the `NavItem` type:

```typescript
type NavItem = { id: string; label: string; Icon: React.ElementType; roles: string[]; desktopOnly?: boolean };
```

Replace with:

```typescript
type NavItem = {
  id: string;
  label: string;
  Icon: React.ElementType;
  roles: string[];
  desktopOnly?: boolean;
  requiredFeature?: FeatureName;
};
```

- [ ] **Step 3: Add `requiredFeature` to gated nav items in `NAV_GROUPS`**

Find and update these three items:

```typescript
      { id: 'gift-vouchers', label: 'Gift Vouchers', Icon: Gift, roles: ['admin', 'cashier'], requiredFeature: 'vouchers' as FeatureName },
```

```typescript
      { id: 'suppliers', label: 'Suppliers', Icon: Truck, roles: ['admin', 'stock_manager'], requiredFeature: 'suppliers' as FeatureName },
      { id: 'referral-agents', label: 'Sales Staff', Icon: UserCheck, roles: ['admin'], requiredFeature: 'commissions' as FeatureName },
```

- [ ] **Step 4: Read `hasFeature` inside the `Layout` component**

Inside `export function Layout(...)`, add after the existing `useAuth` call:

```typescript
  const { hasFeature } = useSubscription();
```

- [ ] **Step 5: Render lock icon next to locked nav item labels**

Find the part of the JSX that renders each nav item label. It should look roughly like:

```tsx
<span>{item.label}</span>
```

Replace with:

```tsx
<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
  {item.label}
  {item.requiredFeature && !hasFeature(item.requiredFeature) && (
    <Lock size={12} style={{ color: 'var(--muted)', opacity: 0.7, flexShrink: 0 }} />
  )}
</span>
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Manual check**

Run `npm run dev`. If the seed subscription row is `tier = 'starter'`, the Suppliers, Gift Vouchers, and Sales Staff items should show a small lock icon. With `tier = 'business'` (the default seed), no locks appear.

To test locking: temporarily change the `tier` in the seeded `subscription` row to `'starter'` in Supabase dashboard, reload the app, and confirm lock icons appear.

- [ ] **Step 8: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: show lock icon on gated nav items based on subscription tier"
```

---

## Task 9: Gate in-page features — Loyalty in POS, Bulk Import in Products, Commissions sub-tab

**Files:**
- Modify: `src/components/POS.tsx`
- Modify: `src/components/products/ProductImporter.tsx`
- Modify: `src/components/SalesStaff.tsx`

### Part A — Loyalty Panel in POS

- [ ] **Step 1: Import FeatureGate and useSubscription in POS.tsx**

At the top of `src/components/POS.tsx`, add:

```typescript
import { FeatureGate } from './ui';
```

- [ ] **Step 2: Wrap LoyaltyPanel in FeatureGate**

Find the `<LoyaltyPanel` render in `POS.tsx` (around line 1037). It will be inside some conditional JSX. Wrap it:

```typescript
<FeatureGate feature="loyalty" featureLabel="Loyalty Points">
  <LoyaltyPanel
    {/* keep all existing props unchanged */}
  />
</FeatureGate>
```

### Part B — Bulk Import in Products

- [ ] **Step 3: Import FeatureGate in ProductImporter.tsx**

At the top of `src/components/products/ProductImporter.tsx`, add:

```typescript
import { FeatureGate } from '../ui';
```

- [ ] **Step 4: Wrap the importer content in FeatureGate**

In `ProductImporter.tsx`, wrap the outermost returned JSX inside a `FeatureGate`:

```typescript
export function ProductImporter(/* existing props */) {
  return (
    <FeatureGate feature="bulk_import" featureLabel="Bulk Product Import">
      {/* existing JSX unchanged */}
    </FeatureGate>
  );
}
```

### Part C — Referral Agents sub-tab in SalesStaff

- [ ] **Step 5: Import FeatureGate in SalesStaff.tsx**

At the top of `src/components/SalesStaff.tsx`, add:

```typescript
import { FeatureGate } from './ui';
```

- [ ] **Step 6: Find the referral agents section in SalesStaff.tsx**

Search for `ReferralAgents` or any tab/section that renders referral agent content. Wrap it:

```typescript
<FeatureGate feature="referral_agents" featureLabel="Referral Agents">
  {/* existing referral agents JSX */}
</FeatureGate>
```

- [ ] **Step 7: Typecheck all three files**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/POS.tsx src/components/products/ProductImporter.tsx src/components/SalesStaff.tsx
git commit -m "feat: gate loyalty, bulk import, and referral agents by subscription tier"
```

---

## Task 10: Reports — history date limit based on tier

**Files:**
- Modify: `src/components/Reports.tsx`

- [ ] **Step 1: Import useSubscription in Reports.tsx**

At the top of `src/components/Reports.tsx`, add:

```typescript
import { useSubscription } from '../contexts/SubscriptionContext';
```

- [ ] **Step 2: Read reportHistoryDays inside the Reports component**

Near the top of the `Reports` function body, add:

```typescript
const { reportHistoryDays } = useSubscription();
```

- [ ] **Step 3: Compute the minimum allowed start date**

Add this constant below the `reportHistoryDays` line:

```typescript
const minStart = reportHistoryDays
  ? new Date(Date.now() - reportHistoryDays * 86400000).toISOString().split('T')[0]
  : null;
```

- [ ] **Step 4: Clamp the start date in getRange calls**

The `Reports` component calls `getRange(rangeId, customStart, customEnd)` to compute `{ start, end, ... }`. After that call, apply the clamp:

```typescript
const range = getRange(rangeId, customStart, customEnd);
const clampedStart = minStart && range.start < minStart ? minStart : range.start;
const effectiveRange = { ...range, start: clampedStart };
```

Replace all uses of `range.start` with `effectiveRange.start` in the Supabase queries (the `.gte('created_at', ...)` calls).

- [ ] **Step 5: Show a tier banner when history is clamped**

Find the top of the Reports page JSX (just inside the outermost container div). Add a banner that appears only when `reportHistoryDays` is not null:

```typescript
{reportHistoryDays !== null && (
  <div style={{
    background: 'var(--surface-alt)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 16px',
    marginBottom: 16,
    fontSize: 13,
    color: 'var(--muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }}>
    <Lock size={14} />
    {reportHistoryDays === 30
      ? 'Your plan shows the last 30 days only.'
      : `Your plan shows up to ${reportHistoryDays} days of history.`}
    {' '}Upgrade your plan for full history.
  </div>
)}
```

Also add `Lock` to the lucide-react import at the top of `Reports.tsx`.

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Reports.tsx
git commit -m "feat: clamp reports date range by subscription tier history limit"
```

---

## Task 11: Product variant count limit (Starter: 500)

**Files:**
- Modify: `src/components/products/VariantForm.tsx`

- [ ] **Step 1: Import useSubscription in VariantForm.tsx**

At the top of `src/components/products/VariantForm.tsx`, add:

```typescript
import { useSubscription } from '../../contexts/SubscriptionContext';
```

- [ ] **Step 2: Read maxVariants inside the component**

Near the top of the `VariantForm` function body, add:

```typescript
const { maxVariants } = useSubscription();
```

- [ ] **Step 3: Check variant count before saving**

Find the form submit / save handler in `VariantForm.tsx`. Before the existing save logic, add a count check:

```typescript
if (maxVariants !== null) {
  const { count, error: countError } = await supabase
    .from('product_variants')
    .select('id', { count: 'exact', head: true });

  if (!countError && count !== null && count >= maxVariants) {
    throw new Error(
      `Your plan allows up to ${maxVariants} product variants. ` +
      `You have reached the limit. Upgrade to Professional for unlimited variants.`
    );
  }
}
```

Place this check only when creating a new variant (skip on edit). The thrown error message will be caught by the existing error handling in the form and shown to the user.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/VariantForm.tsx
git commit -m "feat: enforce variant count limit for Starter tier"
```

---

## Self-Review Checklist

- [x] **Subscription table** → Task 2
- [x] **Feature constants + types** → Task 3
- [x] **SubscriptionContext** → Task 4
- [x] **UpgradePrompt + FeatureGate + SuspensionGate** → Task 5
- [x] **database.types.ts** → Task 6
- [x] **super_admin role in AuthContext** → Task 6
- [x] **App.tsx wiring + page-level gates (suppliers, vouchers, sales staff)** → Task 7
- [x] **Layout lock icons** → Task 8
- [x] **Loyalty panel gate** → Task 9A
- [x] **Bulk import gate** → Task 9B
- [x] **Referral agents sub-gate** → Task 9C
- [x] **Reports history limit** → Task 10
- [x] **Variant count limit** → Task 11
- [x] **No TBDs or placeholders** — all steps have complete code
- [x] **Type consistency** — `FeatureName`, `Tier`, `hasFeature` used consistently across all tasks
