# Start-of-Day Opening Balance Gate — Design

**Date:** 2026-06-27
**Applies to:** `retail-pos`, `silora-fashion-pos`, `sktex-pos` (structurally identical apps)

## Problem

The opening cash float for the day is currently set manually inside the **Day Report** (Day Management) modal, reached from the Dashboard. Staff routinely forget to set it, so the "Expected Cash in Drawer" figure is wrong. We want to prompt for it automatically at the start of each day so the float is captured before work begins.

## Goal

When a gated user logs in on a day for which the opening balance has not been recorded, present a focused **Start of Day** screen that prompts them to enter the opening cash float before continuing. It is dismissible only via an explicit, confirmed "Skip for today", and the skip is remembered for the rest of that day on that device.

## Scope decisions (confirmed)

- **Who is gated:** `admin` and `cashier` roles. `stock_manager` (and any other role) is never gated.
- **Strictness:** Soft block. No close (X) button, no backdrop-click dismiss. The only way past without entering a balance is a quiet **"Skip for today"** link, which opens a small confirm step.
- **Skip memory:** Once skipped for the day, it does not reappear on refresh or navigation for the rest of that calendar day, per device.
- **Approach:** Dedicated Start-of-Day overlay (NOT a reuse of the existing Day Management modal). The existing Day Report remains unchanged for mid-day review and editing.

## Architecture

### New component: `StartOfDayGate`

Location: `src/components/StartOfDayGate.tsx` in each app.

Responsibilities:
- Decide whether the gate should show (see Trigger logic).
- Render a full-viewport overlay with the opening-balance entry UI.
- On save, upsert the balance and dismiss.
- On confirmed skip, set the skip flag and dismiss.

Props:
```ts
{ onDone: () => void }   // called after save or confirmed skip; parent stops rendering the gate
```

It reuses the existing data contract:
- Read/write `app_settings` row with key `opening_balance_<YYYY-MM-DD>`, value = stringified number, `upsert(..., { onConflict: 'key' })` — identical to `DayManagement.saveOpeningBalance`.
- LKR formatting and input styling mirror `DayManagement` for visual consistency (`'JetBrains Mono'` numeric input, `LKR` prefix chip, `--accent` tokens).

### Wiring in `App.tsx` (`AppContent`)

Inserted after the existing auth gate (`App.tsx:69`, `if (!user || !profile) return <Login />`) and before the `<Layout>` return:

```tsx
const [gateChecked, setGateChecked] = useState(false);
const [showStartOfDay, setShowStartOfDay] = useState(false);

useEffect(() => {
  if (!profile) return;
  const role = profile.role;
  const gatedRole = role === 'admin' || role === 'cashier';
  if (!gatedRole) { setGateChecked(true); return; }
  const today = new Date().toISOString().split('T')[0];
  if (localStorage.getItem(`opening_balance_skipped_${today}`)) { setGateChecked(true); return; }
  // async: check app_settings for opening_balance_<today>
  checkOpeningBalance(today).then(isSet => {
    setShowStartOfDay(!isSet);
    setGateChecked(true);
  });
}, [profile?.id, profile?.role]);
```

- While the async check is in flight (`!gateChecked`), the app shell still renders normally (no extra blank/loading state) — the gate simply appears a moment later if needed. This avoids a flash-of-loading regression.
- The gate is rendered as an overlay on top of `<Layout>` (like the existing `DayManagement` overlay pattern at `Dashboard.tsx:730`), so the app behind it stays mounted.

### Trigger logic (precise)

Show the Start-of-Day gate when **all** are true:
1. `user` and `profile` are loaded.
2. `profile.role` is `admin` or `cashier`.
3. `localStorage["opening_balance_skipped_<today>"]` is absent.
4. `app_settings` has no row for key `opening_balance_<today>` (or its value is empty/NaN).

`<today>` = `new Date().toISOString().split('T')[0]` — same expression used in `DayManagement`, keeping keys consistent.

### Skip memory

