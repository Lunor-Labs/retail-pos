import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { Plus, Eye, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { returnService, salesService, customerService } from '../services';
import { Modal, SearchBar, LoadingSpinner, EmptyState } from './ui';

type Return = Database['public']['Tables']['returns']['Row'];
type ReturnItem = Database['public']['Tables']['return_items']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Customer = Database['public']['Tables']['customers']['Row'];

interface ReturnWithDetails extends Return {
  customer: Customer | null;
  sale: Sale | null;
  items: (ReturnItem & { product: Product | null })[];
}

export function Returns() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  // const isAdmin = profile?.role === 'admin'; // Unused currently
  const [returns, setReturns] = useState<ReturnWithDetails[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view'>('add');
  const [selectedReturn, setSelectedReturn] = useState<ReturnWithDetails | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnItems, setReturnItems] = useState<{ [key: string]: number }>({});
  const [isAutoApproved, setIsAutoApproved] = useState(true);
  const [formData, setFormData] = useState({
    sale_id: '',
    customer_id: '',
    refund_method: 'cash' as 'cash' | 'credit_note' | 'exchange',
    reason: '',
    total_amount: 0,
  });

  useEffect(() => {
    if (formData.sale_id) {
      loadSaleItems(formData.sale_id);
    } else {
      setSaleItems([]);
      setReturnItems({});
    }
  }, [formData.sale_id]);

  async function loadSaleItems(saleId: string) {
    try {
      const items = await salesService.getSaleItems(saleId);
      setSaleItems(items);
      // Reset return quantities
      const initialQuantities: { [key: string]: number } = {};
      items.forEach((item: any) => {
        initialQuantities[item.id] = 0;
      });
      setReturnItems(initialQuantities);
    } catch (error) {
      console.error('Error loading sale items:', error);
      showToast('Failed to load sale items', 'error');
    }
  }

  function handleReturnQuantityChange(saleItemId: string, quantity: number) {
    const updatedReturnItems = { ...returnItems, [saleItemId]: quantity };
    setReturnItems(updatedReturnItems);

    // Calculate total amount based on returned items
    let total = 0;
    Object.entries(updatedReturnItems).forEach(([id, qty]) => {
      const item = saleItems.find(si => si.id === id);
      if (item && qty > 0) {
        total += item.unit_price * qty;
      }
    });
    setFormData(prev => ({ ...prev, total_amount: total }));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [returnsData, salesData, customersData] = await Promise.all([
        returnService.getAllReturns(),
        salesService.getRecentSales(100),
        customerService.getAllCustomers(),
      ]);

      setReturns(returnsData as ReturnWithDetails[]);
      setSales(salesData as unknown as Sale[]);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast('Failed to load returns data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (!profile?.id) throw new Error('User not authenticated');

      // Map return items for service
      const itemsToReturn = Object.entries(returnItems)
        .filter(([_, qty]) => qty > 0)
        .map(([saleItemId, qty]) => {
          const saleItem = saleItems.find(si => si.id === saleItemId);
          return {
            product_id: saleItem.product_id,
            variant_id: saleItem.variant_id || null,
            batch_id: saleItem.batch_id,
            quantity: qty,
            subtotal: saleItem.unit_price * qty,
            unit_price: saleItem.unit_price,
            sale_item_id: saleItem.id
          };
        });

      const returnData = await returnService.createReturn(profile.id, {
        sale_id: formData.sale_id || null,
        customer_id: formData.customer_id || null,
        total_amount: formData.total_amount,
        refund_method: formData.refund_method || 'cash',
        reason: formData.reason || '',
        items: itemsToReturn,
        status: isAutoApproved ? 'approved' : 'pending'
      } as any);

      showToast(`Return created successfully!\nReturn Number: ${returnData.return_number}`, 'success');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Failed to create return', 'error');
    }
  }

  function resetForm() {
    setFormData({
      sale_id: '',
      customer_id: '',
      refund_method: 'cash',
      reason: '',
      total_amount: 0,
    });
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openViewModal(ret: ReturnWithDetails) {
    setSelectedReturn(ret);
    setModalMode('view');
    setShowModal(true);
  }

  const filteredReturns = returns.filter((ret) =>
    ret.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ret.customer?.name && ret.customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <LoadingSpinner message="Loading returns..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Returns</h2>
          <p className="text-slate-600 mt-1">Manage product returns and refunds</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Return
        </button>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search returns by number or customer..."
      />

      {filteredReturns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No returns found"
          description={searchTerm ? `No returns match "${searchTerm}"` : "You haven't recorded any product returns yet."}
          action={!searchTerm ? { label: 'Record Your First Return', onClick: openAddModal } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sale</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{ret.return_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {ret.sale?.sale_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(ret.return_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {ret.customer?.name || 'Walk-in'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">
                      LKR {ret.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {(ret.refund_method || 'cash').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openViewModal(ret)}
                        className="text-slate-600 hover:text-slate-900 transition p-1"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'New Return' : 'Return Details'}
        size="2xl"
      >
        {modalMode === 'view' && selectedReturn ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6 text-left">
              <div>
                <p className="text-sm text-slate-500">Return Number</p>
                <p className="font-medium text-slate-900">{selectedReturn.return_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Sale Number</p>
                <p className="font-medium text-slate-900">{selectedReturn.sale?.sale_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="font-medium text-slate-900">{selectedReturn.customer?.name || 'Walk-in'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Date</p>
                <p className="font-medium text-slate-900">
                  {new Date(selectedReturn.return_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="font-medium text-slate-900 capitalize">{selectedReturn.status}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Refund Method</p>
                <p className="font-medium text-slate-900 capitalize">{(selectedReturn.refund_method || 'cash').replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="font-medium text-slate-900 font-bold">LKR {selectedReturn.total_amount.toFixed(2)}</p>
              </div>
              {selectedReturn.reason && (
                <div className="col-span-2 text-left">
                  <p className="text-sm text-slate-500">Reason</p>
                  <p className="font-medium text-slate-900">{selectedReturn.reason}</p>
                </div>
              )}
            </div>

            {selectedReturn.items.length > 0 && (
              <>
                <h4 className="font-bold text-slate-900 mb-3 text-left">Items</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">Quantity</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedReturn.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2 text-sm text-slate-900 text-left">{item.product?.name || 'Unknown Item'}</td>
                          <td className="px-4 py-2 text-sm text-slate-600 text-center">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-slate-600 text-right">LKR {item.unit_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900 text-right">
                            LKR {item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 text-left">
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Related Sale (Optional)
                </label>
                <select
                  value={formData.sale_id}
                  onChange={(e) => setFormData({ ...formData, sale_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                >
                  <option value="">No related sale</option>
                  {sales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.sale_number} - LKR {sale.total_amount.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {saleItems.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Select Items to Return</h4>
                  <div className="space-y-3">
                    {saleItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 p-2 bg-white rounded border border-slate-200">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.product?.name}</p>
                          {item.variant && (
                            <p className="text-xs text-blue-600 font-medium">
                              {[item.variant.color, item.variant.size].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            Purchased: {item.quantity} @ LKR {item.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">Return Qty:</label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={returnItems[item.id] || 0}
                            onChange={(e) => handleReturnQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer (Optional)
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Return Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Refund Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.refund_method}
                  onChange={(e) => setFormData({ ...formData, refund_method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="credit_note">Credit Note</option>
                  <option value="exchange">Exchange</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  placeholder="Reason for return..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto_approve"
                  checked={isAutoApproved}
                  onChange={(e) => setIsAutoApproved(e.target.checked)}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                />
                <label htmlFor="auto_approve" className="text-sm font-medium text-slate-700">
                  Approve immediately and restore stock
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
              >
                Create Return
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
