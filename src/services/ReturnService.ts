import { ReturnRepository } from '../repositories/ReturnRepository';
import { Return } from '../types';
import { logger } from '../lib/logger';
import { CustomerService } from './CustomerService';
import { InventoryService } from './InventoryService';

export interface CreateReturnInput {
    sale_id: string | null;
    customer_id?: string | null;
    refund_method: 'cash' | 'credit_note' | 'exchange';
    reason: string;
    total_amount: number;
    items: {
        product_id: string;
        variant_id?: string | null;
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
        private customerService: CustomerService,
        private inventoryService: InventoryService
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
                await this.restoreStockForItems(items);
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
            await this.restoreStockForItems(items);

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

    /**
     * Put returned units back into their original batches.
     *
     * Adds relative to what the batch currently holds, so a sale made between the
     * return being raised and approved is not overwritten. This used to look the
     * batch up through getProductBatches first, which always failed and left the
     * restore silently skipped.
     */
    private async restoreStockForItems(
        items: Array<{ batch_id?: string | null; quantity: number }>
    ): Promise<void> {
        const stockItems = items
            .filter(item => !!item.batch_id)
            .map(item => ({ batch_id: item.batch_id as string, quantity: item.quantity }));

        if (stockItems.length === 0) {
            logger.warn('Return has no batch-linked items — no stock restored');
            return;
        }

        await this.inventoryService.restoreStock(stockItems);
        logger.info('Return stock restored', { itemCount: stockItems.length });
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