- Key: `localStorage["opening_balance_skipped_<YYYY-MM-DD>"] = "1"`.
- Per-day, per-device. Old keys naturally become irrelevant the next day; no cleanup needed (optionally prune on read).
- Setting the balance does NOT need a skip flag — condition 4 already covers it after save.

## UI / UX (Start-of-Day screen)

Full-viewport overlay, `position: fixed; inset: 0; zIndex: 200`, dimmed blurred backdrop matching `DayManagement` (`rgba(10,12,15,0.5)`, `backdropFilter: blur(4px)`). Backdrop click does nothing (no dismiss).

Centered card, `maxWidth: ~440`, `borderRadius: 14`, `--panel` background, soft shadow. Contents top to bottom:

1. **Greeting + date.** Time-aware greeting ("Good morning" before 12:00, "Good afternoon" before 17:00, else "Good evening") followed by the long date, e.g. *"Friday, 27 June 2026"*. Uses `toLocaleDateString('en-US', { weekday, day, month, year })` as in `DayManagement`.
2. **Prompt line.** *"Set today's opening cash float to begin."* (muted subtext).
3. **Amount input.** Single large field: `LKR` prefix chip + numeric input (`type=number`, `min=0`, `step=100`, `autoFocus`), `'JetBrains Mono'`, reused styling from `DayManagement` opening-balance input. Enter key triggers Start Day.
4. **Primary action.** Button **"Start Day"** (`btn btn-primary`), disabled while empty or saving, label shows "Saving…" during the upsert. On success: toast "Opening balance saved" (reuse `useToast`) and call `onDone`.
5. **Skip affordance.** A quiet text link **"Skip for today"** below the primary button. Clicking it swaps the card body to an inline confirm: *"Continue without recording the opening float? You can still set it later from Day Report."* with **"Skip"** (confirms, sets flag, `onDone`) and **"Back"** (returns to the input). Inline confirm — no nested modal.

Validation mirrors `DayManagement.saveOpeningBalance`: reject `NaN`/negative with toast "Enter a valid amount"; guard against double-submit with an in-flight ref.

## Error handling

- **Save failure:** toast the error message (reuse the existing `catch` pattern), keep the gate open so the user can retry. Do not call `onDone`.
- **Balance-check (read) failure on login:** fail open — treat as "not blocking" (`setShowStartOfDay(false)`), so a transient Supabase error never traps the user out of the app. The float can still be set from Day Report. (Acceptable because the gate is a soft prompt, not a security control.)
- **In-flight guard:** `useRef` to prevent duplicate upserts on rapid Enter/click, mirroring existing code.

## Testing

- **Gated admin/cashier, no balance set, not skipped →** gate appears after login.
- **Stock manager →** gate never appears.
- **Balance already set for today →** no gate.
- **Skip → confirm → Skip →** gate dismisses; refresh/navigation same day does not re-show; `localStorage` flag present.
- **Skip → confirm → Back →** returns to input, gate still active.
- **Enter valid amount → Start Day →** `app_settings` upserted with `opening_balance_<today>`, toast shown, gate dismisses, Day Report reflects the value.
- **Invalid amount (negative / empty) →** validation toast, gate stays.
- **Read failure on login (simulated) →** app loads normally, no gate (fail-open).
- **Next calendar day →** gate reappears (new date key, stale skip flag ignored).

## Replication

Implement and verify in `retail-pos` first, then port the identical `StartOfDayGate.tsx` and `App.tsx` wiring to `silora-fashion-pos` and `sktex-pos`. The three share the same `App.tsx` auth gate (line 69), `AuthContext` shape (`profile.role`), `app_settings` schema, toast context, and design tokens, so the port is mechanical. Verify the build in each.

## Out of scope (YAGNI)

- Per-user or per-store opening balances (current model is a single global per-day value — unchanged).
- Editing/closing-balance reconciliation flow (Day Report already handles review).
- Server-side enforcement (this is a UX prompt, not a permission boundary).
