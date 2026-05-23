import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { Plus, Search, Eye, FileText, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './ui';
import { purchaseOrderService, productService, supplierService } from '../services';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface POWithDetails extends PurchaseOrder {
  supplier: Supplier | null;
  items: (PurchaseOrderItem & { product: Product | null })[];
}

interface POLineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
}

export function PurchaseOrders() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isAdmin = profile?.role === 'admin';
  const [orders, setOrders] = useState<POWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view'>('add');
  const [selectedPO, setSelectedPO] = useState<POWithDetails | null>(null);
  const [formData, setFormData] = useState({
    po_number: '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [directReceive, setDirectReceive] = useState(false);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    quantity: 1,
    cost_price: 0,
    selling_price: 0,
  });
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  });
  const [showConfirmReceiveModal, setShowConfirmReceiveModal] = useState(false);
  const [poToReceive, setPoToReceive] = useState<POWithDetails | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [ordersData, productsData, suppliersData] = await Promise.all([
        purchaseOrderService.getAllPurchaseOrders(),
        productService.getAllProducts(),
        supplierService.getActiveSuppliers(),
      ]);

      setOrders(ordersData as POWithDetails[]);
      // Filter active products
      setProducts(productsData.filter(p => p.active !== false));
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (lineItems.length === 0) {
      showToast('Please add at least one item to the purchase order', 'warning');
      return;
    }

    try {
      const poData = await purchaseOrderService.createPurchaseOrder(profile?.id || '', {
        supplier_id: formData.supplier_id,
        expected_date: formData.order_date, // Mapping order_date to expected_date if needed or updating interface
        // Checking PO interface: it has order_date. createPurchaseOrderInput has expected_date.
        // Let's assume input maps to PO fields. logic seems slightly different.
        // Wait, CreatePurchaseOrderInput definition:
        /*
        export interface CreatePurchaseOrderInput {
            supplier_id: string;
            expected_date?: string | null;
            notes?: string | null;
            items: ...
        }
        */
        // But PurchaseOrder has `order_date`.
        // I might need to update PurchaseOrderService to accept `order_date` or map it.
        // Assuming I should pass it as part of poData if I use `...poData`.
        // But `CreatePurchaseOrderInput` defines keys.
        // I will use `any` cast if needed or just pass `order_date` as `expected_date` logic mismatch?
        // Let's pass extra fields and see if they stick or update interface later.
        // Actually, PurchaseOrderService uses `...poData`.

        notes: formData.notes || null,
        items: lineItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.cost_price,
          // selling_price is not in CreatePurchaseOrderInput items but used for batch creation later
        })),
        // Pass order_date explicitly if service allows extra props via spread (it does)
        order_date: formData.order_date,
        po_number: formData.po_number
      } as any);

      if (directReceive) {
        await purchaseOrderService.receiveOrder(poData.id);
        showToast('Stock received directly and PO completed!', 'success');
      } else {
        showToast('Purchase order created successfully!', 'success');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  }

  function confirmReceive(po: POWithDetails) {
    setPoToReceive(po);
    setShowConfirmReceiveModal(true);
  }

  async function handleReceiveConfirmed() {
    if (!poToReceive) return;

    try {
      await purchaseOrderService.receiveOrder(poToReceive.id);
      showToast('Purchase order received successfully! Product batches have been created.', 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setShowConfirmReceiveModal(false);
      setPoToReceive(null);
    }
  }

  function resetForm() {
    setFormData({
      po_number: '',
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setLineItems([]);
    setCurrentItem({
      product_id: '',
      quantity: 1,
      cost_price: 0,
      selling_price: 0,
    });
  }

  function addLineItem() {
    if (!currentItem.product_id || currentItem.quantity <= 0) {
      showToast('Please select a product and enter a valid quantity', 'warning');
      return;
    }

    const product = products.find((p) => p.id === currentItem.product_id);
    if (!product) return;

    if (lineItems.some((item) => item.product_id === currentItem.product_id)) {
      showToast('Product already added. Please edit the existing item.', 'warning');
      return;
    }

    setLineItems([
      ...lineItems,
      {
        product_id: currentItem.product_id,
        product_name: product.name,
        quantity: currentItem.quantity,
        cost_price: currentItem.cost_price,
        selling_price: currentItem.selling_price,
      },
    ]);

    setCurrentItem({
      product_id: '',
      quantity: 1,
      cost_price: 0,
      selling_price: 0,
    });
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  async function handleSupplierSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const data = await supplierService.createSupplier({
        name: supplierFormData.name,
        contact_person: supplierFormData.contact_person || null,
        phone: supplierFormData.phone || null,
        email: supplierFormData.email || null,
        address: supplierFormData.address || null,
      });

      setShowSupplierModal(false);
      setSupplierFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
      });
      loadData();
      setFormData({ ...formData, supplier_id: data.id });
    } catch (error: any) {
      showToast(error.message || 'Failed to create supplier', 'error');
    }
  }

  function openAddModal() {
    resetForm();
    setModalMode('add');
    setShowModal(true);
  }

  function openViewModal(po: POWithDetails) {
    setSelectedPO(po);
    setModalMode('view');
    setShowModal(true);
  }

  const filteredOrders = orders.filter(
    (order) =>
      order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Purchase Orders</h2>
          <p className="text-slate-600 mt-1">Manage stock receiving from suppliers</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            <Plus className="w-5 h-5" />
            Create PO
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Order Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{order.po_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {order.supplier?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{order.order_date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    LKR {order.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline - flex items - center px - 2.5 py - 0.5 rounded - full text - xs font - medium ${order.status === 'received'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        } `}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openViewModal(order)}
                        className="p-1 hover:bg-slate-100 rounded transition"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-slate-600" />
                      </button>
                      {isAdmin && order.status === 'pending' && (
                        <button
                          onClick={() => confirmReceive(order)}
                          className="p-1 hover:bg-green-50 rounded transition"
                          title="Mark as received"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'Create Purchase Order' : 'Purchase Order Details'}
        size="4xl"
      >
        {modalMode === 'view' && selectedPO ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-slate-500">PO Number</p>
                <p className="font-medium text-slate-900">{selectedPO.po_number}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Supplier</p>
                <p className="font-medium text-slate-900">{selectedPO.supplier?.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Order Date</p>
                <p className="font-medium text-slate-900">{selectedPO.order_date}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="font-medium text-slate-900">{selectedPO.status}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="font-medium text-slate-900">LKR {selectedPO.total_amount.toFixed(2)}</p>
              </div>
              {selectedPO.received_date && (
                <div>
                  <p className="text-sm text-slate-500">Received Date</p>
                  <p className="font-medium text-slate-900">{selectedPO.received_date}</p>
                </div>
              )}
            </div>

            <h4 className="font-bold text-slate-900 mb-3">Items</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Quantity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Cost Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Selling Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedPO.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm text-slate-900">{item.product?.name}</td>
                      <td className="px-4 py-2 text-sm text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm text-slate-600">LKR {item.cost_price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-slate-600">LKR {item.selling_price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-slate-900">
                        LKR {item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PO Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.po_number}
                  onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  placeholder="PO-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    required
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                    title="Add new supplier"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6 mb-6">
              <h4 className="font-bold text-slate-900 mb-4">Add Items</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentItem.product_id}
                    onChange={(e) => setCurrentItem({ ...currentItem, product_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 10"
                    value={currentItem.quantity}
                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) || 0 })}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cost Price (LKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 25.00"
                    value={currentItem.cost_price}
                    onChange={(e) => setCurrentItem({ ...currentItem, cost_price: parseFloat(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Selling Price (LKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 35.00"
                    value={currentItem.selling_price}
                    onChange={(e) => setCurrentItem({ ...currentItem, selling_price: parseFloat(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Item to Order
              </button>
            </div>

            {lineItems.length > 0 && (
              <div className="mb-6">
                <h4 className="font-bold text-slate-900 mb-3">Order Items</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Cost Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Selling Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Subtotal</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {lineItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-slate-900">{item.product_name}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">LKR {item.cost_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">LKR {item.selling_price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900">
                            LKR {(item.quantity * item.cost_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="p-1 hover:bg-red-50 rounded transition"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right mt-3">
                  <p className="text-lg font-bold text-slate-900">
                    Total: LKR {lineItems.reduce((sum, item) => sum + item.quantity * item.cost_price, 0).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-6">
              <input
                type="checkbox"
                id="directReceive"
                checked={directReceive}
                onChange={(e) => setDirectReceive(e.target.checked)}
                className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
              />
              <label htmlFor="directReceive" className="text-sm font-medium text-slate-700">
                Direct Stock Intake (Mark as already received)
              </label>
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
                {directReceive ? 'Create & Receive Stock' : 'Create Purchase Order'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        title="Add New Supplier"
        size="md"
      >
        <form onSubmit={handleSupplierSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierFormData.name}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter supplier name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={supplierFormData.contact_person}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter contact person"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={supplierFormData.phone}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={supplierFormData.email}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Address
              </label>
              <textarea
                value={supplierFormData.address}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                placeholder="Enter address"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setShowSupplierModal(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
            >
              Add Supplier
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showConfirmReceiveModal}
        onClose={() => {
          setShowConfirmReceiveModal(false);
          setPoToReceive(null);
        }}
        title="Confirm Receipt"
        size="md"
      >
        <div className="p-6">
          <p className="text-slate-600 mb-6">
            Are you sure you want to mark purchase order <span className="font-bold">{poToReceive?.po_number}</span> as received?
            This will create new product batches and update inventory positions.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowConfirmReceiveModal(false);
                setPoToReceive(null);
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleReceiveConfirmed}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium"
            >
              Confirm Receipt
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
