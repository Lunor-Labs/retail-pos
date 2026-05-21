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
import { productService, supplierService } from '../services';
import { logger } from '../lib/logger';
import { Modal, SearchBar, LoadingSpinner, EmptyState, Pagination } from './ui';
import { playScannerBeep } from '../utils/audio';
import { useRef } from 'react';

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
            // We are already in a form, just fill the barcode
            setFormData(prev => ({ ...prev, barcode: barcodeBuffer }));
            setScanningBarcode(false);
            playScannerBeep();
            showToast('Barcode captured!', 'success');
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

  async function openAddModal(barcode?: string) {
    resetForm();
    setModalMode('add');
    setShowModal(true);

    if (barcode) {
      setFormData(prev => ({ ...prev, barcode }));
    }

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
        // New product - open add modal
        openAddModal(barcode);
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

  if (loading && products.length === 0) {
    return <LoadingSpinner message="Loading products..." />;
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-600 mt-1">Manage inventory items and stock levels</p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition shadow-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => openAddModal()}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add Product
            </button>
          )}
        </div>
      </div>

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder={
          searchType === 'name' ? "Search by name (e.g. 'Toyota Filter')..." :
            searchType === 'sku' ? "Search by SKU..." :
              searchType === 'barcode' ? "Scan barcode..." :
                "Search by name, SKU, or barcode..."
        }
      >
        <div className="relative">
          <select
            value={stockFilter}
            onChange={(e) => {
              setPage(1);
              setStockFilter(e.target.value as StockFilter);
            }}
            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
          >
            <option value="all">All Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <Filter className="w-4 h-4" />
          </div>
        </div>

        <div className="relative">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as SearchType)}
            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
          >
            <option value="all">Smart Search</option>
            <option value="name">Name Only</option>
            <option value="sku">SKU Only</option>
            <option value="barcode">Barcode</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
            <Filter className="w-4 h-4" />
          </div>
        </div>
      </SearchBar>

      {products.length === 0 && !loading ? (
        <EmptyState
          icon={PackageOpen}
          title="No products found"
          description={debouncedSearch ? `No products match "${debouncedSearch}"` : "You haven't added any products yet."}
          action={!debouncedSearch ? { label: 'Add Your First Product', onClick: openAddModal } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <ProductTable
              products={products as any}
              onView={openViewModal}
              onEdit={openEditModal}
              onAddStock={openAddStockModal}
              onPrintBarcode={handlePrintBarcode}
              isAdmin={isAdmin}
            />
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages || 1}
            onPageChange={setPage}
            className="p-4 border-t border-slate-200 bg-slate-50"
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
          <ProductDetailsView
            product={selectedProduct}
            defaultShowAddStock={showAddStockInView}
            onClose={() => setShowModal(false)}
            onUpdate={refetch}
          />
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
