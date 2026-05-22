import { useState, useEffect } from 'react';
import { Plus, Upload, Filter, Download, PackageOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useProducts, SearchType, StockFilter } from '../hooks/useProducts';
import { ProductWithStock } from '../types';
import { BarcodeGenerator } from './BarcodeGenerator';
import { ProductTable } from './products/ProductTable';
import { ProductForm } from './products/ProductForm';
import { ProductDetailsView } from './products/ProductDetailsView';
import { ProductImporter } from './products/ProductImporter';
import { AddProductPage, DefaultPricing } from './products/AddProductPage';
import { productService, supplierService } from '../services';
import { VariantGrid } from './products/VariantGrid';
import { useVariants } from '../hooks/useVariants';
import { Product } from '../types';
import { logger } from '../lib/logger';
import { Modal, SearchBar, LoadingSpinner, EmptyState, Pagination } from './ui';
import { playScannerBeep } from '../utils/audio';
import { useRef } from 'react';

function ProductVariantSection({ product }: { product: Product }) {
  const { variants, loading, addVariant, updateVariant } = useVariants(product.id);
  if (loading) return <p className="text-xs text-slate-400 p-3">Loading variants…</p>;
  return (
    <VariantGrid
      product={product}
      variants={variants}
      onAddVariant={data => addVariant({ ...data, product_id: product.id })}
      onUpdateVariant={updateVariant}
    />
  );
}

interface ProductsProps {
  initialStockFilter?: StockFilter;
}

