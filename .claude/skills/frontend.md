---
name: frontend
description: Use when building or modifying React components, hooks, contexts, Tailwind styles, or any UI in a React + TypeScript + Tailwind + Supabase project
---

# Frontend Conventions

Rigid skill — follow exactly. Auto-trigger when working on components, hooks, contexts, or UI changes.

## Stack

React 18 + TypeScript + Vite + Tailwind CSS + Lucide React (icons) + Recharts (charts).

**Hard rules:**
- No class components
- No `any` types — use proper TypeScript types from `src/types/`
- No inline styles — Tailwind only

## File Organization

```
src/
  components/    # UI rendering only — no data fetching
  hooks/         # Data + state logic (wrap services)
  contexts/      # App-wide state only (auth, toasts)
  services/      # Business logic (imported by hooks)
  types/         # Shared TypeScript interfaces/types
  utils/         # Pure helper functions
```

**Rules:**
- Components never import from `repositories/` or `lib/supabase.ts` directly
- One non-trivial component per file
- Sub-components of a feature go in `components/<feature>/` subfolder

## Component Conventions

```tsx
// Named export, props typed with interface
interface ProductCardProps {
  product: ProductWithStock;
  onSelect: (id: string) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  // Only rendering + hook calls — no business logic here
}
```

- Named exports (no `export default`)
- Props defined with `interface`, not `type`
- No logic beyond rendering and calling hooks

## Tailwind Design System

Use **only** these project color tokens — never hardcode hex values in JSX:

| Token | Use |
|---|---|
| `accent` | Primary brand green — buttons, active states |
| `accent-soft` | Light green background — highlights, badges |
| `accent-ink` | Dark green — high-emphasis text on light backgrounds |
| `canvas` | Page background |
| `panel` | Card / surface background |
| `panel-2` | Secondary card background |

Typography:
- `font-sans` (Inter) — all UI text
- `font-mono` (JetBrains Mono) — codes, SKUs, barcodes, numbers

## Custom Hooks Pattern

```ts
export function useProducts() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import from services/ — never call Supabase directly in hooks
  const load = useCallback(async () => {
    setLoading(true);
    try {
      return await productService.getAllProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, load };
}
```

**Rules:**
- Always expose `loading` and `error`
- Return plain objects, not arrays (unless the hook IS a list)
- No business logic — delegate to service layer
- Never import from `repositories/` or `lib/supabase.ts`

## Mobile-Responsive Patterns

- Mobile-first — base styles target mobile, `md:` overrides for desktop
- `md:` is the primary desktop breakpoint
- Hide desktop-only features on mobile: `hidden md:block`
- Test at 375px (mobile) and 1280px (desktop) before marking complete
- Avoid fixed pixel widths — use `w-full`, `max-w-*`, `flex-1`

## Context Pattern

Context is for **truly global** state only:

| Use context | Use hook instead |
|---|---|
| Auth session (`AuthContext`) | Feature data (products, sales) |
| Toast notifications (`ToastContext`) | Page-level loading state |
| — | Form state |

- Never put server data directly in context
- Never fetch inside a context provider — fetch in hooks, pass via context only if truly global
