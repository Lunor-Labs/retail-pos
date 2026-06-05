# Staff Phone Number & Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mandatory phone number and optional address fields to staff registration and edit, stored on both `staff_members` and `user_profiles` tables, and displayed in the staff detail panel.

**Architecture:** Three-layer change — SQL migration adds columns to both DB tables, TypeScript types are updated to match, and the React modal/detail panel in `SalesStaff.tsx` gains two new fields with phone validation.

**Tech Stack:** Supabase (PostgreSQL migrations), TypeScript, React (inline styles, no CSS framework)

---

## Files

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260605000002_add_staff_phone_address.sql` |
| Modify | `src/lib/database.types.ts` lines 12–72 |
| Modify | `src/components/SalesStaff.tsx` (interface, modal state, save logic, modal JSX, detail panel) |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260605000002_add_staff_phone_address.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add phone_number and address to staff_members (non-login staff)
ALTER TABLE staff_members
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Add phone_number and address to user_profiles (system-access staff)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;
```

- [ ] **Step 2: Apply the migration**

Run in the project root:
```bash
npx supabase db push
```
Expected: migration applied with no errors. If using remote Supabase, run:
```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260605000002_add_staff_phone_address.sql
git commit -m "feat: add phone_number and address columns to staff tables"
```

---

### Task 2: Update TypeScript database types

**Files:**
- Modify: `src/lib/database.types.ts`

- [ ] **Step 1: Update `user_profiles` Row type (line 22 — add after `updated_at`)**

Replace the `user_profiles` Row/Insert/Update block (lines 13–42) with:

```ts
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'cashier' | 'stock_manager' | 'staff'
          active: boolean
          daily_target: number
          phone_number: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'cashier' | 'stock_manager' | 'staff'
          active?: boolean
          daily_target?: number
          phone_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'cashier' | 'stock_manager'
          active?: boolean
          daily_target?: number
          phone_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
```

- [ ] **Step 2: Update `staff_members` Row/Insert/Update block (lines 45–71)**

Replace with:

```ts
        Row: {
          id: string
          full_name: string
          email: string
          active: boolean
          daily_target: number
          phone_number: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string
          active?: boolean
          daily_target?: number
          phone_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          active?: boolean
          daily_target?: number
          phone_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
```

- [ ] **Step 3: Verify types compile**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat: add phone_number and address to staff DB types"
```

---

### Task 3: Update StaffMember interface and enrich function

**Files:**
- Modify: `src/components/SalesStaff.tsx` lines 12–29 (interface) and ~1021 (enrich function)

- [ ] **Step 1: Add fields to the `StaffMember` interface**

Find the `StaffMember` interface (line 12) and add two fields after `commission_rate`:

```ts
interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  daily_target: number;
  commission_rate: number;
  phone_number: string;
  address: string;
  created_at: string;
  source: StaffSource;
  // enriched
  initials: string;
  tone: string;
  today: { sales: number; revenue: number };
  month: { sales: number; revenue: number };
  week: number[];
  isActiveToday: boolean;
}
```

- [ ] **Step 2: Update the `enrich` function to carry through the new fields**

Find the `enrich` lambda around line 1021. Add `phone_number` and `address` defaults:

```ts
const enrich = (u: any, role: StaffRole, source: StaffSource): StaffMember => ({
  ...u,
  role,
  source,
  daily_target: u.daily_target ?? 0,
  commission_rate: u.commission_rate ?? 0,
  phone_number: u.phone_number ?? '',
  address: u.address ?? '',
  initials: getInitials(u.full_name),
  tone: getTone(u.full_name),
  today: todayMap[u.id] ?? { sales: 0, revenue: 0 },
  month: monthMap[u.id] ?? { sales: 0, revenue: 0 },
  week: weekMap[u.id] ?? new Array(7).fill(0),
  isActiveToday: !!(todayMap[u.id]?.sales),
});
```

- [ ] **Step 3: Verify types compile**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SalesStaff.tsx
git commit -m "feat: add phone_number and address to StaffMember interface"
```

---

### Task 4: Add fields to StaffModal (state + save + JSX)

**Files:**
- Modify: `src/components/SalesStaff.tsx` — `StaffModal` component (~lines 111–240)

- [ ] **Step 1: Add state for the two new fields**

Find the existing state declarations in `StaffModal` (around line 119):

