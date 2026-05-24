---
name: backend
description: Use when building or modifying repositories, services, database migrations, or auth in a React + Supabase project
---

# Backend Conventions

Rigid skill — follow exactly. Auto-trigger when working on repositories, services, migrations, or auth.

## Stack

Supabase (PostgreSQL + Auth + Storage) + `@supabase/supabase-js` v2.

**Hard rules:**
- Single Supabase client instance — always import from `src/lib/supabase.ts`
- Never create a new client inline
- Database types live in `src/lib/database.types.ts` — regenerate after schema changes

## Supabase Client Setup

```ts
// src/lib/supabase.ts — the only place this is created
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Repository Pattern

Every entity gets its own repository extending `BaseRepository`. Repositories handle **data access only** — no business logic.

```
src/repositories/
  base/              # BaseRepository, DatabaseAdapter, SupabaseAdapter, IRepository
  ProductRepository.ts
  CustomerRepository.ts
  # one file per entity
```

```ts
export class ProductRepository extends BaseRepository<Product> {
  constructor(adapter: DatabaseAdapter) {
    super(adapter, 'products');
  }

  // Complex queries as named methods — never raw Supabase outside repository files
  async findAllWithStock(): Promise<ProductWithStock[]> { ... }
}
```

**Rules:**
- Repositories accept `DatabaseAdapter` in constructor (enables testing)
- Complex queries are named methods on the specific repository
- Never write raw Supabase queries outside repository files
- No `console.log` — use `logger`

## Service Layer

Services wrap repositories and contain all business logic.

```ts
export class ProductService {
  constructor(private productRepo: ProductRepository) {}

  async getAllProducts(): Promise<ProductWithStock[]> {
    logger.info('Fetching all products');
    const start = Date.now();
    try {
      const result = await this.productRepo.findAllWithStock();
      logger.performance('getAllProducts', Date.now() - start, { count: result.length });
      return result;
    } catch (error) {
      logger.error('Failed to fetch products', error as Error);
      throw new Error('Unable to load products. Please try again.'); // User-friendly message
    }
  }
}
```

**Rules:**
- `logger.info` at the start of every operation
- `logger.performance` on success (include relevant counts/sizes)
- `logger.error` on failure
- Throw user-friendly error messages — never surface raw Supabase errors
- Services instantiated once, exported from `src/services/index.ts`

## Database Migrations

All schema changes go through migration files — never mutate the DB directly from app code.

```
supabase/migrations/
  YYYYMMDDHHMMSS_description.sql   # e.g. 20260101000000_create_products.sql
```

**Rules:**
- One migration per logical change
- Each migration is self-contained
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotency where possible
- Never modify a previously deployed migration — add a new one

## Auth Pattern

```
src/contexts/AuthContext.tsx   # owns all auth state
src/components/Login.tsx       # only other place supabase.auth is called
src/components/Signup.tsx      # only other place supabase.auth is called
```

**Rules:**
- Auth state lives in `AuthContext` — never manage auth state in components
- Protected routes read from `AuthContext`
- `supabase.auth` calls only inside `AuthContext`, `Login.tsx`, or `Signup.tsx`
- On sign-out, always clear local session regardless of server response (handles network errors)
- Never store tokens or session data in `localStorage` manually — let Supabase client manage it
