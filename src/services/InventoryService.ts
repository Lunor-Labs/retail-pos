import { ProductRepository } from '../repositories/ProductRepository';
import { ProductBatch } from '../types';
import { logger } from '../lib/logger';
import { DatabaseAdapter } from '../repositories/base/DatabaseAdapter';

export interface StockAdjustment {
    batchId: string;
    quantity: number;
    reason: 'sale' | 'return' | 'adjustment' | 'damage';
}

/**
 * Inventory service - handles stock management business logic
 */
export class InventoryService {
    constructor(
        private productRepo: ProductRepository,
        private adapter: DatabaseAdapter
    ) { }

    /**
     * Deduct stock for a sale
     */
    async deductStock(items: Array<{ batch_id: string; quantity: number }>): Promise<void> {
        try {
            logger.info('Deducting stock for sale', { itemCount: items.length });

            for (const item of items) {
                // Get current batch
                const batches = await this.adapter.query<ProductBatch>('product_batches', {
                    where: [{ field: 'id', operator: '=', value: item.batch_id }],
                });

                const batch = batches[0];
                if (!batch) {
                    throw new Error(`Batch ${item.batch_id} not found.`);
                }

                // Check if sufficient stock
                if (batch.current_quantity < item.quantity) {
                    throw new Error(
                        `Insufficient stock for batch ${batch.batch_number}. Available: ${batch.current_quantity}, Required: ${item.quantity}`
                    );
                }

                // Deduct stock
                const newQuantity = batch.current_quantity - item.quantity;
                await this.productRepo.updateStock(item.batch_id, newQuantity);

                logger.debug('Stock deducted', {
                    batchId: item.batch_id,
                    batchNumber: batch.batch_number,
                    quantityDeducted: item.quantity,
                    remainingStock: newQuantity,
                });
            }

            logger.info('Stock deduction completed successfully');
        } catch (error) {
            logger.error('Failed to deduct stock', error as Error, { items });
            throw error;
        }
    }

    /**
     * Add stock for a return
     */
    async addStock(items: Array<{ batch_id: string; quantity: number }>): Promise<void> {
        try {
            logger.info('Adding stock for return', { itemCount: items.length });

            for (const item of items) {
                // Get current batch
                const batches = await this.adapter.query<ProductBatch>('product_batches', {
                    where: [{ field: 'id', operator: '=', value: item.batch_id }],
                });

                const batch = batches[0];
                if (!batch) {
                    throw new Error(`Batch ${item.batch_id} not found.`);
                }

                // Add stock
                const newQuantity = batch.current_quantity + item.quantity;
                await this.productRepo.updateStock(item.batch_id, newQuantity);

                logger.debug('Stock added', {
                    batchId: item.batch_id,
                    batchNumber: batch.batch_number,
                    quantityAdded: item.quantity,
                    newStock: newQuantity,
                });
            }

            logger.info('Stock addition completed successfully');
        } catch (error) {
            logger.error('Failed to add stock', error as Error, { items });
            throw error;
        }
    }

    /**
     * Adjust stock (manual adjustment)
     */
    async adjustStock(adjustments: StockAdjustment[]): Promise<void> {
        try {
            logger.info('Adjusting stock', {
                adjustmentCount: adjustments.length,
            });

            for (const adjustment of adjustments) {
                // Get current batch
                const batches = await this.adapter.query<ProductBatch>('product_batches', {
                    where: [{ field: 'id', operator: '=', value: adjustment.batchId }],
                });

                const batch = batches[0];
                if (!batch) {
                    throw new Error(`Batch ${adjustment.batchId} not found.`);
                }

                // Validate new quantity
                if (adjustment.quantity < 0) {
                    throw new Error('Stock quantity cannot be negative.');
                }

                // Update stock
                await this.productRepo.updateStock(adjustment.batchId, adjustment.quantity);

                logger.info('Stock adjusted', {
                    batchId: adjustment.batchId,
                    batchNumber: batch.batch_number,
                    oldQuantity: batch.current_quantity,
                    newQuantity: adjustment.quantity,
                    reason: adjustment.reason,
                });
            }

            logger.info('Stock adjustments completed successfully');
        } catch (error) {
            logger.error('Failed to adjust stock', error as Error, { adjustments });
            throw error;
        }
    }

    /**
     * Check stock availability for items
     */
    async checkStockAvailability(
        items: Array<{ batch_id: string; quantity: number }>
    ): Promise<{ available: boolean; issues: string[] }> {
        try {
            logger.debug('Checking stock availability', { itemCount: items.length });

            const issues: string[] = [];

            for (const item of items) {
                const batches = await this.adapter.query<ProductBatch>('product_batches', {
                    where: [{ field: 'id', operator: '=', value: item.batch_id }],
                });

                const batch = batches[0];
                if (!batch) {
                    issues.push(`Batch ${item.batch_id} not found.`);
                    continue;
                }

                if (batch.current_quantity < item.quantity) {
                    issues.push(
                        `Insufficient stock for batch ${batch.batch_number}. Available: ${batch.current_quantity}, Required: ${item.quantity}`
                    );
                }
            }

            const available = issues.length === 0;

            logger.debug('Stock availability check completed', {
                available,
                issueCount: issues.length,
            });

            return { available, issues };
        } catch (error) {
            logger.error('Failed to check stock availability', error as Error, { items });
            throw new Error('Unable to check stock availability.');
        }
    }

    /**
     * Get low stock alerts
     */
    async getLowStockAlerts(threshold: number = 5): Promise<Array<{
        productId: string;
        productName: string;
        currentStock: number;
        minStock: number;
    }>> {
        try {
            logger.info('Fetching low stock alerts', { threshold });

            const products = await this.productRepo.findLowStock(threshold);

            const alerts = products
                .filter(p => p.total_stock <= threshold)
                .map(p => ({
                    productId: p.id,
                    productName: p.name,
                    currentStock: p.total_stock,
                    minStock: threshold,
                }));

            logger.info('Low stock alerts retrieved', { alertCount: alerts.length });

            return alerts;
        } catch (error) {
            logger.error('Failed to fetch low stock alerts', error as Error);
            throw new Error('Unable to load low stock alerts.');
        }
    }
}
