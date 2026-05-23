import { useState } from 'react';
import { Plus } from 'lucide-react';
import { VariantWithStock, Product } from '../../types';
import { VariantForm } from './VariantForm';

interface VariantGridProps {
  product: Product;
  variants: VariantWithStock[];
  onAddVariant: (data: {
    size: string | null;
    color: string | null;
    sku: string;
    barcode: string | null;
    reorder_level: number;
  }) => Promise<void>;
  onUpdateVariant: (id: string, data: { size?: string | null; color?: string | null; active?: boolean }) => Promise<void>;
}

export function VariantGrid({ product, variants, onAddVariant }: VariantGridProps) {
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (data: Parameters<typeof onAddVariant>[0]) => {
    await onAddVariant(data);
    setShowForm(false);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Variants ({variants.length})</h4>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Variant
        </button>
      </div>

      {showForm && (
        <VariantForm
          productId={product.id}
          productSku={product.sku}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {variants.length === 0 && !showForm && (
        <p className="text-xs text-slate-400 italic">No variants yet. Add a size/color combination to start tracking stock.</p>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-3 py-2 text-left">Size</th>
                <th className="px-3 py-2 text-left">Color</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2 text-right">Reorder At</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id} className={`border-t border-slate-100 ${!v.active ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2">{v.size || '—'}</td>
                  <td className="px-3 py-2">{v.color || '—'}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{v.sku}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${v.total_stock <= v.reorder_level ? 'text-red-600' : 'text-slate-800'}`}>
                    {v.total_stock}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{v.reorder_level}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${v.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {v.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
