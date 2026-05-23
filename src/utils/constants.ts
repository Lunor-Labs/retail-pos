export const PRODUCT_UNITS = [
  { value: 'piece', label: 'Piece' },
  { value: 'yard', label: 'Yard' },
  { value: 'meter', label: 'Meter' },
  { value: 'pack', label: 'Pack' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
] as const;

export const STOCK_STATUS = {
  LOW: 'low',
  MEDIUM: 'medium',
  GOOD: 'good',
} as const;

export function getStockStatus(currentStock: number, reorderLevel: number) {
  if (currentStock <= reorderLevel) return STOCK_STATUS.LOW;
  if (currentStock <= reorderLevel * 2) return STOCK_STATUS.MEDIUM;
  return STOCK_STATUS.GOOD;
}

export function getStockStatusColor(status: string) {
  switch (status) {
    case STOCK_STATUS.LOW:
      return 'bg-red-100 text-red-800';
    case STOCK_STATUS.MEDIUM:
      return 'bg-yellow-100 text-yellow-800';
    case STOCK_STATUS.GOOD:
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}
