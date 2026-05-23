import { ProductRepository } from '../repositories/ProductRepository';
import { Product, ProductWithStock, ProductWithVariants } from '../types';
import { logger } from '../lib/logger';

export interface VariantInput {
  size: string | null;
  color: string | null;
  sku: string;
  barcode: string | null;
  reorder_level: number;
  qty: number;
  selling_price: number;
  cost_price: number;
  markup_percentage: number;
  supplier_id: string;
}

/**
 * Product service - handles product business logic
 */
export class ProductService {
    constructor(private productRepo: ProductRepository) { }

    /**
     * Get all products with stock information
     */
    async getAllProducts(): Promise<ProductWithStock[]> {
        try {
            logger.info('Fetching all products with stock');
            const start = Date.now();

            const products = await this.productRepo.findAllWithStock();

            logger.performance('getAllProducts', Date.now() - start, {
                count: products.length,
            });

            return products;
        } catch (error) {
            logger.error('Failed to fetch products', error as Error);
            throw new Error('Unable to load products. Please try again.');
        }
    }

    /**
     * Get a single product by ID with stock
     */
    async getProductById(id: string): Promise<ProductWithStock | null> {
        try {
            logger.debug('Fetching product by ID', { productId: id });

            const product = await this.productRepo.findByIdWithStock(id);

            if (!product) {
                logger.warn('Product not found', { productId: id });
            }

            return product;
        } catch (error) {
            logger.error('Failed to fetch product', error as Error, { productId: id });
            throw new Error('Unable to load product details.');
        }
    }

    /**
     * Search products by name
     */
    async searchProducts(searchTerm: string): Promise<Product[]> {
        try {
            logger.debug('Searching products', { searchTerm });

            if (!searchTerm || searchTerm.trim().length < 2) {
                return [];
            }

            const products = await this.productRepo.searchByName(searchTerm.trim());

            logger.debug('Search completed', {
                searchTerm,
                resultsCount: products.length,
            });

            return products;
        } catch (error) {
            logger.error('Product search failed', error as Error, { searchTerm });
            throw new Error('Search failed. Please try again.');
        }
    }

    /**
     * Find product by SKU
     */
    async findBySku(sku: string): Promise<Product | null> {
        try {
            logger.debug('Finding product by SKU', { sku });
            return await this.productRepo.findBySku(sku);
        } catch (error) {
            logger.error('Failed to find product by SKU', error as Error, { sku });
            throw new Error('Unable to find product.');
        }
    }

    /**
     * Find product by barcode
     */
    async findByBarcode(barcode: string): Promise<Product | null> {
        try {
            logger.debug('Finding product by barcode', { barcode });
            return await this.productRepo.findByBarcode(barcode);
        } catch (error) {
            logger.error('Failed to find product by barcode', error as Error, { barcode });
            throw new Error('Unable to find product.');
        }
    }

    /**
     * Get batches for a product
     */
    async getProductBatches(productId: string): Promise<any[]> {
        try {
            logger.debug('Fetching batches for product', { productId });
            return await this.productRepo.findBatchesByProductId(productId);
        } catch (error) {
            logger.error('Failed to fetch product batches', error as Error, { productId });
            return [];
        }
    }

