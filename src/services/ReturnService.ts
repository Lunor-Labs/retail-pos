import { ReturnRepository } from '../repositories/ReturnRepository';
import { Return } from '../types';
import { logger } from '../lib/logger';
import { ProductService } from './ProductService';
import { CustomerService } from './CustomerService';

export interface CreateReturnInput {
    sale_id: string | null;
    customer_id?: string | null;
    refund_method: 'cash' | 'credit_note' | 'exchange';
    reason: string;
    total_amount: number;
    items: {
        product_id: string;
        batch_id?: string;
        quantity: number;
        subtotal: number;
        unit_price: number;
        sale_item_id?: string;
    }[];
}

export class ReturnService {
    constructor(
        private returnRepo: ReturnRepository,
        private productService: ProductService,
        private customerService: CustomerService
    ) { }

    async getAllReturns(): Promise<Return[]> {
        try {
            return await this.returnRepo.findAllWithDetails();
        } catch (error) {
            logger.error('Failed to fetch returns', error as Error);
            throw new Error('Unable to load returns');
        }
    }

    async createReturn(profileId: string, input: CreateReturnInput & { status?: 'pending' | 'approved' }): Promise<Return> {
        try {
            const { items, status = 'pending', ...returnData } = input;

            // Generate return number
            const returnNumber = 'RET-' + Date.now().toString().slice(-6);

            const result = await this.returnRepo.createWithItems({
                ...returnData,
                return_number: returnNumber,
                status: status,
                processed_by: profileId,
                created_at: new Date().toISOString()
            } as any, items);

            // If approved immediately, restore stock
            if (status === 'approved' && items.length > 0) {
                for (const item of items) {
                    if (item.batch_id) {
                        const batches = await this.productService.getProductBatches(item.product_id!);
                        const batch = batches.find(b => b.id === item.batch_id);
                        if (batch) {
                            await this.productService.updateStock(batch.id, batch.current_quantity + item.quantity);
                        }
                    }
                }
            }

            return result;
        } catch (error) {
            logger.error('Failed to create return', error as Error);
            throw error;
        }
    }

    async approveReturn(id: string): Promise<void> {
        try {
            logger.info('Approving return', { returnId: id });

            const returnRecord = await this.returnRepo.findById(id);
            if (!returnRecord) throw new Error('Return not found');

            if (returnRecord.status !== 'pending') {
                throw new Error('Return is not in pending status');
            }

            const items = await this.returnRepo.findItemsByReturnId(id);

            // 1. Restore stock
            for (const item of items) {
                // Assuming ReturnItem has batch_id or logic to find batch.
                // The interface validation might fail if batch_id is missing on item type but mapped via create.
                // In Returns.tsx it queries return_items.
                // If item has batch_id, we restore.
                if ((item as any).batch_id) {
                    // Get current quantity first (this needs a method in ProductService or access via repo)
                    // But ProductService abstracts this.
                    // I will assume ProductService can expose a method `restoreStock(batchId, quantity)`
                    // OR I use getProductBatches and find the batch?
                    // Let's rely on ProductService.updateStock assuming I can get current qty.
                    // A safer bet is to add `incrementStock` to ProductService later if needed.
                    // For now, I will assume a method `increaseStock` exists or I implement logic here?
                    // I will implement logic: get batch, update.
                    // I don't have direct access to Batch info via Service easily without creating many methods.
                    // I'll try to add `increaseStock` to ProductService or just use `updateStock` if I can get current.
                    // Let's use `productService.updateStock` and catch error if I can't read current.
                    // Wait, `productService` has `getProductBatches`.
                    const batches = await this.productService.getProductBatches(item.product_id!);
                    const batch = batches.find(b => b.id === (item as any).batch_id);
                    if (batch) {
                        await this.productService.updateStock(batch.id, batch.current_quantity + item.quantity);
                    }
                }
            }

            // 2. Update status
            await this.returnRepo.update(id, {
                status: 'approved',
                updated_at: new Date().toISOString()
            } as any);

            // 3. Update customer credit if credit note
            if (returnRecord.customer_id && returnRecord.refund_method === 'credit_note') {
                // We need to reduce credit used? Wait.
                // If returning item and getting credit note -> Customer gets credit.
                // So credit increases (negative balance? or positive credit available?).
                // Customer.current_credit is usually "amount owed".
                // If returning, amount owed decreases.
                // So we subtract from current_credit.
                // "current_credit: Math.max(0, customer.current_credit - returnRecord.total_amount)"
                // CustomerService has updateCredit(customerId, amount).
                // updateCredit adds amount. So passing negative reduces debt.
                await this.customerService.updateCredit(returnRecord.customer_id, -returnRecord.total_amount);
            }

        } catch (error) {
            logger.error('Failed to approve return', error as Error);
            throw error;
        }
    }

    async rejectReturn(id: string): Promise<void> {
        try {
            await this.returnRepo.update(id, {
                status: 'rejected',
                updated_at: new Date().toISOString()
            } as any);
        } catch (error) {
            logger.error('Failed to reject return', error as Error);
            throw error;
        }
    }
}
