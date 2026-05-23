import { PurchaseOrderRepository } from '../repositories/PurchaseOrderRepository';
import { PurchaseOrder } from '../types';
import { logger } from '../lib/logger';
import { ProductService } from './ProductService';

export interface CreatePurchaseOrderInput {
    supplier_id: string;
    expected_date?: string | null;
    notes?: string | null;
    items: {
        product_id: string;
        quantity: number;
        unit_cost: number;
    }[];
}

export class PurchaseOrderService {
    constructor(
        private purchaseOrderRepo: PurchaseOrderRepository,
        private productService: ProductService
    ) { }

    async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
        try {
            return await this.purchaseOrderRepo.findAllWithDetails();
        } catch (error) {
            logger.error('Failed to fetch purchase orders', error as Error);
            throw new Error('Unable to load purchase orders');
        }
    }

    async createPurchaseOrder(created_by: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
        try {
            const { items, ...poData } = input;

            return await this.purchaseOrderRepo.createWithItems({
                ...poData,
                created_by,
                status: 'pending',
                total_amount: items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)
            }, items);
        } catch (error) {
            logger.error('Failed to create purchase order', error as Error);
            throw error;
        }
    }

    async updateStatus(id: string, status: 'pending' | 'received' | 'cancelled'): Promise<void> {
        try {
            await this.purchaseOrderRepo.updateStatus(id, status);
        } catch (error) {
            logger.error('Failed to update PO status', error as Error);
            throw error;
        }
    }

    async receiveOrder(id: string): Promise<void> {
        try {
            const po = await this.purchaseOrderRepo.findById(id);
            if (!po) throw new Error('Purchase order not found');

            if (po.status === 'received') {
                throw new Error('Purchase order already received');
            }

            // Get items
            const items = await this.purchaseOrderRepo.findItemsByOrderId(id);

            // Create batches for each item
            for (const item of items) {
                const batchNumber = `${po.po_number}-${item.product_id.substring(0, 8)}`;

                // Assuming item has selling_price, otherwise calc ref
                // Database schema check needed usually but we assume it for now as per previous logic
                const sellingPrice = (item as any).selling_price || item.cost_price * 1.2;
                const markup = item.cost_price > 0 ? ((sellingPrice - item.cost_price) / item.cost_price) * 100 : 0;

                await this.productService.createBatch({
                    product_id: item.product_id,
                    batch_number: batchNumber,
                    purchase_order_id: po.id,
                    supplier_id: po.supplier_id,
                    cost_price: item.cost_price,
                    markup_percentage: Math.round(markup * 100) / 100,
                    selling_price: sellingPrice,
                    initial_quantity: item.quantity,
                    current_quantity: item.quantity,
                    received_date: new Date().toISOString().split('T')[0],
                });
            }

            await this.updateStatus(id, 'received');
            logger.info('Purchase order received and batches created', { id });
        } catch (error) {
            logger.error('Failed to receive order', error as Error);
            throw error;
        }
    }
}
