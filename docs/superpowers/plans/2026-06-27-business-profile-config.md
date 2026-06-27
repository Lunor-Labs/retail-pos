# Central Business Profile + Redesigned WhatsApp Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a central, admin-editable business profile (name, tagline, phone, address) read by both the printed receipt and the WhatsApp invoice share, and redesign the WhatsApp message to the approved "Clean" layout — fixing the hardcoded "Gasith Motors" bug.

**Architecture:** Store the profile as a JSON row in `app_settings` (`business_profile`). A `BusinessProfileProvider` context (modeled on `CostCodeContext`) loads it once at app start, seeded with each app's correct default name. A new admin-only Settings section edits it. The WhatsApp share and receipt builder take the profile as a parameter.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase JS, lucide-react, existing `ToastContext` / `app_settings` patterns.

## Global Constraints

- **No test framework exists** in these apps. Verification gates per task: `npm run typecheck` (no *new* errors in changed files), `npm run lint` (no new errors beyond the pervasive, pre-existing `@typescript-eslint/no-explicit-any` from the `(supabase … as any)` pattern), `npm run build` (succeeds), plus the manual checks in each task.
- **`app_settings` write pattern (verbatim):** `(supabase.from('app_settings') as any).upsert({ key, value }, { onConflict: 'key' })`.
- **Profile key (verbatim):** `business_profile`; value = `JSON.stringify({ name, tagline, phone, address })`.
- **Per-app default business name:** retail-pos `RIVONLAK`, silora-fashion-pos `Silora Fashion`, sktex-pos `SK TEX`. Default tagline `Fashion Retail`; default phone/address empty.
- **`BusinessProfile` type (verbatim):** `{ name: string; tagline: string; phone: string; address: string }`.
- **WhatsApp message:** "Clean" layout (Task 3), batch number dropped, amounts formatted with `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- **Do NOT copy `invoiceActions.ts` / `receiptHTML.ts` between apps** — their logo asset import path differs per app (`revonlak.jpeg` / `silora-logo.jpeg` / `sktex-logo.jpeg`). Apply edits in place.
- **Leave `db.ts` `GasithMotorsDB` class name unchanged** (internal IndexedDB; renaming orphans local data).
- **Three repos**, each its own git repo on branch `main`. Work on a feature branch per repo. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

---

### Task 1: BusinessProfileContext + provider wiring (retail-pos)

Creates the central profile context and makes it available app-wide. Deliverable: any component can call `useBusinessProfile()` and get a complete profile (default until a row exists).

**Files:**
- Create: `retail-pos/src/contexts/BusinessProfileContext.tsx`
- Modify: `retail-pos/src/App.tsx` (import near line 18; provider nesting near lines 131-134)

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`.
- Produces:
  - `export interface BusinessProfile { name: string; tagline: string; phone: string; address: string }`
  - `export function BusinessProfileProvider({ children }: { children: React.ReactNode }): JSX.Element`
  - `export const useBusinessProfile: () => { profile: BusinessProfile; setProfile: (p: BusinessProfile) => void }`

- [ ] **Step 1: Create the context file**

Create `retail-pos/src/contexts/BusinessProfileContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface BusinessProfile {
  name: string;
  tagline: string;
  phone: string;
  address: string;
}

// Per-app default — change `name` per app when replicating (see Task 4).
const DEFAULT_BUSINESS: BusinessProfile = {
  name: 'RIVONLAK',
  tagline: 'Fashion Retail',
  phone: '',
  address: '',
};

interface BusinessProfileContextType {
  profile: BusinessProfile;
  setProfile: (p: BusinessProfile) => void;
}

const BusinessProfileContext = createContext<BusinessProfileContextType>({
  profile: DEFAULT_BUSINESS,
  setProfile: () => {},
});

export function BusinessProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase.from('app_settings') as any)
          .select('value').eq('key', 'business_profile').maybeSingle();
        if (data?.value) {
          const stored = JSON.parse(data.value);
          setProfile({
            name: stored.name || DEFAULT_BUSINESS.name,        // blank name falls back
            tagline: stored.tagline ?? DEFAULT_BUSINESS.tagline, // present-but-empty stays empty
            phone: stored.phone ?? DEFAULT_BUSINESS.phone,
            address: stored.address ?? DEFAULT_BUSINESS.address,
          });
        }
      } catch {
        // keep default — business identity is never blank
      }
    })();
  }, []);

  return (
    <BusinessProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </BusinessProfileContext.Provider>
  );
}

export const useBusinessProfile = () => useContext(BusinessProfileContext);
```

