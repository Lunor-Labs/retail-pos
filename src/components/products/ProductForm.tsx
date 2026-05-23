import { useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PRODUCT_UNITS } from '../../utils/constants';
import { SupplierForm } from '../suppliers/SupplierForm';
import { useToast } from '../../contexts/ToastContext';

const CLOTHING_CATEGORIES = [
  'T-Shirts', 'Shirts', 'Pants', 'Dresses', 'Skirts',
  'Jackets', 'Shoes', 'Belts', 'Bags', 'Sunglasses',
  'Underwear', 'Socks', 'Fabric', 'Accessories', 'Other',
];

export interface ProductFormData {
  sku: string;
  name: string;
  description: string;
  category: string;
  brand?: string;
  gender?: string;
  material?: string;
  unit: string;
  image_url: string;
  initial_quantity?: number;
  cost_price?: number;
  markup_percentage?: number;
  selling_price?: number;
  supplier_id?: string;
}

interface ProductFormProps {
  formData: ProductFormData;
  onChange: (data: ProductFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  mode: 'add' | 'edit';
  scanningBarcode: boolean;
  onStartBarcodeScanning: () => void;
  suppliers: any[];
  onSupplierAdded: () => Promise<void>;
}

export function ProductForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  mode,
  suppliers,
  onSupplierAdded,
}: ProductFormProps) {
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const { showToast } = useToast();

  const handleQuickAddSupplier = async (data: any) => {
    try {
      const { data: newSupplier, error } = await (supabase.from('suppliers') as any)
        .insert({
          name: data.name,
          contact_person: data.contact_person || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      await onSupplierAdded();
      onChange({ ...formData, supplier_id: (newSupplier as any).id });
      setShowQuickAddSupplier(false);
    } catch (error: any) {
      showToast('Error adding supplier: ' + error.message, 'error');
    }
  };

  return (
    <>
      <form onSubmit={onSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              SKU <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => onChange({ ...formData, sku: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unit
            </label>
            <select
              value={formData.unit}
              onChange={(e) => onChange({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            >
              {PRODUCT_UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => onChange({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => onChange({ ...formData, image_url: e.target.value })}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />
            {formData.image_url && (
              <div className="mt-2">
                <img
                  src={formData.image_url}
                  alt="Product preview"
                  className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => onChange({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            >
              <option value="">Select category...</option>
              {CLOTHING_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
            <input
              type="text"
              value={formData.brand || ''}
              onChange={(e) => onChange({ ...formData, brand: e.target.value })}
              placeholder="e.g. Nike, Zara, H&M"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select
              value={formData.gender || ''}
              onChange={(e) => onChange({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            >
              <option value="">Select...</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="kids">Kids</option>
              <option value="unisex">Unisex</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
            <input
              type="text"
              value={formData.material || ''}
              onChange={(e) => onChange({ ...formData, material: e.target.value })}
              placeholder="e.g. Cotton, Polyester, Denim"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {mode === 'add' && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h4 className="text-lg font-bold text-slate-900 mb-4">Initial Stock Intake (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <div className="flex gap-2">
                  <select
                    value={formData.supplier_id || ''}
                    onChange={(e) => onChange({ ...formData, supplier_id: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddSupplier(true)}
                    className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
                    title="Add new supplier"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Quantity</label>
                <input
                  type="number"
                  value={formData.initial_quantity || ''}
                  onChange={(e) => onChange({ ...formData, initial_quantity: parseInt(e.target.value) || 0 })}
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price (LKR)</label>
                <input
                  type="number"
                  step="any"
                  value={formData.cost_price || ''}
                  onChange={(e) => {
                    const cost = parseFloat(e.target.value) || 0;
                    const markup = formData.markup_percentage || 0;
                    const selling = cost * (1 + markup / 100);
                    onChange({ ...formData, cost_price: cost, selling_price: parseFloat(selling.toFixed(2)) });
                  }}
                  min="0"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Markup (%)</label>
                <input
                  type="number"
                  step="any"
                  value={formData.markup_percentage || ''}
                  onChange={(e) => {
                    const markup = parseFloat(e.target.value) || 0;
                    const cost = formData.cost_price || 0;
                    const selling = cost * (1 + markup / 100);
                    onChange({ ...formData, markup_percentage: markup, selling_price: parseFloat(selling.toFixed(2)) });
                  }}
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (LKR)</label>
                <input
                  type="number"
                  step="any"
                  value={formData.selling_price || ''}
                  onChange={(e) => {
                    const selling = parseFloat(e.target.value) || 0;
                    const cost = formData.cost_price || 0;
                    const markup = cost > 0 ? ((selling - cost) / cost) * 100 : 0;
                    onChange({ ...formData, selling_price: selling, markup_percentage: parseFloat(markup.toFixed(2)) });
                  }}
                  min="0"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 italic">
              * Filling this section will automatically create the first stock batch for this product.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            {mode === 'add' ? 'Add Product' : 'Update Product'}
          </button>
        </div>
      </form>

      {showQuickAddSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 text-left">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Quick Add Supplier</h3>
            </div>
            <SupplierForm
              mode="add"
              onSubmit={handleQuickAddSupplier}
              onCancel={() => setShowQuickAddSupplier(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
