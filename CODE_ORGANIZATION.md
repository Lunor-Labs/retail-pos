# Code Organization Guide

This document explains how the codebase is organized to ensure maintainability and follow best practices.

## Directory Structure

```
src/
├── components/           # React components
│   ├── products/        # Product-related sub-components
│   ├── pos/            # POS-related sub-components
│   ├── ProductImage.tsx # Reusable image component
│   └── ...             # Other feature components
├── hooks/              # Custom React hooks
│   ├── useProducts.ts  # Hook for fetching products
│   └── useCustomers.ts # Hook for fetching customers
├── types/              # Shared TypeScript types
│   └── index.ts        # Common type definitions
├── utils/              # Utility functions
│   ├── formatters.ts   # Formatting utilities (currency, dates)
│   └── constants.ts    # Application constants
├── contexts/           # React contexts
└── lib/               # External library configurations
```

## Key Principles

### 1. Component Organization

**Large components are broken down into smaller, focused sub-components:**

- `Products.tsx` uses:
  - `ProductForm.tsx` - Handles add/edit forms
  - `ProductTable.tsx` - Displays product list
  - `ProductDetailsView.tsx` - Shows product details

- `POS.tsx` uses:
  - `ProductSearchList.tsx` - Product search results
  - `CartItemsList.tsx` - Shopping cart display

**Benefits:**
- Easier to test individual components
- Better code reusability
- Improved readability
- Simpler debugging

### 2. Custom Hooks

Data fetching logic is extracted into custom hooks:

```typescript
// Instead of duplicating fetch logic:
const { products, loading, error, refetch } = useProducts();
```

**Available hooks:**
- `useProducts()` - Fetch products with stock information
- `useCustomers()` - Fetch customer data

**Benefits:**
- Consistent data fetching patterns
- Reduced code duplication
- Easier to add caching or other features

### 3. Shared Types

All database types and common interfaces are defined in `src/types/index.ts`:

```typescript
import { Product, Customer, CartItem } from '../types';
```

**Benefits:**
- Single source of truth for types
- Easier refactoring
- Better type safety

### 4. Reusable Components

Common UI patterns are extracted into reusable components:

- `ProductImage` - Displays product images with fallback
  - Supports multiple sizes (sm, md, lg, xl)
  - Handles image loading errors gracefully
  - Consistent styling across the app

### 5. Utility Functions

Common operations are centralized:

**Formatters** (`utils/formatters.ts`):
- `formatCurrency(amount)` - Format currency values
- `formatDate(date)` - Format dates consistently
- `formatDateTime(date)` - Format date and time

**Constants** (`utils/constants.ts`):
- `PRODUCT_UNITS` - Available product units
- `PAYMENT_METHODS` - Payment method options
- Stock status helpers

## Best Practices

### When Adding New Features

1. **Create focused components** - Each component should have a single responsibility
2. **Extract reusable logic** - If code is used in multiple places, extract it
3. **Use custom hooks** - For data fetching and complex state logic
4. **Define types** - Add new types to `src/types/index.ts`
5. **Document complex logic** - Add comments for non-obvious code

### When Modifying Existing Code

1. **Check for reusable components** - Use existing components before creating new ones
2. **Update types** - Keep type definitions in sync with database schema
3. **Test thoroughly** - Ensure changes don't break existing functionality
4. **Follow existing patterns** - Maintain consistency with the codebase

### File Size Guidelines

- Keep components under 300 lines when possible
- If a component grows too large, identify sub-components to extract
- Each file should have a clear, single purpose

## Common Patterns

### Data Fetching

```typescript
const { data, loading, error, refetch } = useCustomHook();

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
```

### Form Handling

```typescript
const [formData, setFormData] = useState<FormType>(initialState);

function handleChange(updates: Partial<FormType>) {
  setFormData({ ...formData, ...updates });
}
```

### Modal Display

```typescript
const [showModal, setShowModal] = useState(false);
const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('view');
```

## Maintenance Checklist

- [ ] Components are focused and under 300 lines
- [ ] No duplicate code across components
- [ ] Types are defined in `src/types/`
- [ ] Custom hooks for repeated data fetching
- [ ] Utility functions for common operations
- [ ] Consistent naming conventions
- [ ] Proper error handling
- [ ] Loading states for async operations

## Migration Notes

The following files have been refactored:

- `Products.tsx` - Now uses sub-components and custom hooks
- Old version backed up as `Products.old.tsx` (can be removed after verification)

Future refactoring candidates:
- `POS.tsx` - Can use more sub-components
- Other large components in the codebase