```ts
const [fullName, setFullName] = useState(isAdd ? '' : mode.member.full_name);
const [emailInput, setEmailInput] = useState(isAdd ? '' : mode.member.email);
const [active, setActive] = useState(isAdd ? true : mode.member.active);
```

Add after them:

```ts
const [phoneNumber, setPhoneNumber] = useState(isAdd ? '' : mode.member.phone_number);
const [address, setAddress] = useState(isAdd ? '' : mode.member.address);
```

- [ ] **Step 2: Update validation and save logic in `handleSave`**

Replace the existing `handleSave` function body with:

```ts
async function handleSave() {
  setErr('');
  if (!fullName.trim()) { setErr('Full name is required.'); return; }
  if (!phoneNumber.trim()) { setErr('Phone number is required.'); return; }
  if (isAdd && !emailInput.trim()) { setErr('Email is required.'); return; }
  setSaving(true);
  try {
    if (isAdd) {
      const { error } = await (supabase.from('staff_members') as any)
        .insert({
          full_name: fullName.trim(),
          email: emailInput.trim().toLowerCase(),
          phone_number: phoneNumber.trim(),
          address: address.trim() || null,
          active: true,
        });
      if (error) throw error;
      showToast(`${fullName.trim()} added to staff`, 'success');
      onSaved();
      onClose();
    } else {
      const table = mode.member.source === 'member' ? 'staff_members' : 'user_profiles';
      const { error } = await (supabase.from(table) as any)
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          address: address.trim() || null,
          active,
        })
        .eq('id', mode.member.id);
      if (error) throw error;
      showToast('Staff member updated', 'success');
      onSaved();
      onClose();
    }
  } catch (e: any) {
    setErr(e?.message ?? 'An error occurred.');
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 3: Add the Phone Number and Address fields to the modal JSX**

Find the form fields section in the modal JSX (around line 190). After the Full Name `<div>` and before the Email `<div>`, insert:

```tsx
<div>
  <label style={labelStyle}>Phone Number <span style={{ color: 'var(--danger)' }}>*</span></label>
  <input
    style={inputStyle}
    value={phoneNumber}
    onChange={e => setPhoneNumber(e.target.value)}
    placeholder="e.g. +94 77 123 4567"
    type="tel"
  />
</div>
```

After the Email `<div>`, insert:

```tsx
<div>
  <label style={labelStyle}>Address</label>
  <textarea
    value={address}
    onChange={e => setAddress(e.target.value)}
    placeholder="e.g. 42 Main Street, Colombo"
    rows={2}
    style={{
      ...inputStyle,
      height: 'auto',
      padding: '8px 11px',
      resize: 'vertical',
      lineHeight: 1.5,
    }}
  />
</div>
```

- [ ] **Step 4: Verify types compile**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SalesStaff.tsx
git commit -m "feat: add phone number and address fields to staff modal"
```

---

### Task 5: Display phone and address in DetailPanel

**Files:**
- Modify: `src/components/SalesStaff.tsx` — `DetailPanel` identity card info rows (~lines 361–378)

- [ ] **Step 1: Add Phone and Address rows to the identity card**

Find the info rows section in `DetailPanel` (the `<div>` with `display: 'flex', flexDirection: 'column', gap: 8` around line 361). After the Status row, add:

```tsx
<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Phone</span>
  {member.phone_number
    ? <a href={`tel:${member.phone_number}`} style={{ color: 'var(--accent-ink)', textDecoration: 'none' }}>{member.phone_number}</a>
    : <span style={{ color: 'var(--faint)' }}>—</span>
  }
</div>
<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', width: 48, flexShrink: 0 }}>Address</span>
  {member.address
    ? <span style={{ lineHeight: 1.5 }}>{member.address}</span>
    : <span style={{ color: 'var(--faint)' }}>—</span>
  }
</div>
```

- [ ] **Step 2: Verify types compile**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Final commit**

```bash
git add src/components/SalesStaff.tsx
git commit -m "feat: show phone and address in staff detail panel"
```

---

## Verification

After all tasks are done:

1. Run `npm run typecheck` — must pass with no errors.
2. Start the dev server: `npm run dev`
3. Navigate to Sales Staff → Add Staff:
   - Confirm Phone Number field appears below Full Name, required.
   - Confirm Address textarea appears below Email, optional.
   - Try saving without a phone number — should show "Phone number is required."
   - Save a new staff member with phone + address — should succeed.
4. Click the new staff member → confirm Phone and Address rows appear in the detail card.
5. Click Edit on an existing staff member — confirm phone/address fields are pre-filled.
