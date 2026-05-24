# Frontend & Backend Skills Design

**Date:** 2026-05-24  
**Project:** retail-pos  
**Goal:** Two reusable skills that guide and enforce conventions for any React + Supabase web app built from this codebase.

---

## Overview

Two skill files stored in `.claude/skills/` at the project root, version-controlled alongside the code so they travel with the repo when copied to a new project.

```
.claude/
  skills/
    frontend.md
    backend.md
```

**Skill type:** Rigid — Claude follows them exactly, not adaptively.

**Trigger rules:**
- Manual: `/frontend` or `/backend`
- Auto: Claude self-triggers `frontend.md` when working on components, hooks, contexts, or UI; `backend.md` when working on repositories, services, migrations, or auth.

---

## frontend.md — Content Spec

### 1. Stack
React 18 + TypeScript + Vite + Tailwind CSS + Lucide React (icons) + Recharts (charts).  
No class components. No `any` types.

### 2. File Organization
```
src/
  components/    # UI only — no data fetching inside components
  hooks/         # Data + state logic (wrap services)
  contexts/      # App-wide state (auth, toasts)
  services/      # Business logic (imported by hooks)
  types/         # Shared TypeScript types
  utils/         # Pure helper functions
```

### 3. Component Conventions
- Functional components with named exports
- Props typed inline with `interface`
- No logic beyond rendering and calling hooks
- One component per file for non-trivial components

### 4. Tailwind Design System
Use only these color tokens:
- `accent`, `accent-soft`, `accent-ink` — brand green
- `canvas` — page background
- `panel`, `panel-2` — card/surface backgrounds

Typography:
- `font-sans` (Inter) — all UI text
- `font-mono` (JetBrains Mono) — codes, SKUs, barcodes

No hardcoded hex values in JSX.

### 5. Custom Hooks Pattern
- Hooks import from `services/`, never call Supabase directly
- Always expose `loading`, `error` state
- Return clean objects (not arrays unless the hook returns a list)
- No business logic inside hooks — delegate to services

### 6. Mobile-Responsive Patterns
- Mobile-first Tailwind classes
- Use `md:` as the primary desktop breakpoint
- Hide desktop-only features on mobile with `hidden md:block`
- Test all UI at 375px (mobile) and 1280px (desktop)

### 7. Context Pattern
- Only for truly global state: auth session, toast notifications
- Feature state lives in hooks, not context
- Never put server data directly in context — use hooks for that

---

## backend.md — Content Spec

### 1. Stack
Supabase (PostgreSQL + Auth + Storage), `@supabase/supabase-js` v2.  
Single client instance from `src/lib/supabase.ts`.

### 2. Supabase Setup
- Client initialized once with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Never create a new client inline — always import from `lib/supabase.ts`
- Database types generated and kept in `src/lib/database.types.ts`

### 3. Repository Pattern
Every entity gets its own repository extending `BaseRepository`. Repositories handle data access only — no business logic.

```
src/repositories/
  base/              # BaseRepository, DatabaseAdapter, SupabaseAdapter, IRepository
  ProductRepository.ts
  CustomerRepository.ts
  # one file per entity
```

- Repositories accept a `DatabaseAdapter` in their constructor (enables testability)
- Complex queries go in the specific repository as named methods
- Never write raw Supabase queries outside of repository files

### 4. Service Layer
- Services wrap one or more repositories
- All business logic lives in services
- Use `logger` for every operation: `logger.info` on start, `logger.performance` on success, `logger.error` on failure
- Services throw user-friendly error messages — never surface raw Supabase errors
- Services are instantiated once and exported from `src/services/index.ts`

### 5. Database Migrations
- All schema changes in `supabase/migrations/` as timestamped `.sql` files
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Never mutate the database directly from application code
- Each migration is self-contained and idempotent where possible

### 6. Auth Pattern
- Auth state lives in `AuthContext` (`src/contexts/AuthContext.tsx`)
- Protected routes check `AuthContext`
- Never call `supabase.auth` outside of `AuthContext` or login/signup components
- On sign-out, always clear local session regardless of server response

---

## Implementation Steps

1. Create `.claude/skills/` directory in project root
2. Write `frontend.md` skill file
3. Write `backend.md` skill file
4. Follow the `writing-skills` skill to apply correct frontmatter and registration
5. Test each skill by invoking `/frontend` and `/backend`
6. Commit to git
