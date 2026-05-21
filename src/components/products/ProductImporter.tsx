import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Download, AlertCircle, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui';
import { useToast } from '../../contexts/ToastContext';

interface ProductImporterProps {
    onClose: () => void;
    onSuccess: () => void;
}

interface CSVRow {
    product_name: string;
    sku: string;
    barcode?: string;
    category?: string;
    supplier_name: string;
    cost_price: string;
    markup_percentage: string;
    quantity: string;
    batch_number?: string;
    expiry_date?: string;
    reorder_level?: string;
    unit?: string;
    image_url?: string;
}

interface ImportStats {
    total: number;
    success: number;
    failed: number;
    errors: string[];
}

export function ProductImporter({ onClose, onSuccess }: ProductImporterProps) {
    const { showToast } = useToast();
    const [previewData, setPreviewData] = useState<CSVRow[]>([]);
    const [processedCount, setProcessedCount] = useState(0);
    const [stats, setStats] = useState<ImportStats>({ total: 0, success: 0, failed: 0, errors: [] });
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTemplate = () => {
        const headers = [
            'product_name', 'sku', 'barcode', 'category', 'supplier_name',
            'cost_price', 'markup_percentage', 'quantity', 'batch_number', 'expiry_date',
            'reorder_level', 'unit', 'image_url'
        ];
        const sampleData = [
            'Engine Oil 4L,OIL-4L,12345678,Lubricants,Shell Lanka,4500,22,10,BATCH001,2025-12-31,5,bottle,https://example.com/oil.jpg'
        ];

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + sampleData.join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "inventory_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            parseCSV(file);
        }
    };

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setPreviewData(results.data as CSVRow[]);
                setStep('preview');
            },
            error: (error) => {
                showToast('Error parsing CSV: ' + error.message, 'error');
            }
        });
    };

    const processImport = async () => {
        setStep('importing');
        setProcessedCount(0);
        let successCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // 1. Extract and Process Suppliers in Bulk
        const supplierNames = [...new Set(previewData.map(row => row.supplier_name?.trim()).filter(Boolean))];
        const supplierMap = new Map<string, string>(); // Name -> ID

        try {
            // Bulk fetch existing suppliers
            const { data: existingSuppliers, error: fetchError } = await (supabase
                .from('suppliers')
                .select('id, name')
                .in('name', supplierNames) as any);

            if (fetchError) throw fetchError;

            (existingSuppliers as any[])?.forEach(s => supplierMap.set(s.name, s.id));

            // Create missing suppliers
            for (const supplierName of supplierNames) {
                if (!supplierMap.has(supplierName)) {
                    const { data: newSupplier, error: insertError } = await supabase
                        .from('suppliers')
                        .insert({ name: supplierName, active: true } as any)
                        .select('id')
                        .single() as any;

                    if (insertError) {
                        errors.push(`Failed to create supplier '${supplierName}': ${insertError.message}`);
                        continue;
                    }
                    if (newSupplier) supplierMap.set(supplierName, newSupplier.id);
                }
            }
        } catch (err: any) {
            errors.push(`Supplier processing error: ${err.message}`);
        }

        // 2. Process Products and Batches in Chunks
        const CHUNK_SIZE = 5; // Smaller chunks for better progress visibility
        for (let i = 0; i < previewData.length; i += CHUNK_SIZE) {
            const chunk = previewData.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (row: CSVRow) => {
                try {
                    // Validation
                    if (!row.product_name || !row.sku || !row.cost_price || !row.markup_percentage) {
                        throw new Error(`Missing required fields for SKU: ${row.sku || 'Unknown'}`);
                    }

                    const supplierId = supplierMap.get(row.supplier_name?.trim());
                    if (!supplierId) {
                        throw new Error(`Supplier '${row.supplier_name}' not found or failed to create`);
                    }

                    const cleanSku = row.sku.trim();

                    // Check Product
                    let productId = '';
                    const { data: existingProduct } = await supabase
                        .from('products')
                        .select('id, image_url')
                        .eq('sku', cleanSku)
                        .single() as any;

                    const productData = {
                        name: row.product_name.trim(),
                        category: row.category || 'Uncategorized',
                        description: `Imported/Updated via CSV`,
                        unit: row.unit || 'piece',
                        active: true,
                        updated_at: new Date().toISOString()
                    };

                    if (existingProduct) {
                        productId = existingProduct.id;

                        const updateData = {
                            ...productData,
                            image_url: row.image_url || existingProduct.image_url,
                        };

                        const { error: updateError } = await (supabase.from('products') as any)
                            .update(updateData)
                            .eq('id', productId);

                        if (updateError) throw updateError;
                    } else {
                        // Create Product
                        const { data: newProduct, error: prodError } = await supabase
                            .from('products')
                            .insert({
                                sku: cleanSku,
                                ...productData,
                                image_url: row.image_url || null,
                                created_at: new Date().toISOString()
                            } as any)
                            .select('id')
                            .single() as any;

                        if (prodError) throw prodError;
                        productId = newProduct.id;
                    }

                    // Create or Update Batch
                    const qty = parseInt(row.quantity || '0');
                    const costPrice = parseFloat(row.cost_price);
                    const markup = parseFloat(row.markup_percentage);
                    const sellingPrice = costPrice * (1 + markup / 100);

                    if (qty >= 0) {
                        let batchNumber = row.batch_number?.trim();
                        let existingBatchId = null;

                        if (batchNumber) {
                            // Check for specific batch
                            const { data: batch } = await (supabase
                                .from('product_batches') as any)
                                .select('id')
                                .eq('batch_number', batchNumber)
                                .single();
                            if (batch) existingBatchId = batch.id;
                        } else {
                            // No batch number provided - find the most recent batch to update if qty is 0,
                            // or create a new one if qty > 0
                            if (qty === 0) {
                                const { data: latestBatch } = await (supabase
                                    .from('product_batches') as any)
                                    .select('id, batch_number')
                                    .order('received_date', { ascending: false })
                                    .limit(1)
                                    .single();

                                if (latestBatch) {
                                    existingBatchId = latestBatch.id;
                                    batchNumber = latestBatch.batch_number;
                                }
                            }

                            if (!batchNumber) {
                                batchNumber = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                            }
                        }

                        const baseBatchData = {
                            variant_id: null, // variant association done after variant management is active
                            supplier_id: supplierId,
                            batch_number: batchNumber,
                            cost_price: costPrice,
                            markup_percentage: markup,
                            selling_price: Math.round(sellingPrice * 100) / 100,
                            current_quantity: qty,
                            updated_at: new Date().toISOString()
                        };

                        if (existingBatchId) {
                            // On update, we NEVER touch initial_quantity
                            const { error: batchError } = await (supabase.from('product_batches') as any)
                                .update(baseBatchData)
                                .eq('id', existingBatchId);

                            if (batchError) throw batchError;
                        } else if (qty > 0) {
                            // On insert, we set initial_quantity
                            const { error: batchError } = await supabase
                                .from('product_batches')
                                .insert({
                                    ...baseBatchData,
                                    initial_quantity: qty,
                                    received_date: new Date().toISOString(),
                                    created_at: new Date().toISOString()
                                } as any);

                            if (batchError) throw batchError;
                        }
                    }

                    successCount++;
                } catch (err: any) {
                    failedCount++;
                    errors.push(`Row ${row.sku}: ${err.message}`);
                } finally {
                    setProcessedCount(prev => prev + 1);
                }
            }));
        }

        setStats({
            total: previewData.length,
            success: successCount,
            failed: failedCount,
            errors
        });
        setStep('complete');
        if (successCount > 0) {
            onSuccess();
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Import Inventory"
            size="xl"
        >
            <div className="p-6">
                {step === 'upload' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-blue-700">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div className="text-sm">
                                <p className="font-semibold mb-1">Before you start:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Download the template to see the required format.</li>
                                    <li>Make sure SKU is unique for new products.</li>
                                    <li>Existing suppliers will be matched by name.</li>
                                </ul>
                            </div>
                        </div>

                        <div
                            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileUpload}
                            />
                            <Upload className="w-12 h-12 text-slate-400 mb-3" />
                            <p className="font-medium text-slate-900">Click to upload CSV</p>
                            <p className="text-sm text-slate-500 mt-1">or drag and drop here</p>
                        </div>

                        <button
                            onClick={handleDownloadTemplate}
                            className="w-full flex items-center justify-center gap-2 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
                        >
                            <Download className="w-4 h-4" />
                            Download CSV Template
                        </button>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-900">Preview: {previewData.length} rows found</p>
                            <button onClick={() => setStep('upload')} className="text-sm text-slate-500 hover:text-slate-700">
                                Change File
                            </button>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left border-b">SKU</th>
                                        <th className="px-4 py-2 text-left border-b">Product</th>
                                        <th className="px-4 py-2 text-left border-b">Supplier</th>
                                        <th className="px-4 py-2 text-right border-b">Cost</th>
                                        <th className="px-4 py-2 text-right border-b">Markup %</th>
                                        <th className="px-4 py-2 text-right border-b">Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.slice(0, 5).map((row, i) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-2">{row.sku}</td>
                                            <td className="px-4 py-2 truncate max-w-[150px]">{row.product_name}</td>
                                            <td className="px-4 py-2">{row.supplier_name}</td>
                                            <td className="px-4 py-2 text-right">{row.cost_price}</td>
                                            <td className="px-4 py-2 text-right">{row.markup_percentage}%</td>
                                            <td className="px-4 py-2 text-right">{row.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {previewData.length > 5 && (
                                <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t">
                                    +{previewData.length - 5} more rows...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 'importing' && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <p className="text-lg font-medium text-slate-900">Importing Data...</p>
                        <div className="w-full max-w-md mt-6">
                            <div className="flex justify-between text-sm text-slate-600 mb-2">
                                <span>{Math.round((processedCount / previewData.length) * 100)}% Complete</span>
                                <span>{processedCount} of {previewData.length} items</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                    style={{ width: `${(processedCount / previewData.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                        <p className="text-slate-500 mt-4">Processing products and stock levels.</p>
                    </div>
                )}

                {step === 'complete' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Import Complete</h3>
                            <p className="text-slate-600 mt-1">
                                Successfully imported {stats.success} of {stats.total} items.
                            </p>
                        </div>

                        {stats.failed > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="font-bold text-red-800 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {stats.failed} Errors Occurred
                                </p>
                                <ul className="text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                                    {stats.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
                {step !== 'importing' && step !== 'complete' && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                    >
                        Cancel
                    </button>
                )}

                {step === 'preview' && (
                    <button
                        onClick={processImport}
                        className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition"
                    >
                        Import {previewData.length} Items
                    </button>
                )}

                {step === 'complete' && (
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition"
                    >
                        Close
                    </button>
                )}
            </div>
        </Modal>
    );
}
