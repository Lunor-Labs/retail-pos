# Start-of-Day Opening Balance Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a focused, dismissible-only-by-skip "Start of Day" screen on login that forces admins/cashiers to record the opening cash float before the day's first sale, replicated across all three POS apps.

**Architecture:** A self-contained `StartOfDayGate` overlay component reuses the existing `app_settings` → `opening_balance_<date>` contract (same key/upsert as `DayManagement`). `App.tsx` runs a trigger check after `profile` loads and renders the gate as an overlay above `<Layout>`. Skips are remembered per-day-per-device in `localStorage`.

**Tech Stack:** React 18 + TypeScript, Vite, Supabase JS, lucide-react icons, existing `ToastContext` and CSS design tokens.

## Global Constraints

- **No test framework exists in these apps** (zero test files; scripts are `dev`/`build`/`lint`/`typecheck`/`preview`). Do NOT add one. Verification gates per task are: `npm run typecheck` (PASS, no new errors), `npm run lint` (no new errors), `npm run build` (succeeds), plus the explicit manual browser checks in each task.
- **Date key expression (verbatim, do not change):** `new Date().toISOString().split('T')[0]` — must match `DayManagement.tsx` so keys align.
- **Opening-balance setting key (verbatim):** `` `opening_balance_${today}` ``, value = `String(bal)`, written via `(supabase.from('app_settings') as any).upsert({ key, value }, { onConflict: 'key' })`.
- **Skip flag key (verbatim):** `` `opening_balance_skipped_${today}` `` in `localStorage`, value `'1'`.
- **Gated roles:** `'admin'` and `'cashier'` only. `'stock_manager'` and any other role are never gated.
- **Currency format (verbatim):** `` `LKR ${Math.round(n).toLocaleString()}` ``.
- **Three target apps, identical structure:** `retail-pos` (lead), `silora-fashion-pos`, `sktex-pos`. Each is its own git repo. In all three, the auth gate is `src/App.tsx:69` (`if (!user || !profile) return <Login />`) and `DayManagement` uses the same opening-balance key.
- **Commit in each repo separately.** End commit messages with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

---

### Task 1: Create the `StartOfDayGate` component (retail-pos)

Builds the full overlay UI plus its save/skip behavior as a standalone component. No `App.tsx` wiring yet — at the end of this task the component compiles but is not yet rendered.

