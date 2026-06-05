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
  UserCheck,
  Tag,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useProducts, SearchType } from '../hooks/useProducts';
import { ProductWithBatches, Customer, ReferralAgent, UserProfile, VariantWithStock, ProductVariant, ProductBatch } from '../types';
import { Invoice } from './Invoice';
import { ProductGrid } from './pos/ProductGrid';
import { CartItemsList } from './pos/CartItemsList';
import { VariantPicker } from './pos/VariantPicker';
import { LoyaltyPanel } from './pos/LoyaltyPanel';

import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { SyncStatus } from './pos/SyncStatus';
import { Pagination, Modal } from './ui';
import { salesService, customerService, productService, variantService, loyaltyService } from '../services';
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  // Gift voucher redemption
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ id: string; code: string; amount: number } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // POS voucher issuance
  const [showIssueVoucher, setShowIssueVoucher] = useState(false);
  const [voucherRules, setVoucherRules] = useState<{ minPurchase: number; rewardAmount: number } | null>(null);
  const [issueVoucherForm, setIssueVoucherForm] = useState({ amount: '', phone: '', name: '' });
  const [issuingVoucher, setIssuingVoucher] = useState(false);
  const [processing, setProcessing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 0,
    notes: '',
  });
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    commission_rate: 0,
  });
  const [phoneInput, setPhoneInput] = useState('');
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [selectedStaffMember, setSelectedStaffMember] = useState<UserProfile | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [loyaltyRedeeming, setLoyaltyRedeeming] = useState(false);
  const [showVoucherInput, setShowVoucherInput] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  // Manual Item Modal State
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemForm, setManualItemForm] = useState({ description: '', price: 0, quantity: 1 });

  // Variant picker state
  const [variantPickerProduct, setVariantPickerProduct] = useState<ProductWithBatches | null>(null);
  const [variantPickerVariants, setVariantPickerVariants] = useState<VariantWithStock[]>([]);

  // Loyalty state
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [earnRate, setEarnRate] = useState(100);

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
      if (showCustomerModal || showAgentModal || showInvoice || showManualItemModal) return;

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
  }, [barcodeBuffer, showBatchModal, showCustomerModal, showAgentModal, showInvoice, showManualItemModal, searchType]);

  async function loadData() {
    try {
      const [customersList, agentsList, rate] = await Promise.all([
        customerService.getAllCustomers(),
        customerService.getAllReferralAgents(),
        loyaltyService.getEarnRate(),
      ]);

      setCustomers(customersList);
      setReferralAgents(agentsList);
      setEarnRate(rate);
    } catch (error) {
      console.error('Error loading data:', error);
    }

    // Load staff members from user_profiles
    try {
      const { data: staffData } = await (supabase
        .from('user_profiles')
        .select('id, full_name, email, role, active, daily_target, created_at, updated_at')
        .in('role', ['cashier', 'staff', 'admin'])
        .eq('active', true)
        .order('full_name') as any);
      setStaffMembers(staffData || []);
    } catch { /* non-critical */ }

    // Load voucher rules
    try {
      const { data } = await (supabase.from('app_settings') as any)
        .select('key, value').in('key', ['voucher_min_purchase', 'voucher_reward_amount']);
      if (data && data.length === 2) {
        const get = (k: string) => parseFloat(data.find((r: any) => r.key === k)?.value ?? '0');
        const min = get('voucher_min_purchase');
        const reward = get('voucher_reward_amount');
        if (min > 0 && reward > 0) setVoucherRules({ minPurchase: min, rewardAmount: reward });
      }
    } catch { /* non-critical */ }
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

  async function handleProductSelect(product: ProductWithBatches) {
    try {
      const variants = await variantService.getVariantsForProduct(product.id);
      if (variants.length > 0) {
        setVariantPickerProduct(product);
        setVariantPickerVariants(variants);
        return;
      }
    } catch {
      // ignore variant lookup errors; fall through to batch flow
    }

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

  function addToCartFromVariant(variant: ProductVariant, batch: ProductBatch, quantity: number) {
    const product = variantPickerProduct!;
    const existingIdx = cart.findIndex(
      item => item.variant?.id === variant.id && item.batch.id === batch.id
    );
    if (existingIdx >= 0) {
      const newCart = [...cart];
      const newQty = newCart[existingIdx].quantity + quantity;
      if (newQty > batch.current_quantity) {
        showToast(`Only ${batch.current_quantity} in stock`, 'warning');
        return;
      }
      newCart[existingIdx].quantity = newQty;
      setCart(newCart);
    } else {
      setCart([...cart, { product, variant, batch, quantity, price: batch.selling_price, original_price: batch.selling_price }]);
    }
    setVariantPickerProduct(null);
    setVariantPickerVariants([]);
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

    // Manual items have no stock limit
    if (!newCart[index].isManual && newQuantity > newCart[index].batch.current_quantity) {
      showToast(`Only ${newCart[index].batch.current_quantity} units available`, 'warning');
      return;
    }

    newCart[index].quantity = newQuantity;
    setCart(newCart);
  }

  function addManualItem() {
    const { description, price, quantity } = manualItemForm;
    if (!description.trim()) {
      showToast('Please enter a description', 'warning');
      return;
    }
    if (price <= 0) {
      showToast('Please enter a valid price', 'warning');
      return;
    }
    if (quantity < 1) {
      showToast('Quantity must be at least 1', 'warning');
      return;
    }

    // Stub product & batch so CartItem shape is satisfied (these won't be saved to DB)
    const stubProduct: any = { id: `manual-${Date.now()}`, name: description, image_url: null };
    const stubBatch: any = { id: `manual-batch-${Date.now()}`, batch_number: 'MANUAL', selling_price: price, cost_price: 0, current_quantity: 999999 };

    setCart([
      ...cart,
      {
        product: stubProduct,
        batch: stubBatch,
        quantity,
        price,
        original_price: price,
        isManual: true,
        manualDescription: description.trim(),
      },
    ]);

    setManualItemForm({ description: '', price: 0, quantity: 1 });
    setShowManualItemModal(false);
    showToast(`'${description.trim()}' added to cart`, 'success');
  }

  function setCartItemQuantity(index: number, qty: number) {
    const item = cart[index];
    if (qty <= 0) { removeFromCart(index); return; }
    if (!item.isManual && qty > item.batch.current_quantity) {
      showToast(`Only ${item.batch.current_quantity} units available`, 'warning');
      return;
    }
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], quantity: qty };
    setCart(newCart);
  }

  function updateCartItemPrice(index: number, newPrice: number) {
    const item = cart[index];
    const maxDisc = item.original_price <= 1000 ? 50
      : item.original_price <= 2000 ? 100
      : item.original_price <= 5000 ? 200
      : 300;
    const newCart = [...cart];
    newCart[index].price = Math.max(item.original_price - maxDisc, newPrice);
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
  const voucherDiscount = appliedVoucher ? Math.min(appliedVoucher.amount, taxBase + taxAmount + serviceCharge - loyaltyDiscount) : 0;
  const total = Math.max(0, taxBase + taxAmount + serviceCharge - loyaltyDiscount - voucherDiscount);
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
        notes: '',
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

  async function handleIssueVoucherFromPOS() {
    const amt = parseFloat(issueVoucherForm.amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setIssuingVoucher(true);
    try {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const code = `RVL-${rand(4)}-${rand(3)}`;
      const expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + 3);

      const { error } = await (supabase.from('gift_vouchers') as any).insert({
        code, amount: amt, status: 'active',
        issued_source: 'reward',
        issued_to: issueVoucherForm.name.trim() || (selectedCustomer?.name ?? null),
        recipient_phone: issueVoucherForm.phone.trim() || null,
        issued_by_staff_id: profile?.id ?? null,
        expires_at: expiresAt.toISOString().split('T')[0],
      });
      if (error) throw error;

      const cardData = {
        code, amount: amt,
        issuedTo: issueVoucherForm.name.trim() || selectedCustomer?.name || undefined,
        expiresAt: expiresAt.toISOString().split('T')[0],
        issuedAt: new Date().toISOString(),
      };

      if (issueVoucherForm.phone.trim()) {
        const { openWhatsApp } = await import('./vouchers/voucherCardHTML');
        openWhatsApp(issueVoucherForm.phone.trim(), cardData);
      }

      showToast(`Voucher ${code} issued`, 'success');
      setShowIssueVoucher(false);
      setIssueVoucherForm({ amount: '', phone: '', name: '' });
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to issue voucher', 'error');
    } finally {
      setIssuingVoucher(false);
    }
  }

  async function applyVoucher() {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherLoading(true);
    try {
      const { data, error } = await (supabase.from('gift_vouchers') as any)
        .select('id, code, amount, expires_at, status')
        .eq('code', code)
        .single();
      if (error || !data) { showToast('Voucher not found', 'error'); return; }
      if (data.status !== 'active') { showToast(`Voucher is ${data.status}`, 'error'); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { showToast('Voucher has expired', 'error'); return; }
      setAppliedVoucher({ id: data.id, code: data.code, amount: data.amount });
      setVoucherInput('');
      showToast(`Voucher ${data.code} applied — LKR ${Math.round(data.amount).toLocaleString()} off`, 'success');
    } catch {
      showToast('Failed to validate voucher', 'error');
    } finally {
      setVoucherLoading(false);
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
        cashier_id: selectedStaffMember?.id || profile?.id || '',
        referral_agent_id: selectedReferralAgent?.id || null,
        items: cart.map((item) => ({
          product_id: item.isManual ? undefined : item.product.id,
          variant_id: item.isManual ? undefined : item.variant?.id,
          batch_id: item.isManual ? undefined : item.batch.id,
          quantity: item.quantity,
          unit_price: item.price,
          selling_price: item.original_price,
          cost_price: item.batch.cost_price,
          is_manual: item.isManual || false,
          manual_description: item.manualDescription,
        })),
        payment_method: paymentMethod,
        subtotal: effectiveSubtotal,
        discount_amount: itemLevelDiscount,
        tax_amount: taxAmount,
        total_amount: total,
        paid_amount: paidAmount,
        cash_amount: paymentMethod === 'mixed' ? cashAmount : null,
        card_amount: paymentMethod === 'mixed' ? cardAmount : null,
        referral_commission_rate: selectedReferralAgent?.commission_rate,
        service_charge: serviceCharge,
        loyalty_points_redeemed: loyaltyPointsToRedeem || undefined,
        customer_loyalty_balance: selectedCustomer?.loyalty_points,
      });

      // Prepare invoice data
      setInvoiceData({
        saleNumber: sale.sale_number,
        date: new Date().toLocaleString(),
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone,
        items: cart.map((item) => ({
          name: item.isManual ? (item.manualDescription || 'Manual Item') : item.product.name,
          quantity: item.quantity,
          unitPrice: item.original_price,
          discountedUnitPrice: item.price,
          subtotal: item.original_price * item.quantity,
          discountedSubtotal: item.price * item.quantity,
          batchNumber: item.isManual ? '' : item.batch.batch_number,
          isManual: item.isManual,
          variantLabel: item.variant ? [item.variant.color, item.variant.size].filter(Boolean).join(' · ') : undefined,
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

      // Mark voucher as used
      if (appliedVoucher) {
        await (supabase.from('gift_vouchers') as any)
          .update({ status: 'used', redeemed_at: new Date().toISOString() })
          .eq('id', appliedVoucher.id);
        setAppliedVoucher(null);
      }

      setShowInvoice(true);
      clearCart();
      setSelectedStaffMember(null);
      setCashAmount(0);
      setCardAmount(0);
      setLoyaltyPointsToRedeem(0);
      setLoyaltyDiscount(0);
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
            product_id: item.isManual ? undefined : item.product.id,
            variant_id: item.isManual ? undefined : item.variant?.id,
            batch_id: item.isManual ? undefined : item.batch.id,
            quantity: item.quantity,
            unit_price: item.price,
            selling_price: item.original_price,
            subtotal: item.price * item.quantity,
            total_price: item.price * item.quantity,
            cost_price: item.batch.cost_price,
            is_manual: item.isManual || false,
            manual_description: item.manualDescription,
          })),
          batches: cart.filter(i => !i.isManual).map(item => ({
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
        for (const item of cart.filter(i => !i.isManual)) {
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
            name: item.isManual ? (item.manualDescription || 'Manual Item') : item.product.name,
            quantity: item.quantity,
            unitPrice: item.original_price,
            discountedUnitPrice: item.price,
            subtotal: item.original_price * item.quantity,
            discountedSubtotal: item.price * item.quantity,
            batchNumber: item.isManual ? '' : item.batch.batch_number,
            isManual: item.isManual,
            variantLabel: item.variant ? [item.variant.color, item.variant.size].filter(Boolean).join(' · ') : undefined,
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
    <>
      <div className="pos-layout">
        {/* ── Product browser ── */}
        <section style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', background: 'var(--bg)', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--line-2)', background: 'var(--panel)', flexShrink: 0 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)', minWidth: 0 }}>
              <Search size={16} strokeWidth={1.6} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name or SKU — or scan barcode"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ flex: 1, border: 0, outline: 'none', background: 'var(--bg)', fontSize: 13.5, color: 'var(--ink)', minWidth: 0 }}
                autoFocus
              />
              <span className="kbd">/</span>
              <div style={{ width: 1, height: 18, background: 'var(--line)', flexShrink: 0 }} />
              <Barcode size={16} strokeWidth={1.6} style={{ color: barcodeBuffer ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }} />
            </div>
            <div className="hidden lg:block"><SyncStatus /></div>
            <div style={{ display: 'flex', height: 40, borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden', flexShrink: 0 }}>
              {(['grid', 'list'] as const).map((v) => (
                <button key={v} onClick={() => setViewMode(v)} style={{
                  padding: '0 12px', border: 0,
                  background: viewMode === v ? 'var(--panel-2)' : 'var(--panel)',
                  color: viewMode === v ? 'var(--ink)' : 'var(--muted)',
                  fontSize: 12.5, fontWeight: viewMode === v ? 600 : 500, cursor: 'default',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {v === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
                  <span className="hidden sm:inline">{v === 'grid' ? 'Grid' : 'List'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search-type strip */}
          <div style={{ padding: '10px 18px', display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid var(--line-2)', overflowX: 'auto', background: 'var(--panel)', flexShrink: 0 }}>
            {([['all', 'All'], ['name', 'By Name'], ['sku', 'By SKU'], ['barcode', 'Barcode']] as [SearchType, string][]).map(([type, label]) => {
              const isA = searchType === type;
              return (
                <button key={type} onClick={() => setSearchType(type)} style={{
                  padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                  border: isA ? '1px solid var(--accent)' : '1px solid var(--line)',
                  background: isA ? 'var(--accent-soft)' : 'var(--panel)',
                  color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                  fontSize: 12.5, fontWeight: isA ? 600 : 500, cursor: 'default',
                }}>{label}</button>
              );
            })}
            {barcodeBuffer && (
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                <Barcode size={11} /> Scanning…
              </span>
            )}
          </div>

          {/* Product area */}
          <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px 24px', background: 'var(--bg)' }} className="custom-scrollbar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {searchType === 'all' ? 'All products' : searchType === 'name' ? 'Name search' : searchType === 'sku' ? 'SKU search' : 'Barcode'}
                </span>
                <span className="num" style={{ fontSize: 12, color: 'var(--faint)', marginLeft: 8 }}>
                  {totalCount} {totalCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>

            {productsLoading && products.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--muted)', fontSize: 13 }}>
                Loading catalog…
              </div>
            ) : products.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--muted)', gap: 10 }}>
                <Search size={32} style={{ opacity: 0.15 }} />
                <span style={{ fontSize: 13 }}>No products found</span>
              </div>
            ) : (
              <>
                <ProductGrid
                  products={products}
                  onAddToCart={handleProductSelect}
                  viewMode={viewMode}
                  isAdmin={profile?.role === 'admin'}
                />
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  style={{ marginTop: 20 }}
                />
              </>
            )}
          </div>
        </section>

        {/* ── Cart panel (desktop) ── */}
        <aside className="hidden lg:flex lg:flex-col" style={{ background: 'var(--panel)', borderLeft: '1px solid var(--line)', overflowY: 'auto' }}>

          {/* Cart header */}
          <div className="pos-cart-header" style={{ borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Current Sale</h3>
                <span className="chip chip-neutral" style={{ fontSize: 10.5 }}>
                  <span className="num">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                {profile?.full_name?.split(' ')[0] || 'Cashier'} · Register 1
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => { setManualItemForm({ description: '', price: 0, quantity: 1 }); setShowManualItemModal(true); }}
                title="Add manual item"
                className="btn btn-sm btn-ghost"
                style={{ color: 'var(--warn)', padding: 0, width: 28, height: 28, justifyContent: 'center' }}
              >
                <Tag size={14} />
              </button>
              <button onClick={clearCart} className="btn btn-sm btn-ghost" style={{ color: 'var(--muted)' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Customer + Sales Staff — combined row */}
          <div className="pos-cart-section" style={{ borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* ── Customer: phone search ── */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              {selectedCustomer ? (
                /* Selected state */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                    display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                  }}>
                    {selectedCustomer.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Customer</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedCustomer.name}
                    </div>
                    {selectedCustomer.phone && (
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>
                        {selectedCustomer.phone}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setPhoneInput(''); setLoyaltyPointsToRedeem(0); setLoyaltyDiscount(0); }}
                    title="Remove customer"
                    style={{ color: 'var(--muted)', background: 'transparent', border: 0, padding: 0, width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 4, lineHeight: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={() => setShowCustomerModal(true)}
                    title="Add new customer"
                    style={{ color: 'var(--muted)', background: 'transparent', border: 0, padding: 0, width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 4, lineHeight: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ) : (
                /* Search state */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(20,22,26,0.06)', color: 'var(--muted)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <User size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Customer</div>
                    <input
                      type="tel"
                      placeholder="Phone number…"
                      value={phoneInput}
                      onChange={(e) => { setPhoneInput(e.target.value); setShowCustSuggestions(true); }}
                      onFocus={() => setShowCustSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCustSuggestions(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        const digits = phoneInput.replace(/\D/g, '');
                        const matches = customers.filter(c => c.phone?.replace(/\D/g, '').includes(digits));
                        if (matches.length === 1) {
                          setSelectedCustomer(matches[0]); setPhoneInput(''); setShowCustSuggestions(false);
                          setLoyaltyPointsToRedeem(0); setLoyaltyDiscount(0);
                        } else if (!matches.length && phoneInput.trim()) {
                          setCustomerFormData({ name: '', phone: phoneInput, email: '', address: '', credit_limit: 0, notes: '' });
                          setShowCustSuggestions(false); setShowCustomerModal(true);
                        }
                      }}
                      style={{ width: '100%', border: 0, background: 'transparent', fontSize: 12, fontWeight: 500, color: 'var(--ink)', outline: 'none', padding: 0, fontFamily: "'JetBrains Mono',monospace" }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setCustomerFormData({ name: '', phone: phoneInput, email: '', address: '', credit_limit: 0, notes: '' });
                      setShowCustSuggestions(false);
                      setShowCustomerModal(true);
                    }}
                    title="Add new customer"
                    style={{ color: 'var(--muted)', background: 'transparent', border: 0, padding: 0, width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 4, lineHeight: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}

              {/* Phone suggestions dropdown */}
              {showCustSuggestions && phoneInput.length > 1 && (() => {
                const digits = phoneInput.replace(/\D/g, '');
                const matches = customers.filter(c => c.phone?.replace(/\D/g, '').includes(digits));
                if (!matches.length) return (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 20px rgba(20,22,26,0.1)', padding: '6px' }}>
                    <button
                      onMouseDown={() => {
                        setCustomerFormData({ name: '', phone: phoneInput, email: '', address: '', credit_limit: 0, notes: '' });
                        setShowCustSuggestions(false); setShowCustomerModal(true);
                      }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'default' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(20,22,26,0.06)', color: 'var(--muted)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Plus size={12} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>New customer</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>{phoneInput}</div>
                      </div>
                    </button>
                  </div>
                );
                return (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 6px 20px rgba(20,22,26,0.1)', overflow: 'hidden' }}>
                    {matches.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={() => { setSelectedCustomer(c); setPhoneInput(''); setShowCustSuggestions(false); setLoyaltyPointsToRedeem(0); setLoyaltyDiscount(0); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'default' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>
                          {c.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace" }}>{c.phone}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 32, background: 'var(--line)', flexShrink: 0 }} />

            {/* ── Sales Staff: custom popover ── */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <button
                onClick={() => { setStaffOpen((o) => !o); setStaffSearch(''); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'default' }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: selectedStaffMember ? 'var(--accent-soft)' : 'rgba(20,22,26,0.06)',
                  color: selectedStaffMember ? 'var(--accent-ink)' : 'var(--muted)',
                  display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                }}>
                  {selectedStaffMember
                    ? selectedStaffMember.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')
                    : <UserCheck size={13} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Staff</div>
                  <div style={{ fontSize: 12, fontWeight: selectedStaffMember ? 600 : 400, color: selectedStaffMember ? 'var(--ink)' : 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedStaffMember?.full_name ?? '— none —'}
                  </div>
                </div>
              </button>

              {staffOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setStaffOpen(false); setStaffSearch(''); }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, minWidth: 210, zIndex: 50, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,22,26,0.12)', overflow: 'hidden' }}>

                    {/* Search input */}
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                        <Search size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search staff…"
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          style={{ flex: 1, border: 0, background: 'transparent', fontSize: 12, color: 'var(--ink)', outline: 'none', padding: 0 }}
                        />
                        {staffSearch && (
                          <button onClick={() => setStaffSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--muted)', padding: 0, lineHeight: 0, cursor: 'pointer' }}>
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Staff list */}
                    <div style={{ maxHeight: 220, overflowY: 'auto' }} className="custom-scrollbar">
                      {(() => {
                        const q = staffSearch.trim().toLowerCase();
                        const filtered = q ? staffMembers.filter(s => s.full_name.toLowerCase().includes(q)) : staffMembers;
                        if (q && !filtered.length) return (
                          <div style={{ padding: '14px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No staff found</div>
                        );
                        return (
                          <>
                            {!q && (
                              <button
                                onClick={() => { setSelectedStaffMember(null); setStaffOpen(false); setStaffSearch(''); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 0, background: !selectedStaffMember ? 'var(--accent-soft)' : 'transparent', textAlign: 'left', cursor: 'default' }}
                                onMouseEnter={(e) => { if (selectedStaffMember) e.currentTarget.style.background = 'var(--panel-2)'; }}
                                onMouseLeave={(e) => { if (selectedStaffMember) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                                  <UserCheck size={13} />
                                </div>
                                <div style={{ flex: 1, fontSize: 12.5, color: !selectedStaffMember ? 'var(--accent-ink)' : 'var(--ink-2)', fontWeight: !selectedStaffMember ? 600 : 400 }}>— none —</div>
                                {!selectedStaffMember && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                              </button>
                            )}
                            {filtered.map((s) => {
                              const isSelected = selectedStaffMember?.id === s.id;
                              return (
                                <button
                                  key={s.id}
                                  onClick={() => { setSelectedStaffMember(s); setStaffOpen(false); setStaffSearch(''); }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 0, background: isSelected ? 'var(--accent-soft)' : 'transparent', textAlign: 'left', cursor: 'default' }}
                                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--panel-2)'; }}
                                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: isSelected ? 'var(--accent-soft)' : 'rgba(20,22,26,0.06)', color: isSelected ? 'var(--accent-ink)' : 'var(--muted)', display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700 }}>
                                    {s.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--accent-ink)' : 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.full_name}</div>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{s.role}</div>
                                  </div>
                                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Cart lines */}
          <div>
            {cart.length === 0 ? (
              <div style={{ padding: '32px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--muted)', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(20,22,26,0.04)', display: 'grid', placeItems: 'center' }}>
                  <ShoppingCart size={20} strokeWidth={1.4} />
                </div>
                <div style={{ fontSize: 13 }}>Cart is empty</div>
                <div style={{ fontSize: 11, color: 'var(--faint)' }}>Scan or click products to add</div>
              </div>
            ) : (
              <CartItemsList
                items={cart}
                onUpdateQuantity={updateCartItemQuantity}
                onSetQuantity={setCartItemQuantity}
                onUpdatePrice={updateCartItemPrice}
                onRemoveItem={removeFromCart}
              />
            )}
          </div>

          {/* Sticky payment footer */}
          <div style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>

          {/* Summary — only shows lines with non-zero values */}
          {(grossSubtotal > 0 || itemLevelDiscount > 0 || loyaltyDiscount > 0 || voucherDiscount > 0) && (
            <div className="pos-cart-summary" style={{ borderTop: '1px solid var(--line)', background: 'var(--panel-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Subtotal</span>
                <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>LKR {grossSubtotal.toFixed(2)}</span>
              </div>
              {itemLevelDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Discount</span>
                  <span className="num" style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>−LKR {itemLevelDiscount.toFixed(2)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loyalty</span>
                  <span className="num" style={{ fontSize: 12, color: '#D97706', fontWeight: 500 }}>−LKR {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}
              {voucherDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Voucher · <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{appliedVoucher?.code}</span></span>
                  <span className="num" style={{ fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>−LKR {voucherDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Loyalty redemption — only when customer has points */}
          {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
            <div style={{ borderTop: '1px solid var(--line-2)', background: '#FFFBEB', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={12} strokeWidth={2} style={{ color: '#F59E0B', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#92400E', fontWeight: 500 }}>{selectedCustomer.loyalty_points.toLocaleString()} pts</span>
              {!loyaltyRedeeming ? (
                <button
                  onClick={() => setLoyaltyRedeeming(true)}
                  style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)', fontWeight: 600, background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  Redeem
                </button>
              ) : (
                <>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      autoFocus
                      type="number" min={0} max={selectedCustomer.loyalty_points} step={1}
                      value={loyaltyPointsToRedeem || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const pts = Math.min(Number(e.target.value) || 0, selectedCustomer.loyalty_points);
                        setLoyaltyPointsToRedeem(pts);
                        setLoyaltyDiscount(pts);
                      }}
                      style={{ width: 60, height: 24, borderRadius: 5, border: '1px solid #FCD34D', padding: '0 6px', fontSize: 12, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", color: '#92400E', outline: 'none', background: '#FEF3C7' }}
                    />
                    <span style={{ fontSize: 11, color: '#92400E', whiteSpace: 'nowrap' }}>= LKR {loyaltyPointsToRedeem}</span>
                  </div>
                  <button
                    onClick={() => { setLoyaltyRedeeming(false); setLoyaltyPointsToRedeem(0); setLoyaltyDiscount(0); }}
                    style={{ color: 'var(--muted)', background: 'transparent', border: 0, padding: 0, lineHeight: 0, cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Gift voucher — collapsed by default */}
          <div style={{ borderTop: '1px solid var(--line-2)', background: 'var(--panel)' }}>
            {appliedVoucher ? (
              <div style={{ padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>🎁</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6f2c', fontFamily: "'JetBrains Mono',monospace" }}>{appliedVoucher.code}</span>
                <span style={{ fontSize: 11.5, color: '#a88540' }}>−LKR {Math.round(voucherDiscount).toLocaleString()}</span>
                <button onClick={() => setAppliedVoucher(null)} style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: '#a88540', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ) : showVoucherInput ? (
              <div style={{ padding: '7px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={voucherInput}
                  onChange={e => setVoucherInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && applyVoucher()}
                  placeholder="Voucher code…"
                  style={{ flex: 1, height: 28, border: '1px solid var(--line)', borderRadius: 6, padding: '0 8px', fontSize: 12, fontFamily: "'JetBrains Mono',monospace", outline: 'none', background: 'var(--panel-2)', letterSpacing: '0.04em', minWidth: 0 }}
                />
                <button onClick={applyVoucher} disabled={!voucherInput.trim() || voucherLoading} className="btn btn-sm" style={{ height: 28, fontSize: 11.5, flexShrink: 0 }}>
                  {voucherLoading ? '…' : 'Apply'}
                </button>
                <button onClick={() => { setShowVoucherInput(false); setVoucherInput(''); }} style={{ border: 0, background: 'transparent', color: 'var(--muted)', padding: 0, lineHeight: 0, flexShrink: 0 }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowVoucherInput(true)}
                style={{ width: '100%', padding: '6px 16px', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                <span style={{ fontSize: 13 }}>🎁</span>
                <span>Apply gift voucher</span>
              </button>
            )}
          </div>

          {/* Payment method + paid amount + change */}
          <div className="pos-cart-payment" style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginBottom: 8 }}>
              {(['cash', 'card', 'credit', 'mixed'] as const).map((m) => {
                const labels = { cash: 'Cash', card: 'Card', credit: 'Credit', mixed: 'Mixed' };
                const isA = paymentMethod === m;
                return (
                  <button key={m} onClick={() => {
                    setPaymentMethod(m);
                    if (m !== 'mixed') { setCashAmount(0); setCardAmount(0); }
                  }} style={{
                    padding: '7px 0', borderRadius: 7,
                    border: isA ? '1px solid var(--accent)' : '1px solid var(--line)',
                    background: isA ? 'var(--accent-soft)' : 'var(--panel)',
                    color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                    fontSize: 12, fontWeight: isA ? 600 : 500, cursor: 'default',
                  }}>{labels[m]}</button>
                );
              })}
            </div>

            {paymentMethod === 'mixed' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {([
                  { label: 'Cash', value: cashAmount, setter: (v: number) => { setCashAmount(v); setPaidAmount(v + cardAmount); } },
                  { label: 'Card', value: cardAmount, setter: (v: number) => { setCardAmount(v); setPaidAmount(cashAmount + v); } },
                ] as const).map(({ label, value, setter }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '0 12px', height: 34, background: 'var(--panel-2)' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, minWidth: 30 }}>{label} · LKR</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={value === 0 ? '' : value}
                      onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="num"
                      style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }}
                    />
                  </div>
                ))}
                {(cashAmount > 0 || cardAmount > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total entered</span>
                    <span className="num" style={{ fontSize: 12, fontWeight: 600, color: paidAmount >= total ? 'var(--accent)' : 'var(--warn)' }}>
                      LKR {paidAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '0 12px', height: 38, background: 'var(--panel-2)' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                  {paymentMethod === 'credit' ? 'Down Pay' : 'Paid'} · LKR
                </span>
                <input
                  type="number" step="0.01" min="0"
                  value={paidAmount === 0 ? '' : paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="num"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }}
                />
              </div>
            )}

            {paidAmount > 0 && (changeAmount > 0 || paidAmount < total) && (
              <div style={{
                marginTop: 8, padding: '7px 10px', borderRadius: 7,
                background: changeAmount > 0 ? 'var(--accent-soft)' : 'var(--warn-soft)',
                color: changeAmount > 0 ? 'var(--accent-ink)' : 'var(--warn)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 12, fontWeight: 500, gap: 10,
              }}>
                <span>{changeAmount > 0 ? 'Change due' : 'Balance due'}</span>
                <span className="num" style={{ fontWeight: 700 }}>LKR {(changeAmount > 0 ? changeAmount : total - paidAmount).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Charge button */}
          <div className="pos-cart-charge" style={{ borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
            <button
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || processing}
              style={{
                width: '100%', height: 46, borderRadius: 10, border: 0,
                background: cart.length === 0 || processing ? 'rgba(20,22,26,0.1)' : 'var(--accent)',
                color: cart.length === 0 || processing ? 'var(--muted)' : '#fff',
                fontSize: 14, fontWeight: 600,
                cursor: cart.length === 0 || processing ? 'not-allowed' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: cart.length === 0 || processing ? 'none' : '0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(27,107,79,0.25)',
                transition: 'all .12s ease',
              }}
              onMouseEnter={(e) => { if (cart.length > 0 && !processing) e.currentTarget.style.background = 'var(--accent-ink)'; }}
              onMouseLeave={(e) => { if (cart.length > 0 && !processing) e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {processing ? 'Processing…' : `Charge · LKR ${total.toFixed(2)}`}
            </button>
            <button
              onClick={() => {
                setIssueVoucherForm({
                  amount: voucherRules ? String(voucherRules.rewardAmount) : '',
                  name: selectedCustomer?.name ?? '',
                  phone: selectedCustomer?.phone ?? '',
                });
                setShowIssueVoucher(true);
              }}
              style={{
                marginTop: 8, width: '100%', height: 34, borderRadius: 8,
                border: '1px solid var(--line)', background: 'transparent',
                color: 'var(--ink-2)', fontSize: 12.5, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, transition: 'all .12s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--panel-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)'; }}
            >
              🎁 Issue Voucher
            </button>
          </div>
          </div>{/* end sticky payment footer */}
        </aside>
      </div>

      {/* Mobile Cart Drawer - Visible only on mobile when toggled */}
      {cartDrawerOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setCartDrawerOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl border-t border-slate-200 flex flex-col max-h-[90vh] sm:max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Fixed Header */}
            <div className="px-4 sm:px-6 pt-4 pb-3 flex justify-between items-center border-b border-slate-200 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-900">Sale Details</h3>
              <button onClick={() => setCartDrawerOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition" title="Close">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6">
              {/* Customer & Agent Group */}
              <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Info</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Customer (Optional)</label>
                  <div className="flex gap-2 items-stretch">
                    <select
                      value={selectedCustomer?.id || ''}
                      onChange={(e) => {
                        const customer = customers.find((c) => c.id === e.target.value);
                        setSelectedCustomer(customer || null);
                      }}
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                      title="Select customer"
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
                      className="flex-shrink-0 p-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition"
                      title="Add new customer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Referral Agent (Optional)</label>
                  <div className="flex gap-2 items-stretch">
                    <select
                      value={selectedReferralAgent?.id || ''}
                      onChange={(e) => {
                        const agent = referralAgents.find((a) => a.id === e.target.value);
                        setSelectedReferralAgent(agent || null);
                      }}
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm"
                      title="Select referral agent"
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
                      className="flex-shrink-0 p-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition"
                      title="Add new referral agent"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {selectedCustomer && (
                <LoyaltyPanel
                  customer={selectedCustomer}
                  totalAmount={effectiveSubtotal}
                  earnRate={earnRate}
                  onRedeemChange={(pts, discount) => { setLoyaltyPointsToRedeem(pts); setLoyaltyDiscount(discount); }}
                />
              )}

              {/* Payment & Charges Group */}
              <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-slate-900" />
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment & Charges</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-2">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm transition appearance-none bg-white hover:border-slate-400"
                      title="Select payment method"
                    >
                      <option value="cash">Cash Payment</option>
                      <option value="card">Card Payment</option>
                      <option value="credit">Credit Sale</option>
                      <option value="mixed">Mixed Payment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={taxRate === 0 ? '' : taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm bg-white"
                      placeholder="0"
                      title="Enter tax rate"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">Service Charge</label>
                    <input
                      type="number"
                      step="0.01"
                      value={serviceCharge === 0 ? '' : serviceCharge}
                      onChange={(e) => setServiceCharge(parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-sm bg-white"
                      placeholder="0.00"
                      title="Enter service charge"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-2">
                      {paymentMethod === 'credit' ? 'Down Payment / Partial Pay' : 'Paid Amount'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paidAmount === 0 ? '' : paidAmount}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      min="0"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none text-base sm:text-lg font-bold bg-white"
                      placeholder="0.00"
                      title="Enter paid amount"
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

                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-xs text-amber-400">
                    <span>Loyalty Discount:</span>
                    <span>-LKR {loyaltyDiscount.toFixed(2)}</span>
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

              {/* Cart Section */}
              <div className="border-t border-slate-200 pt-5">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-900">Cart ({cart.length})</h4>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                      title="Clear all items from cart"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Add Manual Item Button */}
                <button
                  onClick={() => { setManualItemForm({ description: '', price: 0, quantity: 1 }); setShowManualItemModal(true); }}
                  className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition text-sm font-medium"
                >
                  <Tag className="w-4 h-4" />
                  Add Manual Item
                </button>

                <div className="-mx-4 sm:-mx-6 px-4 sm:px-6">
                  <CartItemsList
                    items={cart}
                    onUpdateQuantity={updateCartItemQuantity}
                    onSetQuantity={setCartItemQuantity}
                    onUpdatePrice={updateCartItemPrice}
                    onRemoveItem={removeFromCart}
                  />
                </div>
              </div>
            </div>

            {/* Fixed Footer - Sticky Checkout Button */}
            <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-white/95 pt-3 px-4 sm:px-6 pb-4 sm:pb-6 border-t border-slate-200 flex-shrink-0 space-y-2">
              <button
                onClick={handleCompleteSale}
                disabled={cart.length === 0 || processing}
                className="w-full py-3.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base min-h-[48px] shadow-lg"
                title={cart.length === 0 ? 'Add items to cart first' : 'Complete the sale'}
              >
                {processing ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Toggle Button */}
      {!cartDrawerOpen && (
        <button
          onClick={() => setCartDrawerOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-slate-800 transition z-30 min-h-[48px] min-w-[48px]"
          title="Show cart"
        >
          <DollarSign className="w-6 h-6" />
          <span className="font-bold text-lg">{cart.length}</span>
        </button>
      )}

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

      <Modal isOpen={showIssueVoucher} onClose={() => setShowIssueVoucher(false)} title="Issue Gift Voucher" size="sm">
        {(() => {
          const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', outline: 'none', boxSizing: 'border-box' };
          const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };
          return (
            <form onSubmit={(e) => { e.preventDefault(); handleIssueVoucherFromPOS(); }} style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {voucherRules && (
                <div style={{ padding: '8px 10px', borderRadius: 7, background: 'color-mix(in oklab, #C9A84C 10%, var(--panel-2))', border: '1px solid rgba(201,168,76,0.35)', fontSize: 12, color: '#8a6f2c' }}>
                  Standard reward: <strong>LKR {voucherRules.rewardAmount.toLocaleString()}</strong> on purchases ≥ LKR {voucherRules.minPurchase.toLocaleString()}
                </div>
              )}
              <div>
                <label style={labelStyle}>Amount (LKR) *</label>
                <input
                  required autoFocus type="number" min={1} step={1}
                  style={{ ...inputStyle, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace" }}
                  value={issueVoucherForm.amount}
                  onChange={e => setIssueVoucherForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={labelStyle}>Recipient Name</label>
                <input
                  style={inputStyle}
                  value={issueVoucherForm.name}
                  onChange={e => setIssueVoucherForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={selectedCustomer?.name ?? 'Optional'}
                />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp Phone</label>
                <input
                  style={inputStyle} type="tel"
                  value={issueVoucherForm.phone}
                  onChange={e => setIssueVoucherForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+94 7x xxx xxxx"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowIssueVoucher(false)} className="btn" style={{ flex: 1, height: 38, fontSize: 13, background: 'var(--panel-2)', color: 'var(--ink-2)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={issuingVoucher || !issueVoucherForm.amount} className="btn btn-primary" style={{ flex: 2, height: 38, fontSize: 13 }}>
                  {issuingVoucher ? 'Issuing…' : '🎁 Issue Voucher'}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add Customer" size="md">
        {(() => {
          const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', outline: 'none', boxSizing: 'border-box' };
          const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };
          return (
            <form onSubmit={handleCustomerSubmit} style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input required autoFocus style={inputStyle} value={customerFormData.name} onChange={e => setCustomerFormData(p => ({ ...p, name: e.target.value }))} placeholder="Customer name" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" value={customerFormData.phone} onChange={e => setCustomerFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+94 7x xxx xxxx" />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} type="email" value={customerFormData.email} onChange={e => setCustomerFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={customerFormData.address} onChange={e => setCustomerFormData(p => ({ ...p, address: e.target.value }))} placeholder="City / district" />
                </div>
                <div>
                  <label style={labelStyle}>Credit Limit (LKR)</label>
                  <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} value={customerFormData.credit_limit} onChange={e => setCustomerFormData(p => ({ ...p, credit_limit: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <input style={inputStyle} value={customerFormData.notes} onChange={e => setCustomerFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Internal note" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowCustomerModal(false)} className="btn">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Customer</button>
              </div>
            </form>
          );
        })()}
      </Modal>

      <Modal isOpen={showAgentModal} onClose={() => setShowAgentModal(false)} title="Add Sales Staff" size="md">
        {(() => {
          const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', outline: 'none', boxSizing: 'border-box' };
          const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };
          return (
            <form onSubmit={handleAgentSubmit} style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Full Name *</label>
                  <input required autoFocus style={inputStyle} value={agentFormData.name} onChange={e => setAgentFormData(p => ({ ...p, name: e.target.value }))} placeholder="Staff name" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} type="tel" value={agentFormData.phone} onChange={e => setAgentFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+94 7x xxx xxxx" />
                </div>
                <div>
                  <label style={labelStyle}>Commission Rate (%)</label>
                  <input required style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} max={100} step={0.1} value={agentFormData.commission_rate} onChange={e => setAgentFormData(p => ({ ...p, commission_rate: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowAgentModal(false)} className="btn">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Staff</button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Manual Item Modal */}
      <Modal isOpen={showManualItemModal} onClose={() => setShowManualItemModal(false)} title="Add Manual Item" size="sm">
        {(() => {
          const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', outline: 'none', boxSizing: 'border-box' };
          const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };
          return (
            <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Description *</label>
                <input
                  autoFocus required style={inputStyle}
                  placeholder="e.g. Repair Charge, Delivery Fee"
                  value={manualItemForm.description}
                  onChange={e => setManualItemForm(p => ({ ...p, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addManualItem()}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Unit Price (LKR) *</label>
                  <input
                    type="number" step="0.01" min="0" placeholder="0.00"
                    style={{ ...inputStyle, textAlign: 'right' }}
                    value={manualItemForm.price === 0 ? '' : manualItemForm.price}
                    onChange={e => setManualItemForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={e => e.key === 'Enter' && addManualItem()}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input
                    type="number" min="1" placeholder="1"
                    style={{ ...inputStyle, textAlign: 'right' }}
                    value={manualItemForm.quantity}
                    onChange={e => setManualItemForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    onKeyDown={e => e.key === 'Enter' && addManualItem()}
                  />
                </div>
              </div>
              {manualItemForm.price > 0 && manualItemForm.quantity > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line-2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Total</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                    LKR {(manualItemForm.price * manualItemForm.quantity).toFixed(2)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowManualItemModal(false)} className="btn">Cancel</button>
                <button type="button" onClick={addManualItem} className="btn btn-primary">Add to Cart</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {variantPickerProduct && (
        <VariantPicker
          product={variantPickerProduct}
          variants={variantPickerVariants}
          onSelect={addToCartFromVariant}
          onClose={() => { setVariantPickerProduct(null); setVariantPickerVariants([]); }}
        />
      )}
    </>
  );
}
