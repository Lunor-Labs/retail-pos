# Staff Registration: Phone Number & Address Fields

**Date:** 2026-06-05

## Summary

Add `phone_number` (mandatory) and `address` (optional) fields to the staff registration and edit flow. All staff — whether added as non-login members or system-access users — share the same form, with the intent that any staff member can later be upgraded or downgraded to a system user.

## Scope

- `staff_members` table (non-login staff added via "Add Staff")
- `user_profiles` table (staff with system access — admins, cashiers, stock managers)
- `StaffModal` component (Add and Edit modes)
- `DetailPanel` component (identity card display)
- `StaffMember` TypeScript interface
- `database.types.ts` type definitions

## Database Changes

Add two nullable columns to both `staff_members` and `user_profiles`:

```sql
ALTER TABLE staff_members ADD COLUMN phone_number TEXT;
ALTER TABLE staff_members ADD COLUMN address TEXT;

ALTER TABLE user_profiles ADD COLUMN phone_number TEXT;
ALTER TABLE user_profiles ADD COLUMN address TEXT;
```

Columns are nullable at the DB level; mandatory enforcement for `phone_number` happens in the UI layer only.

## UI Changes

### StaffModal (Add & Edit)

Field order:
1. Full Name — required (existing)
2. Phone Number — required (new)
3. Email — required on add, read-only on edit (existing)
4. Address — optional, textarea (new)
5. Active toggle (edit only, existing)
6. Info/hint block (existing)

Validation rules:
- Full Name: must not be empty
- Phone Number: must not be empty

On save (insert): include `phone_number` and `address` in the payload.
On save (update): include `phone_number` and `address` in the update payload for both `staff_members` and `user_profiles`.

### DetailPanel (identity card)

Add two rows below Status in the info section:
- **Phone** — shown as a `tel:` link if present, dash if absent
- **Address** — plain text if present, dash if absent

## TypeScript Changes

`StaffMember` interface:
```ts
phone_number: string;
address: string;
```

`database.types.ts` — add to `staff_members` and `user_profiles` Row/Insert/Update:
```ts
phone_number: string | null
address: string | null
```

## Out of Scope

- Search by phone number
- Phone number format validation (format is not enforced, just non-empty)
- Displaying phone/address in the staff list rows