- [ ] **Step 2: Import the provider in App.tsx**

In `retail-pos/src/App.tsx`, add after the `CostCodeProvider` import (line 18):

```tsx
import { BusinessProfileProvider } from './contexts/BusinessProfileContext';
```

- [ ] **Step 3: Nest the provider**

In `App.tsx`, replace this block (around lines 131-134):

```tsx
        <CostCodeProvider>
          <AppContent />
          <ToastContainer />
        </CostCodeProvider>
```

with:

```tsx
        <CostCodeProvider>
          <BusinessProfileProvider>
            <AppContent />
            <ToastContainer />
          </BusinessProfileProvider>
        </CostCodeProvider>
```

- [ ] **Step 4: Verify typecheck and build**

Run: `cd retail-pos && npm run typecheck 2>&1 | grep -E "BusinessProfileContext|App.tsx" || echo "no new errors"; npm run build 2>&1 | tail -3`
Expected: "no new errors" and `✓ built`.

- [ ] **Step 5: Commit**

```bash
cd retail-pos && git add src/contexts/BusinessProfileContext.tsx src/App.tsx && git commit -m "feat: add BusinessProfile context seeded with per-app default

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Admin Business settings section (retail-pos)

Adds an admin-only "Business" section to Settings that edits the profile and updates the context live. Deliverable: admin can edit/save name, tagline, phone, address.

**Files:**
- Modify: `retail-pos/src/components/Settings.tsx` (lucide import line 5; `SectionId` line 36; new section component above line 1122; `NAV` array line 1130-1137; render block line 1175-1180)

**Interfaces:**
- Consumes: `useBusinessProfile()` (Task 1); existing `useToast`, `inputStyle` (line 69), `labelStyle` (line 74), `supabase`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the `Store` icon to the lucide import**

In `Settings.tsx` line 5, add `Store`:

```tsx
import { KeyRound, Users, Star, ShieldCheck, Eye, EyeOff, X, ChevronDown, Check, Tag, Pencil, Hash, Gift, Store } from 'lucide-react';
```

- [ ] **Step 2: Extend the `SectionId` union**

Change line 36 to:

```tsx
type SectionId = 'account' | 'staff-access' | 'loyalty' | 'catalog' | 'cost-code' | 'vouchers' | 'business';
```

- [ ] **Step 3: Add the `useBusinessProfile` import**

Near the other imports at the top of `Settings.tsx`, add:

```tsx
import { useBusinessProfile } from '../contexts/BusinessProfileContext';
```

- [ ] **Step 4: Add the `BusinessProfileSection` component**

Insert just above the `export function Settings()` line (~line 1122):

```tsx
// ─── Section: Business ────────────────────────────────────────────────────
function BusinessProfileSection() {
  const { showToast } = useToast();
  const { profile, setProfile } = useBusinessProfile();
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState(profile.tagline);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.name); setTagline(profile.tagline);
    setPhone(profile.phone); setAddress(profile.address);
  }, [profile]);

  async function handleSave() {
    if (!name.trim()) { showToast('Business name is required', 'error'); return; }
    setSaving(true);
    const next = { name: name.trim(), tagline: tagline.trim(), phone: phone.trim(), address: address.trim() };
    try {
      const { error } = await (supabase.from('app_settings') as any).upsert(
        { key: 'business_profile', value: JSON.stringify(next) },
        { onConflict: 'key' }
      );
      if (error) throw error;
      setProfile(next);
      showToast('Business profile saved', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
            <Store size={15} style={{ color: 'var(--ink-2)' }} strokeWidth={1.7} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Business Profile</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
              Shown on printed receipts and the WhatsApp invoice message
            </div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Business Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RIVONLAK" />
        </div>
        <div>
          <label style={labelStyle}>Tagline</label>
          <input style={inputStyle} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Fashion Retail" />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +94 77 660 0285" />
        </div>
        <div>
          <label style={labelStyle}>Address</label>
          <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. No. 12, Main Street, Kandy" />
        </div>

        <div>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ height: 38, fontSize: 13 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the NAV entry**

In the `NAV` array, after the `vouchers` entry (line 1136), add:

```tsx
    { id: 'business', label: 'Business', icon: <Store size={15} strokeWidth={1.7} />, adminOnly: true },
```

- [ ] **Step 6: Add the render line**

After the `vouchers` render line (1180), add:

```tsx
          {section === 'business' && isAdmin && <BusinessProfileSection />}
```

- [ ] **Step 7: Verify typecheck, build**

Run: `cd retail-pos && npm run typecheck 2>&1 | grep "Settings.tsx" || echo "no new Settings errors"; npm run build 2>&1 | tail -3`
Expected: "no new Settings errors" and `✓ built`.

- [ ] **Step 8: Manual check**

`cd retail-pos && npm run dev`, log in as **admin** → Settings → **Business** tab appears, prefilled `RIVONLAK` / `Fashion Retail` → edit phone + address → **Save** → toast; reload → persists. Non-admin → Business tab absent.

- [ ] **Step 9: Commit**

```bash
cd retail-pos && git add src/components/Settings.tsx && git commit -m "feat: add admin Business profile settings section

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire consumers — WhatsApp redesign + receipt (retail-pos)

Replaces the hardcoded business identity in the WhatsApp share and receipt with the profile, and rewrites the WhatsApp body to the Clean layout.

**Files:**
- Modify: `retail-pos/src/components/invoice/invoiceActions.ts` (import line 3; `shareOnWhatsApp` lines 9-80; `openPrintPopup` signature lines 95-104)
- Modify: `retail-pos/src/components/invoice/receiptHTML.ts` (import ~line 3; signature lines 12-17; header lines 104-106; footer line 148)
- Modify: `retail-pos/src/components/invoice/index.tsx` (lines 1-27)

**Interfaces:**
- Consumes: `BusinessProfile`, `useBusinessProfile` (Task 1).
- Produces:
  - `shareOnWhatsApp(invoiceData: InvoiceData, showDiscount: boolean, business: BusinessProfile): void`
  - `buildReceiptHTML(invoiceData: InvoiceData, showDiscount: boolean, logoSrc: string, qrSrc: string, business: BusinessProfile): string`
  - `openPrintPopup(invoiceData, showDiscount, buildHTML: (data, discount, logo, qr, business) => string, business: BusinessProfile): void`

- [ ] **Step 1: Add the BusinessProfile import to invoiceActions.ts**

After the existing imports (line 3) in `retail-pos/src/components/invoice/invoiceActions.ts`:

```tsx
import { BusinessProfile } from '../../contexts/BusinessProfileContext';
```

- [ ] **Step 2: Replace `shareOnWhatsApp` (lines 9-80) with the Clean version**

```tsx
export function shareOnWhatsApp(invoiceData: InvoiceData, showDiscount: boolean, business: BusinessProfile): void {
    const money = (n: number) =>
        n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const displaySubtotal = !showDiscount
        ? invoiceData.subtotal - invoiceData.discount
        : invoiceData.subtotal;

    const lines: string[] = [];
    lines.push(`*${business.name}*`);
    if (business.tagline) lines.push(`_${business.tagline}_`);
    lines.push('');
    lines.push(`🧾 Invoice *${invoiceData.saleNumber}*`);
    lines.push(`📅 ${invoiceData.date}`);

    if (invoiceData.customerName) {
        lines.push('');
        lines.push(`👤 ${invoiceData.customerName}`);
        if (invoiceData.customerPhone) lines.push(`📱 ${invoiceData.customerPhone}`);
    }

    lines.push('');
    lines.push('*Items*');
    invoiceData.items.forEach((item, index) => {
        const unitPrice = !showDiscount && item.discountedUnitPrice !== undefined
            ? item.discountedUnitPrice : item.unitPrice;
        const subtotal = !showDiscount && item.discountedSubtotal !== undefined
            ? item.discountedSubtotal : item.subtotal;
        lines.push(`${index + 1}. ${item.name}${item.variantLabel ? ` — ${item.variantLabel}` : ''}`);
        lines.push(`   ${item.quantity} × ${money(unitPrice)} = *${money(subtotal)}*`);
    });

    lines.push('');
    const hasAdjustments =
        invoiceData.discount > 0 || invoiceData.tax > 0 || (invoiceData.serviceCharge ?? 0) > 0;
    if (hasAdjustments) {
        lines.push(`Subtotal   LKR ${money(displaySubtotal)}`);
        if (showDiscount && invoiceData.discount > 0)
            lines.push(`Discount   −LKR ${money(invoiceData.discount)}`);
        if (invoiceData.tax > 0)
            lines.push(`Tax   LKR ${money(invoiceData.tax)}`);
        if ((invoiceData.serviceCharge ?? 0) > 0)
            lines.push(`Service Charge   LKR ${money(invoiceData.serviceCharge as number)}`);
    }
    lines.push(`*Total   LKR ${money(invoiceData.total)}*`);

    lines.push('');
    const payLabel = invoiceData.paymentMethod.charAt(0).toUpperCase() + invoiceData.paymentMethod.slice(1);
    let payLine = `💳 ${payLabel}`;
    if (invoiceData.paymentMethod !== 'credit') {
        payLine += ` · Paid ${money(invoiceData.paidAmount)}`;
        if (invoiceData.changeAmount > 0) payLine += ` · Change ${money(invoiceData.changeAmount)}`;
    }
    lines.push(payLine);
    if (invoiceData.cashierName) lines.push(`🧑‍💼 Served by ${invoiceData.cashierName}`);

    lines.push('');
    lines.push('🙏 Thank you for shopping with us!');
    if (business.phone) lines.push(`📞 ${business.phone}`);
    if (business.address) lines.push(`📍 ${business.address}`);

    const message = lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}
```

- [ ] **Step 3: Update `openPrintPopup` signature to thread `business`**

Change the definition (lines 95-99) to:

```tsx
export function openPrintPopup(
    invoiceData: InvoiceData,
    showDiscount: boolean,
    buildHTML: (data: InvoiceData, discount: boolean, logo: string, qr: string, business: BusinessProfile) => string,
    business: BusinessProfile,
): void {
```

And the `buildHTML(...)` call (line 104) to:

```tsx
    const html = buildHTML(invoiceData, showDiscount, logoUrl, qrUrl, business);
```

- [ ] **Step 4: Update `buildReceiptHTML` to use `business`**

In `retail-pos/src/components/invoice/receiptHTML.ts`:

(a) After the existing imports (~line 3), add:

```tsx
import { BusinessProfile } from '../../contexts/BusinessProfileContext';
```

(b) Change the signature (lines 12-17) to:

```tsx
export function buildReceiptHTML(
    invoiceData: InvoiceData,
    showDiscount: boolean,
    logoSrc: string,
    qrSrc: string,
    business: BusinessProfile,
): string {
```

(c) Replace the header block (lines 104-106) with:

```html
    <img class="logo" src="${logoSrc}" alt="${business.name}" />
    <div class="store-name">${business.name}</div>
    <div class="store-sub">${business.tagline}</div>
```

(d) Replace the footer line (line 148) with:

```html
    <div class="google">Shop Again at ${business.name}</div>
```

- [ ] **Step 5: Wire the caller `invoice/index.tsx`**

Add to the imports (after line 7):

```tsx
import { useBusinessProfile } from '../../contexts/BusinessProfileContext';
```

Inside `Invoice`, change the handlers block to:

```tsx
    const [showDiscount, setShowDiscount] = useState(false);
    const { profile: business } = useBusinessProfile();

    const handlePrint = () =>
        openPrintPopup(invoiceData, showDiscount, buildReceiptHTML, business);

    const handleWhatsApp = () =>
        shareOnWhatsApp(invoiceData, showDiscount, business);
```

- [ ] **Step 6: Verify typecheck and build**

Run: `cd retail-pos && npm run typecheck 2>&1 | grep -E "invoiceActions|receiptHTML|invoice/index" || echo "no new invoice errors"; npm run build 2>&1 | tail -3`
Expected: "no new invoice errors" and `✓ built`.

- [ ] **Step 7: Manual check**

`cd retail-pos && npm run dev`, complete a sale → invoice → **WhatsApp**: draft leads with `RIVONLAK` (not Gasith Motors), no `----` dividers, condensed payment line, thousands-separated amounts, no batch numbers; footer phone/address only if set. **Print**: header unchanged. Edit name in Settings → Business → re-open invoice → both reflect new name without reload.

- [ ] **Step 8: Commit**

```bash
cd retail-pos && git add src/components/invoice/invoiceActions.ts src/components/invoice/receiptHTML.ts src/components/invoice/index.tsx && git commit -m "feat: read business profile in receipt + redesign WhatsApp invoice message

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Replicate to silora-fashion-pos and sktex-pos

Ports Tasks 1-3 to the other two apps. The only per-app difference is the default business name in the context; logo import paths stay as-is.

**Files (per app):**
- Create: `src/contexts/BusinessProfileContext.tsx`
- Modify: `src/App.tsx`, `src/components/Settings.tsx`, `src/components/invoice/invoiceActions.ts`, `src/components/invoice/receiptHTML.ts`, `src/components/invoice/index.tsx`

**Interfaces:** identical to Tasks 1-3.

- [ ] **Step 1: Copy the context into both apps, then fix the default name**

```bash
cp retail-pos/src/contexts/BusinessProfileContext.tsx silora-fashion-pos/src/contexts/BusinessProfileContext.tsx
cp retail-pos/src/contexts/BusinessProfileContext.tsx sktex-pos/src/contexts/BusinessProfileContext.tsx
```

Then edit `DEFAULT_BUSINESS.name`:
- `silora-fashion-pos/src/contexts/BusinessProfileContext.tsx` → `name: 'Silora Fashion',`
- `sktex-pos/src/contexts/BusinessProfileContext.tsx` → `name: 'SK TEX',`

- [ ] **Step 2: Apply Task 1 App.tsx wiring to both apps**

Add the `BusinessProfileProvider` import and nest it inside `CostCodeProvider` (Task 1 Steps 2-3) in both apps. Verify anchors first:

Run: `for d in silora-fashion-pos sktex-pos; do echo "== $d =="; grep -n "CostCodeProvider>\|<AppContent />\|<ToastContainer" $d/src/App.tsx; done`
Expected: the three lines present in both.

- [ ] **Step 3: Apply Task 2 Settings edits to both apps**

Apply Task 2 Steps 1-6 verbatim to each `src/components/Settings.tsx`. Verify anchors first:

Run: `for d in silora-fashion-pos sktex-pos; do echo "== $d =="; grep -n "type SectionId =\|from 'lucide-react'\|export function Settings()\|id: 'vouchers'\|section === 'vouchers'" $d/src/components/Settings.tsx; done`
Expected: each anchor present. If the `SectionId` union or NAV differs, add `| 'business'` / the entry to whatever exists.

- [ ] **Step 4: Apply Task 3 consumer edits to both apps**

Apply Task 3 Steps 1-5 verbatim to each app's `invoice/invoiceActions.ts`, `invoice/receiptHTML.ts`, `invoice/index.tsx`. **Do not copy the files** (logo import differs). Verify the receipt header anchor first:

Run: `for d in silora-fashion-pos sktex-pos; do echo "== $d =="; grep -n 'class="store-name"\|class="store-sub"\|Shop Again at\|class="logo"' $d/src/components/invoice/receiptHTML.ts; done`
Expected: each app shows its own current name; replace all with `${business.name}` / `${business.tagline}`.

- [ ] **Step 5: Verify both apps build**

Run: `cd silora-fashion-pos && npm run typecheck 2>&1 | grep -E "BusinessProfile|Settings.tsx|invoice/" || echo "silora: no new errors"; npm run build 2>&1 | tail -2`
Run: `cd sktex-pos && npm run typecheck 2>&1 | grep -E "BusinessProfile|Settings.tsx|invoice/" || echo "sktex: no new errors"; npm run build 2>&1 | tail -2`
Expected: "no new errors" and `✓ built` for both.

- [ ] **Step 6: Smoke-test silora in the browser**

`cd silora-fashion-pos && npm run dev`, share an invoice → message leads with `Silora Fashion`; Settings → Business tab edits/saves.

- [ ] **Step 7: Commit each repo**

```bash
cd silora-fashion-pos && git add src/contexts/BusinessProfileContext.tsx src/App.tsx src/components/Settings.tsx src/components/invoice/invoiceActions.ts src/components/invoice/receiptHTML.ts src/components/invoice/index.tsx && git commit -m "feat: central business profile + redesigned WhatsApp invoice message

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd ../sktex-pos && git add src/contexts/BusinessProfileContext.tsx src/App.tsx src/components/Settings.tsx src/components/invoice/invoiceActions.ts src/components/invoice/receiptHTML.ts src/components/invoice/index.tsx && git commit -m "feat: central business profile + redesigned WhatsApp invoice message

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- The context loads asynchronously; until it resolves, consumers see the per-app default name (correct), so there's no flash of "Gasith Motors".
- `setProfile` makes Settings edits live without a reload (Settings calls it after a successful upsert).
- WhatsApp formatting: `*bold*`, `_italic_`. The `·` separator and `−` minus are plain Unicode and render fine.
- Keep `db.ts` `GasithMotorsDB` untouched.