**Files:**
- Create: `retail-pos/src/components/StartOfDayGate.tsx`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`; `useToast` from `../contexts/ToastContext` (`showToast(message: string, type?: 'success'|'error'|'info'|'warning')`).
- Produces: `export function StartOfDayGate({ onDone }: { onDone: () => void }): JSX.Element`. `onDone` is called exactly once after a successful save OR a confirmed skip; the parent then stops rendering the component.

- [ ] **Step 1: Write the component file**

Create `retail-pos/src/components/StartOfDayGate.tsx` with this exact content:

```tsx
import { useState, useRef } from 'react';
import { Sunrise } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export function StartOfDayGate({ onDone }: { onDone: () => void }) {
  const { showToast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const settingKey = `opening_balance_${today}`;

  const [balanceInput, setBalanceInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const inFlight = useRef(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function startDay() {
    if (inFlight.current) return;
    const bal = parseFloat(balanceInput);
    if (isNaN(bal) || bal < 0) { showToast('Enter a valid amount', 'error'); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      const { error } = await (supabase.from('app_settings') as any)
        .upsert({ key: settingKey, value: String(bal) }, { onConflict: 'key' });
      if (error) throw error;
      showToast('Opening balance saved', 'success');
      onDone();
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save', 'error');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function skipToday() {
    try { localStorage.setItem(`opening_balance_skipped_${today}`, '1'); } catch { /* ignore */ }
    onDone();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,12,15,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden' }}>

        <div style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Sunrise size={20} style={{ color: 'var(--accent)' }} strokeWidth={1.8} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{greeting}</h2>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{dateLabel}</div>
            </div>
          </div>

          {confirmingSkip ? (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Continue without recording the opening float? You can still set it later from Day Report.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmingSkip(false)} className="btn" style={{ flex: 1, height: 40, fontSize: 13 }}>
                  Back
                </button>
                <button onClick={skipToday} className="btn" style={{ flex: 1, height: 40, fontSize: 13, color: 'var(--warn)' }}>
                  Skip
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Set today&rsquo;s opening cash float to begin.
              </div>

              <div style={{ display: 'flex', alignItems: 'center', height: 46, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)', overflow: 'hidden' }}>
                <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--muted)', borderRight: '1px solid var(--line-2)', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>LKR</span>
                <input
                  type="number" min={0} step={100} autoFocus
                  value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && startDay()}
                  placeholder="0"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', padding: '0 14px', fontSize: 18, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono',monospace" }}
                />
              </div>

              <button
                onClick={startDay}
                disabled={saving || !balanceInput}
                className="btn btn-primary"
                style={{ height: 44, fontSize: 14, fontWeight: 600 }}
              >
                {saving ? 'Saving…' : 'Start Day'}
              </button>

              <button
                onClick={() => setConfirmingSkip(true)}
                style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12.5, padding: 2, alignSelf: 'center' }}
              >
                Skip for today
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd retail-pos && npm run typecheck`
Expected: PASS with no new errors referencing `StartOfDayGate.tsx`.

(If `Sunrise` is not exported by the installed `lucide-react@0.344.0`, replace the import and usage with `TrendingUp` — already used in `DayManagement.tsx`, so it is guaranteed available. Verify with `grep -o "Sunrise" node_modules/lucide-react/dist/lucide-react.d.ts | head` returning a match before relying on it.)

- [ ] **Step 3: Verify lint**

Run: `cd retail-pos && npm run lint`
Expected: No new errors for `StartOfDayGate.tsx`.

- [ ] **Step 4: Commit**

```bash
cd retail-pos && git add src/components/StartOfDayGate.tsx && git commit -m "feat: add StartOfDayGate opening-balance overlay component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire the gate into `App.tsx` trigger logic (retail-pos)

Adds the role/skip/balance check after `profile` loads and renders the gate as an overlay. At the end of this task the feature is fully working in retail-pos.

**Files:**
- Modify: `retail-pos/src/App.tsx` (import block near line 1-19; `AppContent` body near line 21; render block before `</Layout>` near line 100)

**Interfaces:**
- Consumes: `StartOfDayGate` from Task 1; `supabase` from `./lib/supabase`; existing `useAuth()` returning `{ user, profile, loading }` where `profile.role` is `'admin' | 'cashier' | 'stock_manager' | 'staff'`.
- Produces: nothing consumed by later tasks (terminal wiring).

- [ ] **Step 1: Add imports**

In `retail-pos/src/App.tsx`, add these two imports alongside the existing import block (after the `ToastContainer` import on line 19):

```tsx
import { StartOfDayGate } from './components/StartOfDayGate';
import { supabase } from './lib/supabase';
```

- [ ] **Step 2: Add gate state and trigger effect**

In `AppContent`, immediately after the existing `const [initialStockFilter, setInitialStockFilter] = useState<StockFilter>('all');` line, add:

```tsx
  const [showStartOfDay, setShowStartOfDay] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const gatedRole = profile.role === 'admin' || profile.role === 'cashier';
    if (!gatedRole) { setShowStartOfDay(false); return; }
    const today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(`opening_balance_skipped_${today}`)) { setShowStartOfDay(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase.from('app_settings') as any)
          .select('value').eq('key', `opening_balance_${today}`).maybeSingle();
        const isSet = data && data.value != null && data.value !== '' && !isNaN(parseFloat(data.value));
        if (!cancelled) setShowStartOfDay(!isSet);
      } catch {
        if (!cancelled) setShowStartOfDay(false); // fail open — never trap the user
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role]);
```

- [ ] **Step 3: Render the gate as an overlay**

In `AppContent`'s return, add the gate just before the closing `</Layout>` tag (after the `{currentView === 'settings' && <Settings />}` line):

```tsx
      {showStartOfDay && <StartOfDayGate onDone={() => setShowStartOfDay(false)} />}
```

- [ ] **Step 4: Verify typecheck, lint, build**

Run: `cd retail-pos && npm run typecheck && npm run lint && npm run build`
Expected: all succeed with no new errors.

- [ ] **Step 5: Manual verification in browser**

Run: `cd retail-pos && npm run dev`, open the app, and confirm each:
1. Log in as an **admin** on a day with no opening balance set, and with no `opening_balance_skipped_<today>` in localStorage (clear it via DevTools if present) → the Start of Day overlay appears over the dashboard.
2. Enter a valid amount, press **Start Day** → toast "Opening balance saved", overlay closes, open **Day Report** and confirm the opening balance shows the same value.
3. Reload → overlay does NOT reappear (balance now set).
4. In DevTools, delete the `app_settings` value (or use a fresh day) and clear the skip flag, reload → overlay reappears → click **Skip for today** → **Skip** → overlay closes; reload → overlay does NOT reappear; confirm `localStorage` has `opening_balance_skipped_<today> = "1"`.
5. **Skip for today** → **Back** → returns to the amount input, overlay still open.
6. Log in as a **stock_manager** (clear skip flag first) → overlay never appears.

Record the outcome of each check. If any fail, fix before committing.

- [ ] **Step 6: Commit**

```bash
cd retail-pos && git add src/App.tsx && git commit -m "feat: gate login with start-of-day opening balance for admin/cashier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Replicate to silora-fashion-pos and sktex-pos

Ports the identical component and wiring to the other two apps. The structure is identical (auth gate at `App.tsx:69`, same `app_settings` key, same toast context and tokens), so this is a mechanical copy with per-repo verification.

**Files (per app, for each of `silora-fashion-pos` and `sktex-pos`):**
- Create: `src/components/StartOfDayGate.tsx`
- Modify: `src/App.tsx`

**Interfaces:** identical to Tasks 1 and 2.

- [ ] **Step 1: Copy the component into both apps**

```bash
cp retail-pos/src/components/StartOfDayGate.tsx silora-fashion-pos/src/components/StartOfDayGate.tsx
cp retail-pos/src/components/StartOfDayGate.tsx sktex-pos/src/components/StartOfDayGate.tsx
```

- [ ] **Step 2: Apply the App.tsx wiring to silora-fashion-pos**

In `silora-fashion-pos/src/App.tsx`, apply the same three edits from Task 2:
1. Add the two imports (`StartOfDayGate`, `supabase`) to the import block.
2. Add the `showStartOfDay` state + trigger `useEffect` right after the `initialStockFilter` state declaration.
3. Add `{showStartOfDay && <StartOfDayGate onDone={() => setShowStartOfDay(false)} />}` just before `</Layout>`.

Use the exact code blocks from Task 2 Steps 1-3. First confirm the anchor lines exist:

Run: `grep -n "initialStockFilter, setInitialStockFilter\|</Layout>\|ToastContainer" silora-fashion-pos/src/App.tsx`
Expected: matches for the state line, the closing `</Layout>`, and the ToastContainer import. If `initialStockFilter` is absent, place the state/effect immediately after the other `useState` declarations in `AppContent` instead.

- [ ] **Step 3: Apply the App.tsx wiring to sktex-pos**

Repeat Step 2 for `sktex-pos/src/App.tsx` with the same three edits and the same anchor check:

Run: `grep -n "initialStockFilter, setInitialStockFilter\|</Layout>\|ToastContainer" sktex-pos/src/App.tsx`

- [ ] **Step 4: Verify both apps build**

Run: `cd silora-fashion-pos && npm run typecheck && npm run lint && npm run build`
Expected: all succeed.

Run: `cd sktex-pos && npm run typecheck && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 5: Smoke-test one of the two in the browser**

Run `npm run dev` in `silora-fashion-pos`, log in as admin with no balance set and no skip flag → overlay appears → Start Day saves and closes. (Full matrix already covered in Task 2; this confirms the port wired up correctly.)

- [ ] **Step 6: Commit each repo**

```bash
cd silora-fashion-pos && git add src/components/StartOfDayGate.tsx src/App.tsx && git commit -m "feat: add start-of-day opening balance gate for admin/cashier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd ../sktex-pos && git add src/components/StartOfDayGate.tsx src/App.tsx && git commit -m "feat: add start-of-day opening balance gate for admin/cashier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- The gate uses `zIndex: 300` so it sits above the `DayManagement` modal (`zIndex: 200`) and the `Layout` chrome.
- Do not add a close (X) button or backdrop-click dismiss — the only exits are **Start Day** (save) and **Skip for today → Skip** (confirmed skip), per the spec's soft-block rule.
- The trigger deliberately renders the app shell behind the gate (no extra loading screen) so there is no flash-of-blank while the async balance check runs; the overlay simply appears a moment after login if needed.
- `profile.role` typing comes from `Database['public']['Tables']['user_profiles']['Row']`; comparing against the string literals `'admin'`/`'cashier'` is type-safe.
