import { useState, useEffect } from 'react';
import { Database } from '../lib/database.types';
import { Invoice, InvoiceData } from './Invoice';
import { Eye, FileText, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { salesService } from '../services';
import { Modal, SearchBar, LoadingSpinner, EmptyState } from './ui';

type Sale = Database['public']['Tables']['sales']['Row'] & {
    cashier?: { full_name: string } | null;
    customer?: { name: string; phone: string } | null;
};

type SaleItem = Database['public']['Tables']['sale_items']['Row'] & {
    product?: { name: string; sku: string } | null;
    batch?: { batch_number: string } | null;
    warranty_duration?: number;
    warranty_unit?: 'days' | 'months' | 'years' | null;
    warranty_type?: string | null;
};

export function SalesHistory() {
    const { isAdmin } = useAuth();
    const { showToast } = useToast();
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], // Last 30 days
        end: new Date().toISOString().split('T')[0],
    });

    // Modal state
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [saleToDelete, setSaleToDelete] = useState<string | null>(null);

    // Invoice State
    const [showInvoice, setShowInvoice] = useState(false);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

    useEffect(() => {
        loadSales();
    }, [dateRange]);

    async function loadSales() {
        setLoading(true);
        try {
            const data = await salesService.getSales(
                `${dateRange.start}T00:00:00`,
                `${dateRange.end}T23:59:59`
            );

            setSales(data);
        } catch (error) {
            console.error('Error loading sales:', error);
            showToast('Failed to load sales history', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function openSaleDetails(sale: Sale) {
        setSelectedSale(sale);
        setShowModal(true);
        setLoadingItems(true);

        try {
            const data = await salesService.getSaleItems(sale.id);
            setSaleItems(data);
        } catch (error) {
            console.error('Error loading sale items:', error);
            showToast('Failed to load sale details', 'error');
        } finally {
            setLoadingItems(false);
        }
    }

    const filteredSales = sales.filter(sale =>
        sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.customer?.name && sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    async function confirmDeleteSale() {
        if (!saleToDelete) return;

        const saleId = saleToDelete;
        setShowDeleteConfirm(false);
        setDeletingId(saleId);

        try {
            await salesService.deleteSale(saleId);
            setSales(prev => prev.filter(s => s.id !== saleId));
            showToast('Sale deleted and stock restored successfully', 'success');
            await loadSales();
        } catch (error: any) {
            console.error('Error deleting sale:', error);
            showToast(error.message || 'Failed to delete sale', 'error');
        } finally {
            setDeletingId(null);
            setSaleToDelete(null);
        }
    }

    function handleDeleteClick(saleId: string) {
        setSaleToDelete(saleId);
        setShowDeleteConfirm(true);
    }

    function handleGenerateInvoice() {
        if (!selectedSale || !saleItems.length) return;

        const data: InvoiceData = {
            saleNumber: selectedSale.sale_number,
            date: new Date(selectedSale.sale_date).toLocaleDateString(),
            customerName: selectedSale.customer?.name || 'Walk-in Customer',
            customerPhone: selectedSale.customer?.phone || undefined,
            items: saleItems.map(item => ({
                name: item.product?.name || 'Unknown Item',
                quantity: item.quantity,
                unitPrice: item.unit_price,
                subtotal: item.subtotal,
                batchNumber: item.batch?.batch_number || '',
                warranty: item.warranty_duration && item.warranty_duration > 0 ? {
                    duration: item.warranty_duration,
                    unit: (item.warranty_unit as any) || 'months',
                    type: item.warranty_type || undefined
                } : undefined,
            })),
            subtotal: selectedSale.subtotal,
            discount: selectedSale.discount_amount,
            tax: selectedSale.tax_amount,
            total: selectedSale.total_amount,
            paidAmount: selectedSale.paid_amount,
            changeAmount: Math.max(0, selectedSale.paid_amount - selectedSale.total_amount),
            paymentMethod: selectedSale.payment_method || 'cash',
            cashierName: selectedSale.cashier?.full_name || 'System',
            serviceCharge: selectedSale.service_charge || 0,
        };

        setInvoiceData(data);
        setShowInvoice(true);
    }

    if (loading && sales.length === 0) {
        return <LoadingSpinner message="Loading sales history..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Sales History</h2>
                    <p className="text-slate-600 mt-1">View and manage past sales transactions</p>
                </div>
            </div>

            <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by receipt number or customer..."
            >
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 font-medium">From:</span>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 font-medium">To:</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                        />
                    </div>
                </div>
            </SearchBar>

            {filteredSales.length === 0 && !loading ? (
                <EmptyState
                    icon={Clock}
                    title="No sales found"
                    description={searchTerm ? `No sales match "${searchTerm}" in the selected date range.` : "No sales recorded for this period."}
                />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Receipt ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cashier</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredSales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {new Date(sale.sale_date).toLocaleDateString()} {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-slate-400" />
                                                <span className="font-medium text-slate-900">{sale.sale_number}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                            {sale.customer?.name || 'Walk-in Customer'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">
                                            LKR {sale.total_amount.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="capitalize text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                                                {sale.payment_method || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {sale.cashier?.full_name || 'System'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openSaleDetails(sale)}
                                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-600 hover:text-slate-900"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => handleDeleteClick(sale.id)}
                                                        disabled={deletingId === sale.id}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-600 hover:text-red-700 disabled:opacity-50"
                                                        title="Delete Sale"
                                                    >
                                                        {deletingId === sale.id ? (
                                                            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <Trash2 className="w-5 h-5" />
                                                        )}
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
            )}

            {/* Sale Details Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={selectedSale ? `Sale Details: ${selectedSale.sale_number}` : 'Sale Details'}
                size="4xl"
            >
                {selectedSale && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Customer</p>
                                <p className="text-lg font-medium text-slate-900 mt-1">
                                    {selectedSale.customer?.name || 'Walk-in Customer'}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Payment Method</p>
                                <p className="text-lg font-medium text-slate-900 mt-1 capitalize">
                                    {selectedSale.payment_method}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Cashier</p>
                                <p className="text-lg font-medium text-slate-900 mt-1">
                                    {selectedSale.cashier?.full_name || 'System'}
                                </p>
                            </div>
                        </div>

                        <h4 className="font-bold text-slate-900 mb-4 text-left">Ordered Items</h4>
                        <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Product</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">SKU</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Unit Price</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {loadingItems ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-left">
                                                Loading items...
                                            </td>
                                        </tr>
                                    ) : (
                                        saleItems.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-sm text-slate-900 font-medium text-left">
                                                    {item.product?.name || 'Unknown Item'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-500 text-left">
                                                    {item.product?.sku}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 text-right">
                                                    {item.unit_price.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-900 text-right">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">
                                                    {item.subtotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3 text-right text-slate-900">Total Amount:</td>
                                        <td className="px-4 py-3 text-right text-slate-900">LKR {selectedSale.total_amount.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex justify-between mt-6">
                            <button
                                onClick={handleGenerateInvoice}
                                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2 font-medium"
                                disabled={loadingItems}
                            >
                                <FileText className="w-4 h-4" />
                                Print / Share Invoice
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="Confirm Delete Sale"
                size="md"
            >
                <div className="p-6 text-left">
                    <p className="text-slate-600 mb-6">
                        Are you sure you want to delete this sale? This will:
                        <ul className="list-disc ml-5 mt-2 space-y-1">
                            <li>Restore stock levels for all items</li>
                            <li>Reverse any customer credit recorded</li>
                            <li>Remove the transaction from history</li>
                        </ul>
                        <p className="mt-4 font-bold text-red-600">This action cannot be undone.</p>
                    </p>
                    <div className="flex justify-end gap-3 font-medium">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteSale}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                            Delete Sale
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Invoice Component */}
            {showInvoice && invoiceData && (
                <div className="z-[70] relative">
                    <Invoice
                        invoiceData={invoiceData}
                        onClose={() => setShowInvoice(false)}
                    />
                </div>
            )}
        </div>
    );
}
