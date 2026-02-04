import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Barcode,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProducts, SearchType } from '../hooks/useProducts';
import { ProductWithBatches, Customer, ReferralAgent, CartItem } from '../types';
import { Invoice } from './Invoice';
import { ProductGrid } from './pos/ProductGrid';
import { CartItemsList } from './pos/CartItemsList';

import { db } from '../lib/db';
import { SyncStatus } from './pos/SyncStatus';
import { salesService } from '../services';
import { logger } from '../lib/logger';

export function POS() {
  const { profile } = useAuth();

  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12); // Grid view needs slightly less items per page
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Use optimized hook
  const {
    products: productsData,
    loading: productsLoading,
    refetch: refetchProducts,
    totalCount,
    totalPages
  } = useProducts(page, pageSize, debouncedSearch, searchType);

  // Cast ProductWithStock[] to ProductWithBatches[] for compatibility
  // They are structurally compatible as ProductWithStock extends ProductWithBatches
  const products = productsData as unknown as ProductWithBatches[];

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [referralAgents, setReferralAgents] = useState<ReferralAgent[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedReferralAgent, setSelectedReferralAgent] = useState<ReferralAgent | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithBatches | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | 'mixed'>('cash');
  const [paidAmount, setPaidAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 0,
  });
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    commission_rate: 0,
  });
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reset to page 1 on search
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Background sync for offline sales
  useEffect(() => {
    async function syncOfflineSales() {
      if (!navigator.onLine) return;

      const pendingSales = await db.offline_sales
        .where('status')
        .equals('pending')
        .toArray();

      if (pendingSales.length === 0) return;

      console.log(`Syncing ${pendingSales.length} offline sales...`);

      for (const offlineSale of pendingSales) {
        try {
          // Use any for offlineSale to avoid index issues if inferred as never
          const saleObj: any = offlineSale;
          await db.offline_sales.update(saleObj.id!, { status: 'syncing' });

          const { sale, items, batches, customerCredit, commission } = saleObj.sale_data;

          // 1. Insert Sale
          const { data: saleData, error: saleError } = await (supabase.from('sales') as any)
            .insert(sale as any)
            .select()
            .single();
          if (saleError) throw saleError;
          const sData = saleData as any;

          // 2. Insert Items (update sale_id)
          const saleItems = items.map((item: any) => ({ ...item, sale_id: sData.id }));
          const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
          if (itemsError) throw itemsError;

          for (const b of batches) {
            const { error: bError } = await (supabase
              .from('product_batches') as any)
              .update({ current_quantity: b.newQuantity } as any)
              .eq('id', b.id);
            if (bError) throw bError;
          }

          if (customerCredit) {
            const { error: cError } = await (supabase
              .from('customers') as any)
              .update({ current_credit: customerCredit.newCredit } as any)
              .eq('id', customerCredit.id);
            if (cError) throw cError;
          }

          // 5. Insert Commission
          if (commission) {
            const { error: comError } = await supabase
              .from('referral_commissions')
              .insert({ ...commission, sale_id: sData.id } as any);
            if (comError) throw comError;
          }

          // Mark as synced
          await db.offline_sales.update(saleObj.id!, { status: 'idle', synced: true });
          await db.offline_sales.delete(saleObj.id!); // Clean up

          console.log(`Synced sale ${sale.sale_number} `);
        } catch (err) {
          const saleObj: any = offlineSale;
          console.error(`Failed to sync sale ${saleObj.id}: `, err);
          await db.offline_sales.update(saleObj.id!, {
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      // refetch products after sync to get updated stock
      refetchProducts();
    }

    const interval = setInterval(syncOfflineSales, 30000); // Check every 30 seconds
    syncOfflineSales(); // Run once on mount

    window.addEventListener('online', syncOfflineSales);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', syncOfflineSales);
    };
  }, [refetchProducts]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showBatchModal || showCustomerModal || showAgentModal || showInvoice) return;

      if (e.key === 'Enter' && barcodeBuffer) {
        searchProductByBarcode(barcodeBuffer);
        setBarcodeBuffer('');
        return;
      }

      if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);

        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }

        barcodeTimeoutRef.current = setTimeout(() => {
          setBarcodeBuffer('');
        }, 100);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [barcodeBuffer, showBatchModal, showCustomerModal, showAgentModal, showInvoice]);

  async function loadData() {
    try {
      // Only load customers and agents here, products are handled by the hook
      const [customersRes, agentsRes] = await Promise.all([
        (supabase.from('customers') as any)
          .select('*').order('name'),
        (supabase.from('referral_agents') as any)
          .select('*').eq('active', true).order('name'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (agentsRes.error) throw agentsRes.error;

      setCustomers(customersRes.data || []);
      setReferralAgents(agentsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Hook handles refetching automatically

  async function searchProductByBarcode(barcode: string) {
    // For barcode scan, we might need to search globally if it's not in the current page
    // So we do a direct DB lookup for exact barcode match
    try {
      const { data: productData, error } = await (supabase.from('products') as any)
        .select('*')
        .eq('barcode', barcode)
        .eq('active', true)
        .single();

      if (error || !productData) {
        alert('Product not found with this barcode');
        return;
      }

      // Fetch batches for this product
      const { data: batches } = await (supabase.from('product_batches') as any)
        .select('*, supplier:supplier_id(name)')
        .eq('product_id', productData.id)
        .gt('current_quantity', 0)
        .order('received_date');

      const productWithBatches: ProductWithBatches = {
        ...productData,
        batches: batches || []
      };

      handleProductSelect(productWithBatches);

    } catch (err) {
      alert('Error searching product');
    }
  }

  function handleProductSelect(product: ProductWithBatches) {
    if (product.batches.length === 0) {
      alert('No stock available for this product');
      return;
    }

    if (product.batches.length === 1) {
      addToCart(product, product.batches[0], 1);
    } else {
      setSelectedProduct(product);
      setShowBatchModal(true);
    }
  }

  function addToCart(product: ProductWithBatches, batch: any, quantity: number) {
    const existingItemIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.batch.id === batch.id
    );

    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      const newQuantity = newCart[existingItemIndex].quantity + quantity;

      if (newQuantity > batch.current_quantity) {
        alert(`Only ${batch.current_quantity} units available`);
        return;
      }

      newCart[existingItemIndex].quantity = newQuantity;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product,
          batch,
          quantity,
          price: batch.selling_price,
          original_price: batch.selling_price,
        },
      ]);
    }

    setShowBatchModal(false);
    setSelectedProduct(null);
  }

  function updateCartItemQuantity(index: number, delta: number) {
    const newCart = [...cart];
    const newQuantity = newCart[index].quantity + delta;

    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    if (newQuantity > newCart[index].batch.current_quantity) {
      alert(`Only ${newCart[index].batch.current_quantity} units available`);
      return;
    }

    newCart[index].quantity = newQuantity;
    setCart(newCart);
  }

  function updateCartItemPrice(index: number, newPrice: number) {
    const newCart = [...cart];
    newCart[index].price = newPrice;
    setCart(newCart);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
    setSelectedCustomer(null);
    setSelectedReferralAgent(null);
    setPaidAmount(0);
    setPaymentMethod('cash');
  }

  // Calculations
  const grossSubtotal = cart.reduce((sum, item) => sum + item.original_price * item.quantity, 0);
  const effectiveSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemLevelDiscount = grossSubtotal - effectiveSubtotal;

  // discountAmount is no longer used for global discount, simplifying math
  const taxBase = effectiveSubtotal;
  const taxAmount = taxBase * (taxRate / 100);
  const total = taxBase + taxAmount;
  const changeAmount = paidAmount - total;


  async function handleCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data, error } = await (supabase.from('customers') as any)
        .insert({
          name: customerFormData.name,
          phone: customerFormData.phone || null,
          email: customerFormData.email || null,
          address: customerFormData.address || null,
          credit_limit: customerFormData.credit_limit,
        })
        .select()
        .single();

      if (error) throw error;

      setShowCustomerModal(false);
      setCustomerFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: 0,
      });
      loadData();
      setSelectedCustomer(data);
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleAgentSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { data, error } = await (supabase.from('referral_agents') as any)
        .insert({
          name: agentFormData.name,
          phone: agentFormData.phone || null,
          email: agentFormData.email || null,
          address: agentFormData.address || null,
          commission_rate: agentFormData.commission_rate,
        })
        .select()
        .single();

      if (error) throw error;

      setShowAgentModal(false);
      setAgentFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        commission_rate: 0,
      });
      loadData();
      setSelectedReferralAgent(data);
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function completeSale() {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    const creditAmount = paymentMethod === 'credit' ? Math.max(0, total - paidAmount) : 0;

    if (paymentMethod === 'credit' && !selectedCustomer) {
      alert('Please select a customer for credit sales');
      return;
    }

    if (paymentMethod === 'credit' && selectedCustomer) {
      const newTotalCredit = selectedCustomer.current_credit + creditAmount;
      if (newTotalCredit > selectedCustomer.credit_limit) {
        alert(`Credit limit exceeded! Available excess: LKR ${(selectedCustomer.credit_limit - selectedCustomer.current_credit).toFixed(2)} `);
        return;
      }
    }

    if (paymentMethod !== 'credit' && paidAmount < total) {
      alert('Paid amount is less than total');
      return;
    }

    setProcessing(true);

    try {
      // Use SalesService to create the sale
      const sale = await salesService.createSale({
        customer_id: selectedCustomer?.id || null,
        cashier_id: profile?.id || '',
        referral_agent_id: selectedReferralAgent?.id || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          batch_id: item.batch.id,
          quantity: item.quantity,
          unit_price: item.price,
          cost_price: item.batch.cost_price,
        })),
        payment_method: paymentMethod,
        subtotal: effectiveSubtotal,
        discount_amount: itemLevelDiscount,
        tax_amount: taxAmount,
        total_amount: total,
        paid_amount: paidAmount,
        referral_commission_rate: selectedReferralAgent?.commission_rate,
      });

      // Prepare invoice data
      setInvoiceData({
        saleNumber: sale.sale_number,
        date: new Date().toLocaleDateString(),
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone,
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.price,
          subtotal: item.price * item.quantity,
          batchNumber: item.batch.batch_number,
        })),
        subtotal: effectiveSubtotal,
        discount: itemLevelDiscount,
        tax: taxAmount,
        total,
        paidAmount,
        changeAmount,
        paymentMethod,
        cashierName: profile?.full_name || 'Cashier',
      });

      setShowInvoice(true);
      clearCart();
      loadData();
      refetchProducts(); // Refresh stock levels
    } catch (err: any) {
      if (!navigator.onLine) {
        // Handle Offline Mode
        const saleNumber = `SALE-${Date.now()} `;
        const salePayload = {
          sale: {
            sale_number: saleNumber,
            customer_id: selectedCustomer?.id || null,
            referral_agent_id: selectedReferralAgent?.id || null,
            user_id: profile?.id,
            sale_date: new Date().toISOString(),
            subtotal: effectiveSubtotal,
            discount_amount: itemLevelDiscount,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: total,
            payment_method: paymentMethod,
            paid_amount: paidAmount,
            status: paymentMethod === 'credit' ? (paidAmount > 0 ? 'partial' : 'credit') : 'completed',
          },
          items: cart.map((item) => ({
            product_id: item.product.id,
            batch_id: item.batch.id,
            quantity: item.quantity,
            unit_price: item.price,
            subtotal: item.price * item.quantity,
            total_price: item.price * item.quantity,
            cost_price: item.batch.cost_price,
          })),
          batches: cart.map(item => ({
            id: item.batch.id,
            newQuantity: item.batch.current_quantity - item.quantity
          })),
          customerCredit: (paymentMethod === 'credit' && selectedCustomer && creditAmount > 0) ? {
            id: selectedCustomer.id,
            newCredit: selectedCustomer.current_credit + creditAmount
          } : null,
          commission: selectedReferralAgent ? {
            referral_agent_id: selectedReferralAgent.id,
            commission_amount: total * (selectedReferralAgent.commission_rate / 100),
            commission_rate: selectedReferralAgent.commission_rate,
            sale_amount: total,
          } : null
        };

        await db.offline_sales.add({
          sale_data: salePayload,
          created_at: new Date().toISOString(),
          synced: false,
          status: 'pending'
        });

        // Optimization: Deduct stock from local IndexedDB immediately so offline search shows updated stock
        for (const item of cart) {
          const product = await db.products.get(item.product.id);
          if (product) {
            const updatedBatches = product.batches.map(b =>
              b.id === item.batch.id ? { ...b, current_quantity: b.current_quantity - item.quantity } : b
            );
            await db.products.update(item.product.id, { batches: updatedBatches });
          }
        }

        // Show Invoice with warning
        setInvoiceData({
          saleNumber: `[OFFLINE] ${saleNumber} `,
          date: new Date().toLocaleDateString(),
          customerName: selectedCustomer?.name,
          customerPhone: selectedCustomer?.phone,
          items: cart.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
            batchNumber: item.batch.batch_number
          })),
          subtotal: effectiveSubtotal,
          discount: itemLevelDiscount,
          tax: taxAmount,
          total: total,
          paidAmount: paidAmount,
          changeAmount: Math.max(0, paidAmount - total),
          paymentMethod: paymentMethod,
          cashierName: profile?.full_name || 'Cashier',
          isOffline: true
        });
        setShowInvoice(true);
        clearCart();
        // No need to loadData or refetchProducts as we are offline
        return;
      }

      logger.error('Sale completion failed', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete sale';
      alert(`Error completing sale: ${errorMessage} `);
    } finally {
      setProcessing(false);
    }
  }

  // Not strictly filtered locally anymore except for fallback display

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Point of Sale</h2>
          <p className="text-slate-500">Manage sales and transactions</p>
        </div>
        <SyncStatus />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex gap-4">
              <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={
                    searchType === 'name' ? "Search by name..." :
                      searchType === 'sku' ? "Search by SKU..." :
                        searchType === 'barcode' ? "Scan barcode..." :
                          "Search / Scan..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 outline-none text-slate-900"
                  autoFocus
                />
                <Barcode className={`w-5 h-5 ${barcodeBuffer ? 'text-green-600 animate-pulse' : 'text-slate-400'} `} />
              </div>

              <div className="relative min-w-[140px]">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as SearchType)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">Auto Search</option>
                  <option value="name">Product Name</option>
                  <option value="sku">SKU Code</option>
                  <option value="barcode">Barcode</option>
                </select>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition ${viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    } `}
                  title="Grid View"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition ${viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    } `}
                  title="List View"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
            {barcodeBuffer && (
              <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                <Barcode className="w-3 h-3" />
                Scanning barcode... ({barcodeBuffer})
              </div>
            )}
          </div>

          {/* Product Feed */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Available Products</h3>
              {totalCount > 0 && (
                <span className="text-sm text-slate-500">{totalCount} items found</span>
              )}
            </div>

            {productsLoading && products.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-slate-500">Loading catalog...</div>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                <Search className="w-12 h-12 mb-2 opacity-20" />
                <p>No products found matching your search</p>
              </div>
            ) : (
              <>
                <ProductGrid
                  products={products}
                  onAddToCart={handleProductSelect}
                  viewMode={viewMode}
                  isAdmin={profile?.role === 'admin'}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-600">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar: Cart & Customer */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Sale Details</h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer (Optional)</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const customer = customers.find((c) => c.id === e.target.value);
                      setSelectedCustomer(customer || null);
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    className="px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                    title="Add new customer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Referral Agent (Optional)
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedReferralAgent?.id || ''}
                    onChange={(e) => {
                      const agent = referralAgents.find((a) => a.id === e.target.value);
                      setSelectedReferralAgent(agent || null);
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                  >
                    <option value="">None</option>
                    {referralAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.commission_rate}%)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAgentModal(true)}
                    className="px-3 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition flex items-center gap-1"
                    title="Add new referral agent"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={taxRate === 0 ? '' : taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {paymentMethod === 'credit' ? 'Down Payment / Partial Pay' : 'Paid Amount'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paidAmount === 0 ? '' : paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-medium text-slate-900">LKR {grossSubtotal.toFixed(2)}</span>
                </div>
                {itemLevelDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600">Item Discounts:</span>
                    <span className="font-medium text-orange-600">-LKR {itemLevelDiscount.toFixed(2)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax ({taxRate}%):</span>
                    <span className="font-medium text-slate-900">LKR {taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Total:</span>
                  <span className="text-slate-900">LKR {total.toFixed(2)}</span>
                </div>
              </div>

              {changeAmount > 0 && paymentMethod === 'cash' && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex justify-between items-center text-green-700">
                    <span className="text-sm font-medium">Change:</span>
                    <span className="text-lg font-bold">LKR {changeAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-slate-900">Cart ({cart.length})</h4>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="-mx-2 px-2">
                <CartItemsList
                  items={cart}
                  onUpdateQuantity={updateCartItemQuantity}
                  onUpdatePrice={updateCartItemPrice}
                  onRemoveItem={removeFromCart}
                />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={completeSale}
                disabled={cart.length === 0 || processing}
                className="w-full py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {processing ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Invoice */}
      {showInvoice && invoiceData && (
        <Invoice invoiceData={invoiceData} onClose={() => {
          setShowInvoice(false);
          setInvoiceData(null);
        }} />
      )}

      {showBatchModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Select Batch-{selectedProduct.name}</h3>
              <button
                onClick={() => {
                  setShowBatchModal(false);
                  setSelectedProduct(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-md transition"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-sm">
                    <th className="pb-3 pr-4">Batch Number</th>
                    <th className="pb-3 pr-4">Received Date</th>
                    {profile?.role === 'admin' && (
                      <>
                        <th className="pb-3 pr-4">Cost</th>
                        <th className="pb-3 pr-4">Markup</th>
                      </>
                    )}
                    <th className="pb-3 pr-4">Price</th>
                    <th className="pb-3 pr-4">Stock</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedProduct.batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50 transition">
                      <td className="py-4 font-mono text-sm">{batch.batch_number}</td>
                      <td className="py-4 text-sm text-slate-600">{new Date(batch.received_date).toLocaleDateString()}</td>
                      {profile?.role === 'admin' && (
                        <>
                          <td className="py-4 text-sm text-slate-600">LKR {batch.cost_price?.toFixed(2) || '0.00'}</td>
                          <td className="py-4 text-sm">
                            <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {batch.markup_percentage || 0}%
                            </span>
                          </td>
                        </>
                      )}
                      <td className="py-4 text-sm font-bold text-slate-900">LKR {batch.selling_price.toFixed(2)}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${batch.current_quantity > 10 ? 'bg-green-100 text-green-700' :
                          batch.current_quantity > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          } `}>
                          {batch.current_quantity} in stock
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => addToCart(selectedProduct, batch, 1)}
                          disabled={batch.current_quantity <= 0}
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          Add to Cart
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Add New Customer</h3>
              <button onClick={() => setShowCustomerModal(false)} className="p-1 hover:bg-slate-100 rounded-md transition">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={customerFormData.name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={customerFormData.phone}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit</label>
                  <input
                    type="number"
                    value={customerFormData.credit_limit}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, credit_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={customerFormData.address}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none h-20"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium">
                Save Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {showAgentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Add New Agent</h3>
              <button onClick={() => setShowAgentModal(false)} className="p-1 hover:bg-slate-100 rounded-md transition">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAgentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Commission Rate (%) *</label>
                <input
                  required
                  type="number"
                  value={agentFormData.commission_rate}
                  onChange={(e) => setAgentFormData({ ...agentFormData, commission_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition font-medium">
                Save Agent
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