    /**
     * Create a new product
     */
    async createProduct(productData: Partial<Product>): Promise<Product> {
        try {
            logger.info('Creating new product', { name: productData.name, sku: productData.sku });

            // Validate required fields
            this.validateProductData(productData);

            // Process and validate unique fields
            const sku = (productData as any).sku?.trim() || null;

            // Check for duplicate SKU
            if (sku) {
                const existing = await this.productRepo.findBySku(sku);
                if (existing) {
                    throw new Error(`Product with SKU "${sku}" already exists.`);
                }
            } else {
                throw new Error('SKU is required.');
            }

            // Separate batch data from product data
            const {
                initial_quantity,
                cost_price,
                markup_percentage,
                selling_price,
                supplier_id,
                ...pureProductData
            } = productData as any;

            const product = await this.productRepo.create({
                ...pureProductData,
                sku,
                active: true,
                created_at: new Date().toISOString(),
            });

            // If initial stock is provided, create a batch
            if (initial_quantity && initial_quantity > 0) {
                const finalMarkup = markup_percentage !== undefined ? markup_percentage :
                    (cost_price > 0 ? ((selling_price - cost_price) / cost_price) * 100 : 0);

                await this.createBatch({
                    product_id: product.id,
                    supplier_id: supplier_id || null,
                    initial_quantity,
                    current_quantity: initial_quantity,
                    cost_price: cost_price || 0,
                    markup_percentage: parseFloat(finalMarkup.toFixed(2)),
                    selling_price: selling_price || 0,
                    received_date: new Date().toISOString().split('T')[0],
                    batch_number: `B-${Date.now()}`,
                });
                logger.info('Initial batch created for new product', { productId: product.id, quantity: initial_quantity });
            }

            logger.info('Product created successfully', {
                productId: product.id,
                name: product.name,
                sku: product.sku,
            });

            return product;
        } catch (error) {
            logger.error('Failed to create product', error as Error, { productData });
            throw error;
        }
    }

