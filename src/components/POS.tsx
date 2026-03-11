import { useState, useEffect, useRef } from 'react';
import { useCartPersistence } from '../hooks/useCartPersistence';
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Barcode,
  X,
  DollarSign,
  User,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useProducts, SearchType } from '../hooks/useProducts';
import { ProductWithBatches, Customer, ReferralAgent } from '../types';
import { Invoice } from './Invoice';
import { ProductGrid } from './pos/ProductGrid';
import { CartItemsList } from './pos/CartItemsList';

import { db } from '../lib/db';
import { SyncStatus } from './pos/SyncStatus';
import { Pagination } from './ui';
import { salesService, customerService, productService } from '../services'; // Import services
import { logger } from '../lib/logger';
import { playScannerBeep } from '../utils/audio';

export function POS({ isActive = true }: { isActive?: boolean }) {
  const { profile } = useAuth();
  const { showToast } = useToast();

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

  // ── Persistent cart state (survives page navigation) ───────────────────────
  const {
    cart,
    setCart,
    selectedCustomer,
    setSelectedCustomer,
    selectedReferralAgent,
    setSelectedReferralAgent,
    paymentMethod,
    setPaymentMethod,
    paidAmount,
    setPaidAmount,
    serviceCharge,
    setServiceCharge,
    taxRate,
    setTaxRate,
    clearCart,
  } = useCartPersistence(customers, referralAgents);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithBatches | null>(null);
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
  const lastKeyTimeRef = useRef<number>(0);

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

          // Sync using service
          await salesService.syncOfflineSale(saleObj.sale_data);

          // Mark as synced
          await db.offline_sales.update(saleObj.id!, { status: 'idle', synced: true });
          await db.offline_sales.delete(saleObj.id!); // Clean up

          console.log(`Synced sale ${saleObj.sale_data.sale.sale_number} `);
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept scanner if POS is not the active page
      if (!isActive) return;
      // Don't intercept scanner if a major modal is open (except POS scan mode)
      if (showCustomerModal || showAgentModal || showInvoice) return;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Scanning logic: Scanners are much faster than manual typing (usually < 50ms)
      const isFastInput = diff < 50;

      // 1. If Enter is pressed, finalize the scan
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          e.preventDefault();
          searchProductByBarcode(barcodeBuffer);
          setBarcodeBuffer('');
          return;
        }
        // If it's a short buffer, maybe user just pressed enter, reset
        setBarcodeBuffer('');
        return;
      }

      // 2. Capture alphanumeric characters
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        // High-speed detection OR first character of a potential sequence
        if (barcodeBuffer === '' || isFastInput || diff < 100) {
          setBarcodeBuffer((prev) => prev + e.key);
        } else {
          // Slow typing detected - reset to current key (human mode)
          // But if we're in "Barcode Search Type", we might want to capture it anyway
          if (searchType !== 'barcode') {
            setBarcodeBuffer(e.key);
          } else {
            setBarcodeBuffer((prev) => prev + e.key);
          }
        }

        // Auto-clear buffer if no key for 500ms
        if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = setTimeout(() => {
          setBarcodeBuffer('');
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
    };
  }, [barcodeBuffer, showBatchModal, showCustomerModal, showAgentModal, showInvoice, searchType]);

  async function loadData() {
    try {
      // Only load customers and agents here, products are handled by the hook
      const [customersList, agentsList] = await Promise.all([
        customerService.getAllCustomers(),
        customerService.getAllReferralAgents(),
      ]);

      setCustomers(customersList);
      setReferralAgents(agentsList);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Hook handles refetching automatically

  async function searchProductByBarcode(barcode: string) {
    if (!barcode) return;

    try {
      setSearchTerm(''); // Clear search bar on scan
      const productData = await productService.findByBarcode(barcode);

      if (!productData) {
        showToast(`Product not found with barcode: ${barcode}`, 'error');
        return;
      }

      playScannerBeep();
      showToast(`Scanned: ${productData.name}`, 'success');

      // Fetch batches for this product
      const batches = await productService.getProductBatches(productData.id);

      // Filter accessible batches (gt 0)
      const accessibleBatches = batches.filter((b: any) => b.current_quantity > 0)
        .sort((a: any, b: any) => new Date(a.received_date).getTime() - new Date(b.received_date).getTime());

      // Calculate total stock
      const totalStock = accessibleBatches.reduce((acc: number, b: any) => acc + b.current_quantity, 0);

      const productWithBatches: ProductWithBatches = {
        ...productData,
        batches: accessibleBatches,
        total_stock: totalStock
      };

      handleProductSelect(productWithBatches);

    } catch (err) {
      console.error(err);
      showToast('Error searching product', 'error');
    }
  }

  function handleProductSelect(product: ProductWithBatches) {
    if (product.batches.length === 0) {
      showToast('No stock available for this product', 'warning');
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
        showToast(`Only ${batch.current_quantity} units available`, 'warning');
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
      showToast(`Only ${newCart[index].batch.current_quantity} units available`, 'warning');
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

  function updateCartItemWarranty(index: number, warranty: { duration: number; unit: 'days' | 'months' | 'years'; type: string }) {
    const newCart = [...cart];
    newCart[index].warranty_duration = warranty.duration;
    newCart[index].warranty_unit = warranty.unit;
    newCart[index].warranty_type = warranty.type;
    setCart(newCart);
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  // clearCart is provided by useCartPersistence (clears & persists empty state)

  // Calculations
  const grossSubtotal = cart.reduce((sum, item) => sum + item.original_price * item.quantity, 0);
  const effectiveSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemLevelDiscount = grossSubtotal - effectiveSubtotal;

  // discountAmount is no longer used for global discount, simplifying math
  const taxBase = effectiveSubtotal;
  const taxAmount = taxBase * (taxRate / 100);
  const total = taxBase + taxAmount + serviceCharge;
  const changeAmount = paidAmount - total;


  async function handleCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const data = await customerService.createCustomer({
        name: customerFormData.name,
        phone: customerFormData.phone || undefined,
        email: customerFormData.email || undefined,
        address: customerFormData.address || undefined,
        credit_limit: customerFormData.credit_limit,
      });

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
      showToast(`Error creating customer: ${error.message}`, 'error');
    }
  }

  async function handleAgentSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const data = await customerService.createReferralAgent({
        name: agentFormData.name,
        phone: agentFormData.phone || undefined,
        email: agentFormData.email || undefined,
        address: agentFormData.address || undefined,
        commission_rate: agentFormData.commission_rate,
      });

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
      showToast(`Error creating agent: ${error.message}`, 'error');
    }
  }

  async function handleCompleteSale() {
    if (cart.length === 0) {
      showToast('Cart is empty', 'warning');
      return;
    }

    const creditAmount = paymentMethod === 'credit' ? Math.max(0, total - paidAmount) : 0;

    if (paymentMethod === 'credit' && !selectedCustomer) {
      showToast('Please select a customer for credit sales', 'warning');
      return;
    }

    if (paymentMethod === 'credit' && selectedCustomer) {
      const newCredit = selectedCustomer.current_credit + creditAmount;
      if (newCredit > selectedCustomer.credit_limit) {
        showToast(`Credit limit exceeded! Available excess: LKR ${(selectedCustomer.credit_limit - selectedCustomer.current_credit).toFixed(2)}`, 'error');
        return;
      }
    }

    if (paymentMethod !== 'credit' && paidAmount < total && paymentMethod !== 'mixed') {
      showToast('Paid amount is less than total', 'warning');
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
          selling_price: item.original_price,
          cost_price: item.batch.cost_price,
          warranty_duration: item.warranty_duration,
          warranty_unit: item.warranty_unit,
          warranty_type: item.warranty_type,
        })),
        payment_method: paymentMethod,
        subtotal: effectiveSubtotal,
        discount_amount: itemLevelDiscount,
        tax_amount: taxAmount,
        total_amount: total,
        paid_amount: paidAmount,
        referral_commission_rate: selectedReferralAgent?.commission_rate,
        service_charge: serviceCharge,
      });

      // Prepare invoice data
      setInvoiceData({
        saleNumber: sale.sale_number,
        date: new Date().toLocaleString(),
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone,
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.original_price,
          discountedUnitPrice: item.price,
          subtotal: item.original_price * item.quantity,
          discountedSubtotal: item.price * item.quantity,
          batchNumber: item.batch.batch_number,
          warranty: item.warranty_duration ? {
            duration: item.warranty_duration,
            unit: item.warranty_unit || 'months',
            type: item.warranty_type
          } : undefined,
        })),
        subtotal: grossSubtotal,
        discount: itemLevelDiscount,
        tax: taxAmount,
        total,
        paidAmount,
        changeAmount,
        serviceCharge,
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
            service_charge: serviceCharge,
            status: paymentMethod === 'credit' ? (paidAmount > 0 ? 'partial' : 'credit') : 'completed',
          },
          items: cart.map((item) => ({
            product_id: item.product.id,
            batch_id: item.batch.id,
            quantity: item.quantity,
            unit_price: item.price,
            selling_price: item.original_price,
            subtotal: item.price * item.quantity,
            total_price: item.price * item.quantity,
            cost_price: item.batch.cost_price,
            warranty_duration: item.warranty_duration,
            warranty_unit: item.warranty_unit,
            warranty_type: item.warranty_type,
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
            commission_amount: (total - serviceCharge) * (selectedReferralAgent.commission_rate / 100),
            commission_rate: selectedReferralAgent.commission_rate,
            sale_amount: total - serviceCharge,
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
          date: new Date().toLocaleString(),
          customerName: selectedCustomer?.name,
          customerPhone: selectedCustomer?.phone,
          items: cart.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            unitPrice: item.original_price,
            discountedUnitPrice: item.price,
            subtotal: item.original_price * item.quantity,
            discountedSubtotal: item.price * item.quantity,
            batchNumber: item.batch.batch_number,
            warranty: item.warranty_duration ? {
              duration: item.warranty_duration,
              unit: item.warranty_unit || 'months',
              type: item.warranty_type
            } : undefined,
          })),
          subtotal: grossSubtotal,
          discount: itemLevelDiscount,
          tax: taxAmount,
          serviceCharge,
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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Error completing sale: ${errorMessage}`, 'error');
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
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  className="mt-6 pt-4 border-t border-slate-100"
                />
              </>
            )}
          </div>
        </div>

        {/* Sidebar: Cart & Customer */}
        <div className="lg:col-span-1">
          <div className="bg-slate-50/50 backdrop-blur-sm rounded-2xl border border-slate-200 p-5 sticky top-6 space-y-5">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">Sale Details</h3>

            <div className="space-y-4">
              {/* Customer & Agent Group */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Info</h4>
                </div>
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

              </div>

              {/* Payment & Charges Group */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment & Charges</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm transition appearance-none bg-slate-50"
                    >
                      <option value="cash">Cash Payment</option>
                      <option value="card">Card Payment</option>
                      <option value="credit">Credit Sale</option>
                      <option value="mixed">Mixed Payment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={taxRate === 0 ? '' : taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Service Charge</label>
                    <input
                      type="number"
                      step="0.01"
                      value={serviceCharge === 0 ? '' : serviceCharge}
                      onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm bg-slate-50"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {paymentMethod === 'credit' ? 'Down Payment / Partial Pay' : 'Paid Amount'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paidAmount === 0 ? '' : paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-lg font-bold bg-slate-50"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <DollarSign className="w-16 h-16" />
                </div>

                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal:</span>
                  <span>LKR {grossSubtotal.toFixed(2)}</span>
                </div>

                {itemLevelDiscount > 0 && (
                  <div className="flex justify-between text-xs text-orange-400">
                    <span>Discount:</span>
                    <span>-LKR {itemLevelDiscount.toFixed(2)}</span>
                  </div>
                )}

                {(taxRate > 0 || serviceCharge > 0) && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Taxes & Charges:</span>
                    <span>LKR {(taxAmount + serviceCharge).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-end pt-2 border-t border-slate-800 mt-2">
                  <span className="text-sm font-medium text-slate-400">Payable Total</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white leading-none">
                      LKR {total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {changeAmount > 0 && paymentMethod === 'cash' && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Change Due</span>
                  <span className="text-xl font-bold text-green-700 leading-none">LKR {changeAmount.toFixed(2)}</span>
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
                  onUpdateWarranty={updateCartItemWarranty}
                  onRemoveItem={removeFromCart}
                />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                onClick={handleCompleteSale}
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
