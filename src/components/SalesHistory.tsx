import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Invoice, InvoiceData } from './Invoice';
import { Search, Eye, FileText, X } from 'lucide-react';

type Sale = Database['public']['Tables']['sales']['Row'] & {
    cashier?: { full_name: string } | null;
    customer?: { name: string; phone: string } | null;
};

type SaleItem = Database['public']['Tables']['sale_items']['Row'] & {
    product?: { name: string; sku: string } | null;
    batch?: { batch_number: string } | null;
};

export function SalesHistory() {
    // const { profile } = useAuth(); // Unused
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
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

    // Invoice State
    const [showInvoice, setShowInvoice] = useState(false);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

    useEffect(() => {
        loadSales();
    }, [dateRange]);

    async function loadSales() {
        setLoading(true);
        try {
            let query = supabase
                .from('sales')
                .select(`
          *,
          cashier:user_profiles!cashier_id(full_name),
          customer:customers(name, phone)
        `)
                .gte('sale_date', `${dateRange.start}T00:00:00`)
                .lte('sale_date', `${dateRange.end}T23:59:59`)
                .order('sale_date', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;

            // Transform data to match our type
            const formattedData = (data as any[] || []).map(item => ({
                ...item,
                cashier: item.cashier ? (Array.isArray(item.cashier) ? item.cashier[0] : item.cashier) : null,
                customer: item.customer ? (Array.isArray(item.customer) ? item.customer[0] : item.customer) : null
            })) as Sale[];

            setSales(formattedData);
        } catch (error) {
            console.error('Error loading sales:', error);
        } finally {
            setLoading(false);
        }
    }

    async function openSaleDetails(sale: Sale) {
        setSelectedSale(sale);
        setShowModal(true);
        setLoadingItems(true);

        try {
            const { data, error } = await supabase
                .from('sale_items')
                .select(`
          *,
          product:products(name, sku),
          batch:product_batches(batch_number)
        `)
                .eq('sale_id', sale.id);

            if (error) throw error;

            // Transform data
            const formattedItems = (data as any[] || []).map(item => ({
                ...item,
                product: item.product ? (Array.isArray(item.product) ? item.product[0] : item.product) : null,
                batch: item.batch ? (Array.isArray(item.batch) ? item.batch[0] : item.batch) : null,
            })) as SaleItem[];

            setSaleItems(formattedItems);
        } catch (error) {
            console.error('Error loading sale items:', error);
            alert('Failed to load sale details');
        } finally {
            setLoadingItems(false);
        }
    }

    const filteredSales = sales.filter(sale =>
        sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.customer?.name && sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
            })),
            subtotal: selectedSale.subtotal,
            discount: selectedSale.discount_amount,
            tax: selectedSale.tax_amount,
            total: selectedSale.total_amount,
            paidAmount: selectedSale.paid_amount,
            changeAmount: Math.max(0, selectedSale.paid_amount - selectedSale.total_amount),
            paymentMethod: selectedSale.payment_method || 'cash',
            cashierName: selectedSale.cashier?.full_name || 'System',
        };

        setInvoiceData(data);
        setShowInvoice(true);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Sales History</h2>
                    <p className="text-slate-600 mt-1">View and manage past sales transactions</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-lg">
                        <Search className="w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by Receipt ID or Customer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 outline-none text-slate-900"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">From:</span>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600">To:</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Receipt ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Payment
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Cashier
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex justify-center mb-2">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                                        </div>
                                        Loading sales data...
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        No sales found for the selected period
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map((sale) => (
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                            LKR {sale.total_amount.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="capitalize text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                {sale.payment_method || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {sale.cashier?.full_name || 'System'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => openSaleDetails(sale)}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg transition text-blue-600 hover:text-blue-700"
                                                title="View Details"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sale Details Modal */}
            {showModal && selectedSale && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Sale Details: {selectedSale.sale_number}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {new Date(selectedSale.sale_date).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-slate-200 rounded-full transition"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

                            <h4 className="font-bold text-slate-900 mb-4">Ordered Items</h4>
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
                                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                    Loading items...
                                                </td>
                                            </tr>
                                        ) : (
                                            saleItems.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                                                        {item.product?.name || 'Unknown Item'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">
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
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between">
                            <button
                                onClick={handleGenerateInvoice}
                                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
                                disabled={loadingItems}
                            >
                                <FileText className="w-4 h-4" />
                                Print / Share Invoice
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Component */}
            {showInvoice && invoiceData && (
                <Invoice
                    invoiceData={invoiceData}
                    onClose={() => setShowInvoice(false)}
                />
            )}
        </div>
    );
}
