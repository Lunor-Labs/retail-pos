import { VariantRepository } from '../repositories/VariantRepository';
import { ProductVariant, VariantWithStock } from '../types';
import { logger } from '../lib/logger';

export class VariantService {
  constructor(private variantRepo: VariantRepository) {}

  async getVariantsForProduct(productId: string): Promise<VariantWithStock[]> {
    try {
      return await this.variantRepo.findByProductId(productId);
    } catch (error) {
      logger.error('Failed to fetch variants', error as Error, { productId });
      throw new Error('Unable to load product variants.');
    }
  }

  async createVariant(data: {
    product_id: string;
    size: string | null;
    color: string | null;
    sku: string;
    barcode?: string | null;
    reorder_level?: number;
  }): Promise<ProductVariant> {
    try {
      const existing = await this.variantRepo.findBySku(data.sku);
      if (existing) throw new Error(`SKU "${data.sku}" is already in use.`);

      return await this.variantRepo.create({
        product_id: data.product_id,
        size: data.size || null,
        color: data.color || null,
        sku: data.sku,
        barcode: data.barcode || null,
        reorder_level: data.reorder_level ?? 0,
        active: true,
      });
    } catch (error) {
      logger.error('Failed to create variant', error as Error);
      throw error;
    }
  }

  async updateVariant(id: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
    try {
      return await this.variantRepo.update(id, data);
    } catch (error) {
      logger.error('Failed to update variant', error as Error);
      throw new Error('Unable to update variant.');
    }
  }

  async findByBarcode(barcode: string): Promise<ProductVariant | null> {
    return this.variantRepo.findByBarcode(barcode);
  }

  async getLowStockVariants(): Promise<Array<VariantWithStock & { product_name: string }>> {
    try {
      return await this.variantRepo.findLowStock();
    } catch (error) {
      logger.error('Failed to fetch low stock variants', error as Error);
      return [];
    }
  }
}
