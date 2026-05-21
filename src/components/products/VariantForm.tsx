import { useState } from 'react';
import { ProductVariant } from '../../types';

interface VariantFormProps {
  productId: string;
  productSku: string;
  onSave: (data: {
    size: string | null;
    color: string | null;
    sku: string;
    barcode: string | null;
    reorder_level: number;
  }) => Promise<void>;
  onCancel: () => void;
  initial?: Partial<ProductVariant>;
}

export function VariantForm({ productSku, onSave, onCancel, initial }: VariantFormProps) {
  const [size, setSize] = useState(initial?.size || '');
  const [color, setColor] = useState(initial?.color || '');
  const [sku, setSku] = useState(initial?.sku || `${productSku}-${Date.now()}`);
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [reorderLevel, setReorderLevel] = useState(initial?.reorder_level ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) { setError('SKU is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        size: size.trim() || null,
        color: color.trim() || null,
        sku: sku.trim(),
        barcode: barcode.trim() || null,
        reorder_level: reorderLevel,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save variant.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Size</label>
          <input value={size} onChange={e => setSize(e.target.value)} placeholder="S / M / L / UK 7 / 44in"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
          <input value={color} onChange={e => setColor(e.target.value)} placeholder="Red / Black Frame"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">SKU *</label>
          <input value={sku} onChange={e => setSku(e.target.value)} required
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Barcode</label>
          <input value={barcode} onChange={e => setBarcode(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reorder Level</label>
          <input type="number" min={0} value={reorderLevel} onChange={e => setReorderLevel(Number(e.target.value))}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Variant'}
        </button>
      </div>
    </form>
  );
}
