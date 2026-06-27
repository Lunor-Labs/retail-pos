# Central Business Profile + Redesigned WhatsApp Invoice — Design

**Date:** 2026-06-27
**Applies to:** `retail-pos`, `silora-fashion-pos`, `sktex-pos` (structurally identical apps)

## Problem

The WhatsApp invoice-share message hardcodes `Gasith Motors` and a stale phone number (`invoiceActions.ts:16-17`) in all three apps — a copy-paste template that was never updated. Meanwhile each app's printed receipt hardcodes its *correct* business name separately (`receiptHTML.ts:105-106`: `RIVONLAK` / `Silora Fashion` / `SK TEX`). The name lives in two places and has drifted. There is no central, editable business identity.

Separately, the WhatsApp message itself is visually noisy (rows of `--------` divider lines that render poorly on mobile, scattered emoji) and should be redesigned to read cleanly.

## Goals

1. **Single source of truth** for business identity (name, tagline, phone, address), editable by admins in Settings, read by both the WhatsApp share and the printed receipt.
2. **Fix the wrong name immediately** — seed defaults from each app's current receipt name so the message is correct on ship, before anyone edits Settings.
3. **Redesign the WhatsApp message** to the approved "Clean" layout.

## Scope decisions (confirmed)

- Business identity stored centrally and **editable through an admin-only Settings section**.
- Fields: **name, tagline, phone, address**. (YAGNI — no email/social/logo upload.)
- Both the **WhatsApp share** and the **printed receipt** read from the central profile.
- WhatsApp message uses the **"Clean" variant**, with the **batch number dropped** from the customer-facing message.
- The internal IndexedDB class name `GasithMotorsDB` (`db.ts`) is **left as-is** — not user-facing; renaming would orphan existing local data.

## Architecture

### Data model

One row in the existing `app_settings` table:
- key: `business_profile`
- value: JSON string of `{ name: string, tagline: string, phone: string, address: string }`

Same table and `(supabase.from('app_settings') as any).upsert({ key, value }, { onConflict: 'key' })` pattern already used by cost-code, vouchers, and the opening-balance feature.

### `BusinessProfileContext` (load once, app-wide)

New file `src/contexts/BusinessProfileContext.tsx`, modeled on the existing `CostCodeContext`.

```ts
export interface BusinessProfile { name: string; tagline: string; phone: string; address: string; }
```

- Holds a per-app **default** profile (see Defaults). State is initialised to the default so consumers always have a complete object.
- On mount, fetches `business_profile` from `app_settings`; merges any stored fields over the default (missing/blank stored fields fall back to default).
- Exposes `{ profile, setProfile }` via `useBusinessProfile()`. `setProfile` lets the Settings section update the live value after saving, so the receipt/WhatsApp reflect edits without an app reload.
- Provider is nested in `App.tsx` alongside `CostCodeProvider`.

**Defaults (per app):**
- retail-pos: `{ name: 'RIVONLAK', tagline: 'Fashion Retail', phone: '', address: '' }`
- silora-fashion-pos: `{ name: 'Silora Fashion', tagline: 'Fashion Retail', phone: '', address: '' }`
- sktex-pos: `{ name: 'SK TEX', tagline: 'Fashion Retail', phone: '', address: '' }`

Phone/address default to empty; empty fields are omitted by consumers. The stale Gasith phone is *not* carried forward — admin enters the real number.

### Admin Settings section

Add a new section to `Settings.tsx`:
- Extend `SectionId` union with `'business'`.
- Add a `NAV` entry `{ id: 'business', label: 'Business', icon: <Store/>, adminOnly: true }`.
- Render `{section === 'business' && isAdmin && <BusinessProfileSection />}`.
- New `BusinessProfileSection` component: form with **Business name, Tagline, Phone, Address** inputs, prefilled from `useBusinessProfile().profile`. On Save, upsert JSON to `app_settings` (`business_profile`) and call `setProfile(...)` to update context live; toast on success/failure. Follows the visual/style conventions of the existing `CostCodeSection` / `VoucherRulesSection`.

### Consumers

**WhatsApp share — `invoiceActions.ts`:**
- `shareOnWhatsApp(invoiceData, showDiscount, business: BusinessProfile)` — new third param.
- Replaces the hardcoded name/phone block with `business.*`; rebuilds the body per the Clean layout below.

