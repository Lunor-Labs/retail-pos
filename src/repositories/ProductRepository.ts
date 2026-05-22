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
     * Find all products with their stock, correctly aggregated through variants.
     * product_batches links to variant_id (not product_id), so we join via variants.
     */
    async findAllWithStock(): Promise<ProductWithStock[]> {
        const CHUNK_SIZE = 1000;
        const client = (this.adapter as any).getClient();

        // 1. Fetch all active products in chunks
        let allProducts: Product[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const chunk = await this.adapter.query<Product>(this.tableName, {
                where: [{ field: 'active', operator: '=', value: true }],
                orderBy: [{ field: 'sku', direction: 'asc' }],
                offset: from,
                limit: CHUNK_SIZE,
            });
            allProducts = [...allProducts, ...chunk];
            if (chunk.length < CHUNK_SIZE) hasMore = false;
            else from += CHUNK_SIZE;
        }

        if (allProducts.length === 0) return [];

        // 2. Fetch all active variants
        const { data: allVariants, error: varErr } = await client
            .from('product_variants')
            .select('*')
            .eq('active', true);
        if (varErr) throw new Error(`Failed to fetch variants: ${varErr.message}`);

        // 3. Fetch all batches (linked to variants, not products)
        const { data: allBatches, error: batErr } = await client
            .from('product_batches')
            .select('*, supplier:suppliers(name)');
        if (batErr) throw new Error(`Failed to fetch batches: ${batErr.message}`);

        // 4. Group variants by product_id
        const variantsByProduct = new Map<string, any[]>();
        for (const v of (allVariants as any[]) || []) {
            if (!variantsByProduct.has(v.product_id)) variantsByProduct.set(v.product_id, []);
            variantsByProduct.get(v.product_id)!.push(v);
        }

        // 5. Group batches by variant_id
        const batchesByVariant = new Map<string, ProductBatch[]>();
        for (const b of (allBatches as any[]) || []) {
            if (!batchesByVariant.has(b.variant_id)) batchesByVariant.set(b.variant_id, []);
            batchesByVariant.get(b.variant_id)!.push(b as ProductBatch);
        }

        // 6. Build ProductWithStock[] — flatten all variant batches onto each product
        return allProducts.map(product => {
            const variants = variantsByProduct.get(product.id) || [];
            const flatBatches: ProductBatch[] = [];
            let totalStock = 0;
            let basePrice = 0;

            for (const v of variants) {
                const vBatches = batchesByVariant.get(v.id) || [];
                for (const b of vBatches) {
                    flatBatches.push(b);
                    totalStock += b.current_quantity;
                    if (basePrice === 0 || b.selling_price < basePrice) basePrice = b.selling_price;
                }
            }

            return { ...product, batches: flatBatches, total_stock: totalStock, base_price: basePrice } as ProductWithStock;
        });
    }

    /**
     * Find a product with its batches, correctly aggregated through variants.
     */
    async findByIdWithStock(id: string): Promise<ProductWithStock | null> {
        const product = await this.findById(id);
        if (!product) return null;

        const client = (this.adapter as any).getClient();

        const { data: variants } = await client
            .from('product_variants')
            .select('*')
            .eq('product_id', id)
            .eq('active', true);

        const variantIds = ((variants as any[]) || []).map((v: any) => v.id);
        let batches: ProductBatch[] = [];
        if (variantIds.length > 0) {
            const { data: batchData } = await client
                .from('product_batches')
                .select('*, supplier:suppliers(name)')
                .in('variant_id', variantIds);
            batches = (batchData as ProductBatch[]) || [];
        }

        const total_stock = batches.reduce((sum, b) => sum + b.current_quantity, 0);
        const base_price = batches.length > 0 ? Math.min(...batches.map(b => b.selling_price)) : 0;

        return { ...product, batches, total_stock, base_price } as ProductWithStock;
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
