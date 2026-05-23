import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { ProductVariant, VariantWithStock, ProductBatch } from '../types';

export class VariantRepository extends BaseRepository<ProductVariant> {
  constructor(adapter: DatabaseAdapter) {
    super(adapter, 'product_variants');
  }

  async findByProductId(productId: string): Promise<VariantWithStock[]> {
    const variants = await this.query({
      where: [{ field: 'product_id', operator: '=', value: productId }],
      orderBy: [{ field: 'size', direction: 'asc' }],
    });

    if (variants.length === 0) return [];

    const variantIds = variants.map(v => v.id);
    const client = (this.adapter as any).getClient();
    const { data: batches, error } = await client
      .from('product_batches')
      .select('*, supplier:suppliers(name)')
      .in('variant_id', variantIds);

    if (error) throw new Error(`Failed to fetch variant batches: ${error.message}`);

    const batchesByVariant = new Map<string, ProductBatch[]>();
    for (const batch of (batches as ProductBatch[])) {
      const vid = (batch as any).variant_id as string;
      if (!batchesByVariant.has(vid)) batchesByVariant.set(vid, []);
      batchesByVariant.get(vid)!.push(batch);
    }

    return variants.map(v => {
      const vBatches = batchesByVariant.get(v.id) || [];
      return {
        ...v,
        batches: vBatches,
        total_stock: vBatches.reduce((sum, b) => sum + b.current_quantity, 0),
      };
    });
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    const results = await this.query({
      where: [{ field: 'barcode', operator: '=', value: barcode }],
      limit: 1,
    });
    return results[0] || null;
  }

  async findBySku(sku: string): Promise<ProductVariant | null> {
    const results = await this.query({
      where: [{ field: 'sku', operator: '=', value: sku }],
      limit: 1,
    });
    return results[0] || null;
  }

  async findLowStock(): Promise<Array<VariantWithStock & { product_name: string }>> {
    const client = (this.adapter as any).getClient();
    const { data: variants, error } = await client
      .from('product_variants')
      .select('*, product:products(name)')
      .eq('active', true);

    if (error) throw new Error(`Low stock query failed: ${error.message}`);

    const variantIds = (variants as any[]).map(v => v.id);
    const { data: batches } = await client
      .from('product_batches')
      .select('variant_id, current_quantity')
      .in('variant_id', variantIds);

    const stockMap = new Map<string, number>();
    for (const b of (batches as any[]) || []) {
      stockMap.set(b.variant_id, (stockMap.get(b.variant_id) || 0) + Number(b.current_quantity));
    }

    return (variants as any[])
      .map(v => ({
        ...v,
        batches: [],
        total_stock: stockMap.get(v.id) || 0,
        product_name: v.product?.name || '',
      }))
      .filter(v => v.total_stock <= v.reorder_level);
  }
}
