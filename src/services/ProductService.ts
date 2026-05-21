import { ProductRepository } from '../repositories/ProductRepository';
import { Product, ProductWithStock } from '../types';
import { logger } from '../lib/logger';

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
    async generateNextSku(): Promise<string> {
        try {
            const client = (this.productRepo as any).adapter.getClient();
            const { data, error } = await client
                .from('products')
                .select('sku')
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) return 'SKU-0001';

            const lastSku = (data[0] as any).sku;
            const match = lastSku.match(/(\d+)$/);

            if (!match) return `${lastSku}-0001`;

            const lastNumber = parseInt(match[0]);
            const nextNumber = lastNumber + 1;
            const numberPart = nextNumber.toString().padStart(match[0].length, '0');

            return lastSku.substring(0, lastSku.length - match[0].length) + numberPart;
        } catch (error) {
            logger.error('Failed to generate SKU', error as Error);
            return 'SKU-' + Date.now().toString().slice(-6);
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
}