export function Products({ initialStockFilter = 'all' }: ProductsProps) {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>(initialStockFilter);

  const { products, loading, refetch, totalPages } = useProducts(page, pageSize, debouncedSearch, searchType, stockFilter);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [showAddStockInView, setShowAddStockInView] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    brand: '',
    gender: '',
    material: '',
    unit: 'piece',
    image_url: '',
    initial_quantity: 0,
    cost_price: 0,
    markup_percentage: 0,
    selling_price: 0,
    supplier_id: '',
  });
  const [barcodeProduct, setBarcodeProduct] = useState<ProductWithStock | null>(null);
  const [scanningBarcode, setScanningBarcode] = useState(false);

  // Full-page add/edit view state
  const [pageView, setPageView] = useState<'list' | 'add' | 'edit'>('list');
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [rememberedBrand, setRememberedBrand] = useState('');
  const [rememberedPricing, setRememberedPricing] = useState<DefaultPricing | undefined>(undefined);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept scanner if a major modal is open (except our own Add/Edit modal)
      if (showImportModal || (showModal && modalMode === 'view')) return;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Scanning logic: Scanners are much faster than manual typing (usually < 50ms)
      const isFastInput = diff < 50;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 3) {
          e.preventDefault();

          if (showModal && (modalMode === 'add' || modalMode === 'edit')) {
            setScanningBarcode(false);
            playScannerBeep();
            showToast('Barcode scanned — assign it in the Variants tab.', 'info');
          } else {
            // Global scan - decide what to do
            handleGlobalScan(barcodeBuffer);
          }

          setBarcodeBuffer('');
          return;
        }
        setBarcodeBuffer('');
        return;
      }

      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        // High-speed detection OR first character of a potential sequence
        if (barcodeBuffer === '' || isFastInput || diff < 100) {
          setBarcodeBuffer((prev) => prev + e.key);
        } else {
          // Slow typing - reset buffer to current key unless we are explicitly in "Scan" mode
          if (!scanningBarcode) {
            setBarcodeBuffer(e.key);
          } else {
            setBarcodeBuffer((prev) => prev + e.key);
          }
        }

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
  }, [showModal, modalMode, scanningBarcode, barcodeBuffer, showImportModal]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reset to page 1 on search
      setDebouncedSearch(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      const data = await supplierService.getActiveSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  }

  function resetForm() {
    setFormData({
      sku: '',
      name: '',
      description: '',
      category: '',
      brand: '',
      gender: '',
      material: '',
      unit: 'piece',
      image_url: '',
      initial_quantity: 0,
      cost_price: 0,
      markup_percentage: 0,
      selling_price: 0,
      supplier_id: '',
    });
    setSelectedProduct(null);
    setScanningBarcode(false);
  }

  async function openAddModal(_barcode?: string) {
    resetForm();
    setModalMode('add');
    setShowModal(true);

    try {
      const nextSku = await productService.generateNextSku();
      setFormData(prev => ({ ...prev, sku: nextSku }));
    } catch (error) {
      console.error('Failed to generate next SKU:', error);
    }
  }

  function openEditModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      brand: (product as any).brand || '',
      gender: (product as any).gender || '',
      material: (product as any).material || '',
      unit: product.unit || 'piece',
      image_url: product.image_url || '',
      initial_quantity: 0,
      cost_price: 0,
      markup_percentage: 0,
      selling_price: 0,
      supplier_id: '',
    });
    setModalMode('edit');
    setShowModal(true);
  }

  function openViewModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setModalMode('view');
    setShowModal(true);
    setShowAddStockInView(false);
  }

  function openAddStockModal(product: ProductWithStock) {
    setSelectedProduct(product);
    setModalMode('view');
    setShowModal(true);
    setShowAddStockInView(true);
  }

  function openAddPage() {
    setPageView('add');
    setEditProductId(null);
  }

  function openEditPage(product: ProductWithStock) {
    setEditProductId(product.id);
    setPageView('edit');
  }

  function closePage() {
    setPageView('list');
    setEditProductId(null);
    refetch();
  }

  function handleSaveAndNext(brand: string, pricing: DefaultPricing) {
    setRememberedBrand(brand);
    setRememberedPricing(pricing);
    refetch();
    setEditProductId(null);
    setPageView('list');
    setTimeout(() => setPageView('add'), 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (modalMode === 'add') {
        await productService.createProduct({
          ...formData,
          initial_quantity: formData.initial_quantity || 0,
          cost_price: formData.cost_price || 0,
          markup_percentage: formData.markup_percentage || 0,
          selling_price: formData.selling_price || 0,
          supplier_id: formData.supplier_id || null,
        } as any);
        showToast('Product added successfully!', 'success');
      } else if (selectedProduct) {
        await productService.updateProduct(selectedProduct.id, formData as any);
        showToast('Product updated successfully!', 'success');
      }

      setShowModal(false);
      resetForm();
      refetch();
    } catch (error: any) {
      let message = error.message || 'Failed to save product';

      // Handle unique constraint errors from database or service
      if (message.toLowerCase().includes('unique constraint') || message.toLowerCase().includes('already exists') || message.toLowerCase().includes('already in use')) {
        if (message.toLowerCase().includes('barcode')) {
          message = 'This barcode is already assigned to another product.';
        } else if (message.toLowerCase().includes('sku')) {
          message = 'This SKU is already in use by another product.';
        }
      }

      showToast(message, 'error');
    }
  }

  async function handleGlobalScan(barcode: string) {
    try {
      const product = await productService.findByBarcode(barcode);
      if (product) {
        // Product exists - open view modal
        const fullProduct = await productService.getProductById(product.id);
        if (fullProduct) {
          openViewModal(fullProduct);
          playScannerBeep();
          showToast(`Found: ${fullProduct.name}`, 'success');
        }
      } else {
        // New product - open add page
        openAddPage();
        playScannerBeep();
        showToast('New product detected!', 'info');
      }
    } catch (error) {
      console.error('Scan error:', error);
      showToast('Error processing scan', 'error');
    }
  }

  async function handleExportCSV() {
    try {
      const allProducts = await productService.getAllProducts();

      // Flatten products to rows (one row per batch)
      const csvRows: any[] = [];

      for (const product of allProducts) {
        if (product.batches && product.batches.length > 0) {
          // Create a row for each batch
          // Sort batches by received date (newest first)
          const sortedBatches = [...product.batches].sort((a, b) =>
            new Date(b.received_date).getTime() - new Date(a.received_date).getTime()
          );

          for (const batch of sortedBatches) {
            csvRows.push({
              product_name: product.name,
              sku: product.sku,
              category: product.category || '',
              brand: (product as any).brand || '',
              gender: (product as any).gender || '',
              material: (product as any).material || '',
              supplier_name: batch.supplier?.name || '',
              cost_price: batch.cost_price || 0,
              markup_percentage: batch.markup_percentage || 0,
              selling_price: batch.selling_price || 0,
              quantity: batch.current_quantity || 0,
              batch_number: batch.batch_number || '',
              unit: product.unit || 'piece',
              image_url: product.image_url || '',
            });
          }
        } else {
          csvRows.push({
            product_name: product.name,
            sku: product.sku,
            category: product.category || '',
            brand: (product as any).brand || '',
            gender: (product as any).gender || '',
            material: (product as any).material || '',
            supplier_name: '',
            cost_price: 0,
            markup_percentage: 0,
            selling_price: 0,
            quantity: 0,
            batch_number: '',
            unit: product.unit || 'piece',
            image_url: product.image_url || '',
          });
        }
      }

      if (csvRows.length === 0) {
        showToast('No data to export', 'info');
        return;
      }

      // Create CSV content
      const headers = Object.keys(csvRows[0]);
      const csvContent = [
        headers.join(','),
        ...csvRows.map(row =>
          headers.map(header => {
            const val = row[header];
            // Escape quotes and wrap string values in quotes
            if (typeof val === 'string') {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Exported ${csvRows.length} rows successfully!`, 'success');
    } catch (error) {
      logger.error('Failed to export products', error as Error);
      showToast('Failed to export products. Please try again.', 'error');
    }
  }

  function handlePrintBarcode(product: ProductWithStock) {
    setBarcodeProduct(product);
  }

  if (pageView === 'add' || pageView === 'edit') {
    return (
      <AddProductPage
        mode={pageView}
        productId={editProductId ?? undefined}
        onSave={closePage}
        onCancel={closePage}
        initialBrand={rememberedBrand}
        initialPricing={rememberedPricing}
        onSaveAndNext={pageView === 'add' ? handleSaveAndNext : undefined}
      />
    );
  }

  if (loading && products.length === 0) {
    return <LoadingSpinner message="Loading products..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Products</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>Manage inventory, pricing, and stock levels.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button onClick={() => setShowImportModal(true)} className="btn" style={{ height: 36 }}>
                <Upload size={14} /> Import CSV
              </button>
              <button onClick={handleExportCSV} className="btn" style={{ height: 36 }}>
                <Download size={14} /> Export CSV
              </button>
              <button onClick={openAddPage} className="btn btn-primary" style={{ height: 36 }}>
                <Plus size={14} /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters card */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={
              searchType === 'name' ? 'Search by name…' :
                searchType === 'sku' ? 'Search by SKU…' :
                  searchType === 'barcode' ? 'Scan barcode…' :
                    'Search by name, SKU, or barcode…'
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)' }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Stock</span>
              <select value={stockFilter} onChange={(e) => { setPage(1); setStockFilter(e.target.value as StockFilter); }}
                style={{ appearance: 'none', border: 0, background: 'transparent', fontSize: 12.5, color: 'var(--ink)', fontWeight: 500, outline: 'none', cursor: 'default' }}>
                <option value="all">All stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel)' }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Search</span>
              <select value={searchType} onChange={(e) => setSearchType(e.target.value as SearchType)}
                style={{ appearance: 'none', border: 0, background: 'transparent', fontSize: 12.5, color: 'var(--ink)', fontWeight: 500, outline: 'none', cursor: 'default' }}>
                <option value="all">Smart search</option>
                <option value="name">Name only</option>
                <option value="sku">SKU only</option>
                <option value="barcode">Barcode</option>
              </select>
            </div>
          </SearchBar>
        </div>
      </div>

      {products.length === 0 && !loading ? (
        <EmptyState
          icon={PackageOpen}
          title="No products found"
          description={debouncedSearch ? `No products match "${debouncedSearch}"` : "You haven't added any products yet."}
          action={!debouncedSearch ? { label: 'Add Your First Product', onClick: openAddPage } : undefined}
        />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="overflow-x-auto">
            <ProductTable
              products={products as ProductWithStock[]}
              onEdit={openEditPage}
              onAddStock={openEditPage}
              onPrintBarcode={handlePrintBarcode}
              isAdmin={isAdmin}
            />
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages || 1}
            onPageChange={setPage}
            className="p-4"
            style={{ borderTop: '1px solid var(--line)', background: 'var(--panel-2)' }}
          />
        </div>
      )}

      {/* Main Product Action Modal (Add/Edit/View) */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalMode === 'add' ? 'Add New Product' :
            modalMode === 'edit' ? 'Edit Product' :
              selectedProduct?.name || 'Product Details'
        }
        size={modalMode === 'view' ? '4xl' : '3xl'}
      >
        {modalMode === 'view' && selectedProduct ? (
          <>
            <ProductDetailsView
              product={selectedProduct}
              defaultShowAddStock={showAddStockInView}
              onClose={() => setShowModal(false)}
              onUpdate={refetch}
            />
            <div className="px-6 pb-6 border-t border-slate-200 mt-4 pt-4">
              <ProductVariantSection product={selectedProduct} />
            </div>
          </>
        ) : (
          <ProductForm
            mode={modalMode as 'add' | 'edit'}
            formData={formData as any}
            onChange={(data) => setFormData(data as any)}
            onSubmit={handleSubmit}
            onCancel={() => setShowModal(false)}
            suppliers={suppliers}
            scanningBarcode={scanningBarcode}
            onStartBarcodeScanning={() => setScanningBarcode(!scanningBarcode)}
            onSupplierAdded={loadSuppliers}
          />
        )}
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Products from CSV"
        size="2xl"
      >
        <ProductImporter
          onSuccess={() => {
            setShowImportModal(false);
            refetch();
          }}
          onClose={() => setShowImportModal(false)}
        />
      </Modal>

      {/* Barcode Printing Modal */}
      {barcodeProduct && (
        <BarcodeGenerator
          barcode={barcodeProduct.sku}
          productName={barcodeProduct.name}
          sku={barcodeProduct.sku}
          price={barcodeProduct.batches[0]?.selling_price}
          onClose={() => setBarcodeProduct(null)}
        />
      )}
    </div>
  );
}
