import { useState } from 'react';
import { X } from 'lucide-react';
import { Product, ProductVariant, ProductBatch, VariantWithStock } from '../../types';

interface VariantPickerProps {
  product: Product;
  variants: VariantWithStock[];
  onSelect: (variant: ProductVariant, batch: ProductBatch, quantity: number) => void;
  onClose: () => void;
}

export function VariantPicker({ product, variants, onSelect, onClose }: VariantPickerProps) {
  const [selectedVariant, setSelectedVariant] = useState<VariantWithStock | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const isDecimal = product.unit === 'yard' || product.unit === 'meter';
  const unitLabel = product.unit === 'yard' ? 'yd' : product.unit === 'meter' ? 'm' : product.unit === 'pack' ? 'pk' : 'pc';

  const activeVariants = variants.filter(v => v.active && v.total_stock > 0);

  const getActiveBatch = (variant: VariantWithStock): ProductBatch | null => {
    return variant.batches
      .filter(b => b.current_quantity > 0)
      .sort((a, b) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime())[0] || null;
  };

  const handleConfirm = () => {
    if (!selectedVariant) return;
    const batch = getActiveBatch(selectedVariant);
    if (!batch) return;
    if (quantity <= 0) return;
    onSelect(selectedVariant, batch, quantity);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">{product.name}</h3>
            <p className="text-xs text-slate-500">
              {(product as any).brand && `${(product as any).brand} · `}
              {product.category} · sold per {product.unit}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {activeVariants.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No stock available for any variant.</p>
          )}
          {activeVariants.map(v => {
            const batch = getActiveBatch(v);
            const isSelected = selectedVariant?.id === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span className="font-medium">
                  {[v.size, v.color].filter(Boolean).join(' · ') || v.sku}
                </span>
                <span className="text-xs text-slate-500">
                  {v.total_stock} {unitLabel} in stock
                  {batch && ` · LKR ${batch.selling_price.toLocaleString()}`}
                </span>
              </button>
            );
          })}
        </div>

        {selectedVariant && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Quantity ({unitLabel})</label>
              <input
                type="number"
                min={isDecimal ? 0.1 : 1}
                step={isDecimal ? 0.1 : 1}
                value={quantity}
                onChange={e => setQuantity(isDecimal ? parseFloat(e.target.value) : parseInt(e.target.value))}
                className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleConfirm}
              disabled={quantity <= 0}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Add to Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
