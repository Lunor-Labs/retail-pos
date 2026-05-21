import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { Product, ProductBatch, ProductWithStock } from '../types';
import { expandSearchTerm, generateOrQuery } from '../utils/searchUtils';

/**
 * Repository for Product-related database operations
 */
export class ProductRepository extends BaseRepository<Product> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'products');
    }

    /**
     * Find all products with their stock batches
     * Optimized to avoid N+1 query problem
     * Uses chunked fetching to handle more than 1000 products
     */
    async findAllWithStock(): Promise<ProductWithStock[]> {
        const CHUNK_SIZE = 1000;

        // 1. Fetch all active products in chunks
        let allProducts: Product[] = [];
        let fromProduct = 0;
        let hasMoreProducts = true;

        while (hasMoreProducts) {
            const chunk = await this.adapter.query<Product>(this.tableName, {
                where: [{ field: 'active', operator: '=', value: true }],
                orderBy: [{ field: 'sku', direction: 'asc' }],
                offset: fromProduct,
                limit: CHUNK_SIZE,
            });

            allProducts = [...allProducts, ...chunk];

            if (chunk.length < CHUNK_SIZE) {
                hasMoreProducts = false;
            } else {
                fromProduct += CHUNK_SIZE;
            }
        }

        if (allProducts.length === 0) {
            return [];
        }

        // 2. Fetch ALL batches in chunks with supplier join
        let allBatches: ProductBatch[] = [];
        let fromBatch = 0;
        let hasMoreBatches = true;

        while (hasMoreBatches) {
            const chunk = await this.adapter.query<ProductBatch>('product_batches', {
                select: '*, supplier:suppliers(name)', // Join supplier information
                orderBy: [{ field: 'received_date', direction: 'desc' }],
                offset: fromBatch,
                limit: CHUNK_SIZE,
            });

            allBatches = [...allBatches, ...chunk];

            if (chunk.length < CHUNK_SIZE) {
                hasMoreBatches = false;
            } else {
                fromBatch += CHUNK_SIZE;
            }
        }

        // 3. Group batches by product_id in memory (via variant_id join — cast since schema changed)
        const batchesByProduct = new Map<string, ProductBatch[]>();
        for (const batch of allBatches as any[]) {
            const pid: string = batch.product_id ?? batch.variant_id ?? '';
            if (!batchesByProduct.has(pid)) {
                batchesByProduct.set(pid, []);
            }
            batchesByProduct.get(pid)!.push(batch);
        }

        // 4. Combine products with their batches
        const productsWithStock = allProducts.map((product) => {
            const batches = batchesByProduct.get(product.id) || [];
            const total_stock = batches.reduce((sum, batch) => sum + batch.current_quantity, 0);

            return {
                ...product,
                batches,
                total_stock,
            } as ProductWithStock;
        });

        return productsWithStock;
    }

    /**
     * Find a product with its batches
     */
    async findByIdWithStock(id: string): Promise<ProductWithStock | null> {
        const product = await this.findById(id);
        if (!product) return null;

        const batches = await this.findBatchesByProductId(id);
        const total_stock = batches.reduce((sum, batch) => sum + batch.current_quantity, 0);

        return {
            ...product,
            batches,
            total_stock,
        } as ProductWithStock;
    }

    /**
     * Find product by SKU
     */
    async findBySku(sku: string): Promise<Product | null> {
        const results = await this.query({
            where: [{ field: 'sku', operator: '=', value: sku }],
            limit: 1,
        });

        return results[0] || null;
    }

    /**
     * Find product by barcode
     */
    async findByBarcode(barcode: string): Promise<Product | null> {
        const results = await this.query({
            where: [{ field: 'barcode', operator: '=', value: barcode }],
            limit: 1,
        });

        return results[0] || null;
    }

    /**
     * Search products by name
     */
    async searchByName(searchTerm: string): Promise<Product[]> {
        // Use the raw client to perform an OR query with synonyms
        // This is necessary because the base repository query helper doesn't support complex OR conditions easily
        const client = (this.adapter as any).getClient();



        const terms = expandSearchTerm(searchTerm);
        const orQuery = generateOrQuery('name', terms);

        if (!orQuery) return [];

        const { data, error } = await client
            .from(this.tableName)
            .select('*')
            .eq('active', true)
            .or(orQuery);

        if (error) {
            throw new Error(`Search failed: ${error.message}`);
        }

        return data as Product[];
    }

    /**
     * Find batches for a product
     */
    /**
     * Find batches for a product
     */
    async findBatchesByProductId(productId: string): Promise<ProductBatch[]> {
        return this.adapter.query<ProductBatch>('product_batches', {
            select: '*, supplier:suppliers(name)', // Join supplier information
            where: [{ field: 'product_id', operator: '=', value: productId }],
            orderBy: [{ field: 'received_date', direction: 'desc' }],
        });
    }

    /**
     * Get low stock products
     */
    async findLowStock(threshold: number = 10): Promise<ProductWithStock[]> {
        const allProducts = await this.findAllWithStock();
        return allProducts.filter(p => p.total_stock <= threshold);
    }

    /**
     * Update product stock (via batch)
     */
    async updateStock(batchId: string, quantity: number): Promise<void> {
        await this.adapter.update('product_batches', batchId, {
            current_quantity: quantity,
        });
    }
}