**Printed receipt — `receiptHTML.ts`:**
- `buildReceiptHTML(invoiceData, showDiscount, logoSrc, qrSrc, business: BusinessProfile)` — new fifth param.
- `store-name` ← `business.name`, `store-sub` ← `business.tagline`, "Shop Again at …" ← `business.name`, logo `alt` ← `business.name`. Seeded defaults make output identical to today until edited.

**Pass-through — `invoiceActions.ts` `openPrintPopup`:**
- `openPrintPopup(invoiceData, showDiscount, buildHTML, business)` — new fourth param; `buildHTML` callback type gains the `business` argument and it is forwarded into the `buildHTML(...)` call.

**Caller — `invoice/index.tsx`:**
- Reads `const { profile } = useBusinessProfile();` and passes `profile` into `openPrintPopup(...)` and `shareOnWhatsApp(...)`.

## The "Clean" WhatsApp message

A `money(n)` helper formats amounts with thousands separators and two decimals:
`n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

Construction rules (every optional line is omitted when its source is empty/zero):

```
*{business.name}*
_{business.tagline}_              ← omitted if tagline empty

🧾 Invoice *{saleNumber}*
📅 {date}

👤 {customerName}                 ← whole block omitted if no customerName
📱 {customerPhone}                ← omitted if no customerPhone

*Items*
{n}. {item.name}{ — variantLabel} ← variantLabel suffix only if present; NO batch number
   {qty} × {money(unitPrice)} = *{money(subtotal)}*
...                               ← unit price/subtotal honor showDiscount, same logic as today

Subtotal   LKR {money(subtotal)}  ← shown only if there are adjustments below it
Discount   −LKR {money(discount)} ← if discount > 0 (and showDiscount)
Tax   LKR {money(tax)}            ← if tax > 0
Service Charge   LKR {money(serviceCharge)} ← if serviceCharge > 0
*Total   LKR {money(total)}*

💳 {Payment label} · Paid {money(paidAmount)} · Change {money(changeAmount)}
                                  ← "Paid"/"Change" segments only when relevant (e.g. cash);
                                     payment label is paymentMethod, title-cased
🧑‍💼 Served by {cashierName}       ← omitted if no cashierName

🙏 Thank you for shopping with us!
📞 {business.phone}               ← omitted if empty
📍 {business.address}             ← omitted if empty
```

Differences from the current message: brand name leads (bold) with tagline; all `--------` dividers removed; payment condensed to one line; contact moved to footer and sourced from config; batch number dropped; amounts use thousands separators. The `wa.me/?text=` open mechanism is unchanged.

## Error handling

- **Profile fetch fails on load:** context keeps the per-app default (fail-safe) — business identity is never blank.
- **Settings save fails:** toast the error, keep the form populated for retry; do not update context.
- **Missing fields in stored JSON:** merged over defaults, so partial data still yields a complete profile.

## Testing

No automated test framework exists in these apps (verification = `typecheck` + `lint` + `build` + manual checks, consistent with prior features).

Manual checks:
- WhatsApp share on a fresh install (no `business_profile` row) shows the app's default name (e.g. `RIVONLAK`), **not** Gasith Motors.
- Printed receipt header is unchanged from today (seeded defaults).
- Admin → Settings → Business: edit name/tagline/phone/address, Save → toast; immediately re-share an invoice → message reflects new values without reload; reload app → values persist.
- Non-admin user does not see the Business section.
- Cash sale with no customer and no discount → message is short (optional blocks omitted), no stray dividers, amounts have thousands separators, no batch numbers.
- Sale with variant labels → item lines show `— {variantLabel}`.

## Replication

Implement in `retail-pos` first, then port to `silora-fashion-pos` and `sktex-pos`. The context, Settings section, and consumer edits are identical except the **default business name** per app. Verify each builds.

## Out of scope (YAGNI)

- Logo upload / theming, email, social links, multiple phone numbers as structured fields (phone is a single free-text string — admin can type `+94 … / +94 …` if they want two).
- Renaming the internal `GasithMotorsDB` IndexedDB class.
- Per-branch or multi-location profiles.