    /**
     * Update an existing product
     */
    async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
        try {
            logger.info('Updating product', { productId: id });

            // Check if product exists
            const existing = await this.productRepo.findById(id);
            if (!existing) {
                throw new Error('Product not found.');
            }

            // Process and validate unique fields if they are being updated
            const sku = updates.sku !== undefined ? (updates.sku?.trim() || null) : undefined;

            // Validate SKU uniqueness if changing
            if (sku !== undefined && sku !== existing.sku) {
                if (sku === null) {
                    throw new Error('SKU cannot be empty.');
                }
                const duplicate = await this.productRepo.findBySku(sku);
                if (duplicate && duplicate.id !== id) {
                    throw new Error(`SKU "${sku}" is already in use.`);
                }
            }

            // Strip batch fields that don't belong in products table
            const {
                initial_quantity,
                cost_price,
                markup_percentage,
                selling_price,
                supplier_id,
                ...pureUpdates
            } = updates as any;

            const productObject: any = {
                ...pureUpdates,
                updated_at: new Date().toISOString(),
            };
            if (sku !== undefined) productObject.sku = sku;

            const product = await this.productRepo.update(id, productObject);

            logger.info('Product updated successfully', { productId: id });

            return product;
        } catch (error) {
            logger.error('Failed to update product', error as Error, { productId: id, updates });
            throw error;
        }
    }

    /**
     * Delete a product (soft delete by setting active = false)
     */
    async deleteProduct(id: string): Promise<void> {
        try {
            logger.info('Deleting product', { productId: id });

            const product = await this.productRepo.findByIdWithStock(id);
            if (!product) {
                throw new Error('Product not found.');
            }

            // Check if product has stock
            if (product.total_stock > 0) {
                throw new Error('Cannot delete product with existing stock. Please remove all stock first.');
            }

            await this.productRepo.update(id, {
                active: false,
                updated_at: new Date().toISOString(),
            } as Partial<Product>);

            logger.info('Product deleted successfully', { productId: id });
        } catch (error) {
            logger.error('Failed to delete product', error as Error, { productId: id });
            throw error;
        }
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts(threshold: number = 10): Promise<ProductWithStock[]> {
        try {
            logger.info('Fetching low stock products', { threshold });

            const products = await this.productRepo.findLowStock(threshold);

            logger.info('Low stock products retrieved', {
                count: products.length,
                threshold,
            });

            return products;
        } catch (error) {
            logger.error('Failed to fetch low stock products', error as Error, { threshold });
            throw new Error('Unable to load low stock products.');
        }
    }

    /**
     * Update product stock
     */
    async updateStock(batchId: string, quantity: number): Promise<void> {
        try {
            logger.info('Updating product stock', { batchId, quantity });

            if (quantity < 0) {
                throw new Error('Stock quantity cannot be negative.');
            }

            await this.productRepo.updateStock(batchId, quantity);

            logger.info('Stock updated successfully', { batchId, quantity });
        } catch (error) {
            logger.error('Failed to update stock', error as Error, { batchId, quantity });
            throw error;
        }
    }

    /**
     * Validate product data
     */
    private validateProductData(data: Partial<Product>): void {
        if (!data.name || data.name.trim().length === 0) {
            throw new Error('Product name is required.');
        }

        if (!data.sku || data.sku.trim().length === 0) {
            throw new Error('SKU is required.');
        }
    }

    /**
     * Generate next SKU
     */
    async generateNextSku(brand: string = '', category: string = ''): Promise<string> {
        try {
            const alpha = (s: string) => s.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
            const brandPart = alpha(brand);
            const catPart = alpha(category);

            const prefix = [brandPart, catPart].filter(Boolean).join('-') || 'P';

            const client = (this.productRepo as any).adapter.getClient();
            const { data } = await client
                .from('products')
                .select('sku')
                .like('sku', `${prefix}-%`);

            let maxNum = 0;
            const pattern = new RegExp(`^${prefix.replace(/-/g, '\\-')}-(\\d{3})$`);
            for (const row of (data as any[]) || []) {
                const m = row.sku.match(pattern);
                if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
            }

            const next = (maxNum + 1).toString().padStart(3, '0');
            return `${prefix}-${next}`;
        } catch (error) {
            logger.error('Failed to generate SKU', error as Error);
            return 'P-' + Date.now().toString().slice(-3).padStart(3, '0');
        }
    }

    /**
     * Create product batch (add stock)
     */
    async createBatch(batchData: any): Promise<void> {
        try {
            const client = (this.productRepo as any).adapter.getClient();
            const { error } = await client.from('product_batches').insert(batchData);
            if (error) throw error;
        } catch (error) {
            logger.error('Failed to create batch', error as Error);
            throw error;
        }
    }

    /**
     * Update product batch
     */
    async updateBatch(batchId: string, updates: any): Promise<void> {
        try {
            const client = (this.productRepo as any).adapter.getClient();
            const { error } = await client
                .from('product_batches')
                .update(updates)
                .eq('id', batchId);
            if (error) throw error;
        } catch (error) {
            logger.error('Failed to update batch', error as Error);
            throw error;
        }
    }

    async createProductWithVariants(
        productData: { sku: string; name: string; description?: string; category?: string; brand?: string; gender?: string; material?: string; unit?: string; image_url?: string },
        variants: VariantInput[]
    ): Promise<Product> {
        try {
            if (!productData.name?.trim()) throw new Error('Product name is required.');
            if (!productData.sku?.trim()) throw new Error('SKU is required.');
            if (variants.length === 0) throw new Error('At least one variant is required.');

            const existing = await this.productRepo.findBySku(productData.sku.trim());
            if (existing) throw new Error(`SKU "${productData.sku}" already exists.`);

            const client = (this.productRepo as any).adapter.getClient();

            const { data: product, error: prodErr } = await client
                .from('products')
                .insert({
                    sku: productData.sku.trim(),
                    name: productData.name.trim(),
                    description: productData.description || null,
                    category: productData.category || null,
                    brand: productData.brand || null,
                    gender: productData.gender || null,
                    material: productData.material || null,
                    unit: productData.unit || 'piece',
                    image_url: productData.image_url || null,
                    active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();
            if (prodErr) throw prodErr;

            for (const v of variants) {
                const { data: variant, error: varErr } = await client
                    .from('product_variants')
                    .insert({
                        product_id: product.id,
                        size: v.size || null,
                        color: v.color || null,
                        sku: v.sku.trim(),
                        barcode: v.barcode || null,
                        reorder_level: v.reorder_level || 0,
                        active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .select()
                    .single();
                if (varErr) throw varErr;

                if (v.qty > 0) {
                    const { error: batErr } = await client.from('product_batches').insert({
                        variant_id: variant.id,
                        supplier_id: v.supplier_id,
                        batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
                        cost_price: v.cost_price,
                        markup_percentage: v.markup_percentage,
                        selling_price: v.selling_price,
                        initial_quantity: v.qty,
                        current_quantity: v.qty,
                        received_date: new Date().toISOString().split('T')[0],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                    if (batErr) throw batErr;
                }
            }

            return product as Product;
        } catch (error) {
            logger.error('Failed to create product with variants', error as Error);
            throw error;
        }
    }

    async getProductWithVariants(id: string): Promise<ProductWithVariants | null> {
        try {
            const client = (this.productRepo as any).adapter.getClient();

            const { data: product, error: prodErr } = await client
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
            if (prodErr || !product) return null;

            const { data: variants, error: varErr } = await client
                .from('product_variants')
                .select('*')
                .eq('product_id', id)
                .eq('active', true)
                .order('size', { ascending: true });
            if (varErr) throw varErr;

            const variantIds = ((variants as any[]) || []).map((v: any) => v.id);
            let allBatches: any[] = [];
            if (variantIds.length > 0) {
                const { data: batchData } = await client
                    .from('product_batches')
                    .select('*, supplier:suppliers(name)')
                    .in('variant_id', variantIds);
                allBatches = batchData || [];
            }

            const batchesByVariant = new Map<string, any[]>();
            for (const b of allBatches) {
                if (!batchesByVariant.has(b.variant_id)) batchesByVariant.set(b.variant_id, []);
                batchesByVariant.get(b.variant_id)!.push(b);
            }

            let totalStock = 0;
            let basePrice = 0;
            const variantsWithStock = ((variants as any[]) || []).map(v => {
                const batches = batchesByVariant.get(v.id) || [];
                const stock = batches.reduce((s: number, b: any) => s + b.current_quantity, 0);
                totalStock += stock;
                for (const b of batches) {
                    if (basePrice === 0 || b.selling_price < basePrice) basePrice = b.selling_price;
                }
                return { ...v, batches, total_stock: stock };
            });

            return { ...product, variants: variantsWithStock, total_stock: totalStock, base_price: basePrice } as ProductWithVariants;
        } catch (error) {
            logger.error('Failed to get product with variants', error as Error);
            return null;
        }
    }

    async updateProductWithVariants(
        id: string,
        productData: { name: string; description?: string; category?: string; brand?: string; gender?: string; material?: string; unit?: string; image_url?: string },
        newVariants: VariantInput[]
    ): Promise<void> {
        try {
            const client = (this.productRepo as any).adapter.getClient();

            const { error: prodErr } = await client
                .from('products')
                .update({
                    name: productData.name.trim(),
                    description: productData.description || null,
                    category: productData.category || null,
                    brand: productData.brand || null,
                    gender: productData.gender || null,
                    material: productData.material || null,
                    unit: productData.unit || 'piece',
                    image_url: productData.image_url || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);
            if (prodErr) throw prodErr;

            for (const v of newVariants) {
                const { data: variant, error: varErr } = await client
                    .from('product_variants')
                    .insert({
                        product_id: id,
                        size: v.size || null,
                        color: v.color || null,
                        sku: v.sku.trim(),
                        barcode: v.barcode || null,
                        reorder_level: v.reorder_level || 0,
                        active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .select()
                    .single();
                if (varErr) throw varErr;

                if (v.qty > 0) {
                    const { error: batErr } = await client.from('product_batches').insert({
                        variant_id: variant.id,
                        supplier_id: v.supplier_id,
                        batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
                        cost_price: v.cost_price,
                        markup_percentage: v.markup_percentage,
                        selling_price: v.selling_price,
                        initial_quantity: v.qty,
                        current_quantity: v.qty,
                        received_date: new Date().toISOString().split('T')[0],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                    if (batErr) throw batErr;
                }
            }
        } catch (error) {
            logger.error('Failed to update product with variants', error as Error);
            throw error;
        }
    }
}
