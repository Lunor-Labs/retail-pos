import { useState, useEffect } from 'react';
import { ProductWithStock } from '../../types';
import { ProductImage } from '../ProductImage';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { SupplierForm } from '../suppliers/SupplierForm';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supplierService, productService } from '../../services';
import { Modal } from '../ui';

interface ProductDetailsViewProps {
  product: ProductWithStock;
  onClose: () => void;
  onUpdate?: () => void;
  defaultShowAddStock?: boolean;
}

export function ProductDetailsView({ product, onClose, onUpdate, defaultShowAddStock = false }: ProductDetailsViewProps) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isAdmin = profile?.role === 'admin';
  const [showAddStock, setShowAddStock] = useState(defaultShowAddStock);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    supplier_id: '',
    quantity: 0,
    cost_price: 0,
    markup_percentage: 0,
    selling_price: 0,
  });

  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editBatchData, setEditBatchData] = useState({
    current_quantity: 0,
    cost_price: 0,
    markup_percentage: 0,
    selling_price: 0,
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      const data = await supplierService.getActiveSuppliers();
      setSuppliers(data || []);
    } catch (error) {
      console.error('Failed to load suppliers', error);
    }
  }

  const handleQuickAddSupplier = async (data: any) => {
    try {
      const newSupplier = await supplierService.createSupplier({
        name: data.name,
        contact_person: data.contact_person || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      });

      await loadSuppliers();
      setStockFormData({ ...stockFormData, supplier_id: newSupplier.id });
      setShowQuickAddSupplier(false);
      showToast('Supplier added successfully!', 'success');
    } catch (error: any) {
      showToast('Error adding supplier: ' + error.message, 'error');
    }
  };

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    try {
      const batchNumber = `ADD-${product.sku}-${new Date().getTime().toString().slice(-4)}`;
      await productService.createBatch({
        product_id: product.id,
        batch_number: batchNumber,
        supplier_id: stockFormData.supplier_id,
        cost_price: stockFormData.cost_price,
        markup_percentage: stockFormData.markup_percentage,
        selling_price: stockFormData.selling_price,
        initial_quantity: stockFormData.quantity,
        current_quantity: stockFormData.quantity,
        received_date: new Date().toISOString().split('T')[0],
      });

      showToast('Stock added successfully!', 'success');
      setShowAddStock(false);
      setStockFormData({
        supplier_id: '',
        quantity: 0,
        cost_price: 0,
        markup_percentage: 0,
        selling_price: 0,
      });
      if (onUpdate) onUpdate();
    } catch (error: any) {
      showToast(error.message || 'Failed to add stock', 'error');
    }
  }

  async function handleUpdateBatch(batchId: string) {
    try {
      await productService.updateBatch(batchId, {
        current_quantity: editBatchData.current_quantity,
        cost_price: editBatchData.cost_price,
        markup_percentage: editBatchData.markup_percentage,
        selling_price: editBatchData.selling_price,
      });
      showToast('Batch updated successfully!', 'success');
      setEditingBatchId(null);
      if (onUpdate) onUpdate();
    } catch (error: any) {
      showToast(error.message || 'Failed to update batch', 'error');
    }
  }

  return (
    <>
      <div className="p-6">
        {product.image_url && (
          <div className="mb-6 flex justify-center">
            <ProductImage
              imageUrl={product.image_url}
              alt={product.name}
              size="xl"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-slate-500">Product Name</p>
            <p className="font-medium text-slate-900">{product.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">SKU</p>
            <p className="font-medium text-slate-900">{product.sku}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Brand</p>
            <p className="font-medium text-slate-900">{(product as any).brand || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Category</p>
            <p className="font-medium text-slate-900">{product.category || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Stock</p>
            <p className="font-medium text-slate-900 font-bold text-lg text-emerald-600">{product.total_stock}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Unit</p>
            <p className="font-medium text-slate-900">{product.unit}</p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-900">Stock Batches ({product.batches.length})</h4>
            <button
              onClick={() => setShowAddStock(!showAddStock)}
              className="flex items-center gap-1 text-sm font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
            >
              <Plus className="w-4 h-4" />
              {showAddStock ? 'Cancel' : 'Add Stock'}
            </button>
          </div>

          {showAddStock && (
            <form onSubmit={handleAddStock} className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={stockFormData.supplier_id}
                      onChange={(e) => setStockFormData({ ...stockFormData, supplier_id: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={stockFormData.quantity || ''}
                    onChange={(e) => setStockFormData({ ...stockFormData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cost (LKR)</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={stockFormData.cost_price || ''}
                    onChange={(e) => {
                      const cost = parseFloat(e.target.value) || 0;
                      const markup = stockFormData.markup_percentage || 0;
                      const selling = cost * (1 + markup / 100);
                      setStockFormData({ ...stockFormData, cost_price: cost, selling_price: parseFloat(selling.toFixed(2)) });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Markup (%)</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={stockFormData.markup_percentage || ''}
                    onChange={(e) => {
                      const markup = parseFloat(e.target.value) || 0;
                      const cost = stockFormData.cost_price || 0;
                      const selling = cost * (1 + markup / 100);
                      setStockFormData({ ...stockFormData, markup_percentage: markup, selling_price: parseFloat(selling.toFixed(2)) });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Selling (LKR)</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={stockFormData.selling_price || ''}
                    onChange={(e) => {
                      const selling = parseFloat(e.target.value) || 0;
                      const cost = stockFormData.cost_price || 0;
                      const markup = cost > 0 ? ((selling - cost) / cost) * 100 : 0;
                      setStockFormData({ ...stockFormData, selling_price: selling, markup_percentage: parseFloat(markup.toFixed(2)) });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition"
                  >
                    Confirm Stock Intake
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {product.batches.map((batch) => {
              const isEditing = editingBatchId === batch.id;
              
              return (
                <div key={batch.id} className="bg-slate-50 p-4 rounded-lg relative">
                  {isAdmin && !isEditing && (
                    <button
                      onClick={() => {
                        setEditingBatchId(batch.id);
                        setEditBatchData({
                          current_quantity: batch.current_quantity,
                          cost_price: batch.cost_price,
                          markup_percentage: batch.markup_percentage,
                          selling_price: batch.selling_price,
                        });
                      }}
                      className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition"
                      title="Edit Batch"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-slate-900">Edit Batch: {batch.batch_number}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingBatchId(null)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateBatch(batch.id)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                            title="Save Changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0"
                            value={editBatchData.current_quantity}
                            onChange={(e) => setEditBatchData({ ...editBatchData, current_quantity: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Cost (LKR)</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editBatchData.cost_price}
                            onChange={(e) => {
                              const cost = parseFloat(e.target.value) || 0;
                              const markup = editBatchData.markup_percentage || 0;
                              const selling = cost * (1 + markup / 100);
                              setEditBatchData({ ...editBatchData, cost_price: cost, selling_price: parseFloat(selling.toFixed(2)) });
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Markup (%)</label>
                          <input
                            type="number"
                            step="any"
                            value={editBatchData.markup_percentage}
                            onChange={(e) => {
                              const markup = parseFloat(e.target.value) || 0;
                              const cost = editBatchData.cost_price || 0;
                              const selling = cost * (1 + markup / 100);
                              setEditBatchData({ ...editBatchData, markup_percentage: markup, selling_price: parseFloat(selling.toFixed(2)) });
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Selling (LKR)</label>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editBatchData.selling_price}
                            onChange={(e) => {
                              const selling = parseFloat(e.target.value) || 0;
                              const cost = editBatchData.cost_price || 0;
                              const markup = cost > 0 ? ((selling - cost) / cost) * 100 : 0;
                              setEditBatchData({ ...editBatchData, selling_price: selling, markup_percentage: parseFloat(markup.toFixed(2)) });
                            }}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start mb-2 pr-8">
                      <div>
                        <p className="font-medium text-slate-900">Batch: {batch.batch_number}</p>
                        <p className="text-sm text-slate-500">
                          Received: {new Date(batch.received_date).toLocaleDateString()}
                        </p>
                        {batch.supplier && (
                          <p className="text-sm text-slate-500">
                            Supplier: {batch.supplier.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900">{batch.current_quantity} units</p>
                        {isAdmin && (
                          <p className="text-xs text-slate-500">
                            Cost: LKR {batch.cost_price.toFixed(2)} ({batch.markup_percentage || 0}%)
                          </p>
                        )}
                        <p className="text-sm font-bold text-slate-900">
                          LKR {batch.selling_price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {product.batches.length === 0 && !showAddStock && (
              <p className="text-slate-500 text-center py-4">No batches available</p>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>

      <Modal
        isOpen={showQuickAddSupplier}
        onClose={() => setShowQuickAddSupplier(false)}
        title="Quick Add Supplier"
        size="2xl"
      >
        <SupplierForm
          mode="add"
          onSubmit={handleQuickAddSupplier}
          onCancel={() => setShowQuickAddSupplier(false)}
        />
      </Modal>
    </>
  );
}
