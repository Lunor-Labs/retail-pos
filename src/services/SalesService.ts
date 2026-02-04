import { SaleRepository, SaleWithItems } from '../repositories/SaleRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { InventoryService } from './InventoryService';
import { Sale, SaleItem } from '../types';
import { logger } from '../lib/logger';

export interface CreateSaleInput {
    customer_id?: string | null;
    cashier_id: string;
    referral_agent_id?: string | null;
    items: Array<{
        product_id: string;
        batch_id: string;
        quantity: number;
        unit_price: number;
        cost_price: number;
    }>;
    payment_method: 'cash' | 'card' | 'credit' | 'mixed';
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    notes?: string;
    referral_commission_rate?: number;
}

/**
 * Sales service - handles sales business logic
 */
export class SalesService {
    constructor(
        private saleRepo: SaleRepository,
        private customerRepo: CustomerRepository,
        private productRepo: ProductRepository,
        private inventoryRepo: InventoryService
    ) { }

    /**
     * Create a new sale
     */
    async createSale(input: CreateSaleInput): Promise<SaleWithItems> {
        try {
            logger.info('Creating new sale', {
                customerId: input.customer_id,
                itemCount: input.items.length,
                total: input.total_amount,
                paymentMethod: input.payment_method,
            });

            // Validate sale data
            this.validateSaleInput(input);

            // Determine sale status
            const status = this.determineSaleStatus(
                input.total_amount,
                input.paid_amount,
                input.payment_method
            );

            // If credit sale, validate customer credit limit
            if (status === 'credit' || status === 'partial') {
                await this.validateCreditLimit(input.customer_id!, input.total_amount - input.paid_amount);
            }

            // Generate sale number
            const saleNumber = await this.generateSaleNumber();

            // Prepare sale data
            const saleData: Partial<Sale> = {
                sale_number: saleNumber,
                customer_id: input.customer_id || null,
                cashier_id: input.cashier_id,
                referral_agent_id: input.referral_agent_id || null,
                sale_date: new Date().toISOString(),
                payment_method: input.payment_method,
                subtotal: input.subtotal,
                discount_amount: input.discount_amount,
                tax_amount: input.tax_amount,
                total_amount: input.total_amount,
                paid_amount: input.paid_amount,
                status,
                notes: input.notes || null,
            };

            // Prepare sale items
            const saleItems: Partial<SaleItem>[] = input.items.map(item => ({
                product_id: item.product_id,
                batch_id: item.batch_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                cost_price: item.cost_price,
                subtotal: item.quantity * item.unit_price,
            }));

            // Deduct stock levels
            await this.inventoryRepo.deductStock(input.items);

            // Create sale with items
            const sale = await this.saleRepo.createWithItems(saleData, saleItems);

            // Update customer credit if applicable
            if (input.customer_id && (status === 'credit' || status === 'partial')) {
                const creditAmount = input.total_amount - input.paid_amount;
                await this.customerRepo.updateCredit(input.customer_id, creditAmount);

                logger.info('Customer credit updated', {
                    customerId: input.customer_id,
                    creditAmount,
                });
            }

            // Create referral commission if agent provided
            if (input.referral_agent_id && input.referral_commission_rate !== undefined) {
                const commissionAmount = input.total_amount * (input.referral_commission_rate / 100);
                await this.saleRepo.createCommission({
                    referral_agent_id: input.referral_agent_id,
                    sale_id: sale.id,
                    commission_amount: commissionAmount,
                    commission_rate: input.referral_commission_rate,
                    sale_amount: input.total_amount,
                });

                logger.info('Referral commission created', {
                    agentId: input.referral_agent_id,
                    amount: commissionAmount,
                });
            }

            logger.info('Sale created successfully', {
                saleId: sale.id,
                saleNumber: sale.sale_number,
                total: sale.total_amount,
                status: sale.status,
            });

            return sale;
        } catch (error) {
            logger.error('Failed to create sale', error as Error, { input });
            throw error;
        }
    }

    /**
     * Process a credit payment
     */
    async processCreditPayment(
        saleId: string,
        paymentAmount: number
    ): Promise<Sale> {
        try {
            logger.info('Processing credit payment', { saleId, paymentAmount });

            const sale = await this.saleRepo.findById(saleId);
            if (!sale) {
                throw new Error('Sale not found.');
            }

            if (sale.status === 'completed') {
                throw new Error('Sale is already fully paid.');
            }

            if (paymentAmount <= 0) {
                throw new Error('Payment amount must be greater than zero.');
            }

            const remainingBalance = sale.total_amount - sale.paid_amount;
            if (paymentAmount > remainingBalance) {
                throw new Error(`Payment amount exceeds remaining balance of LKR ${remainingBalance.toFixed(2)}`);
            }

            const newPaidAmount = sale.paid_amount + paymentAmount;
            const newStatus = newPaidAmount >= sale.total_amount ? 'completed' : 'partial';

            // Update sale
            const updatedSale = await this.saleRepo.updatePayment(saleId, newPaidAmount, newStatus);

            // Update customer credit
            if (sale.customer_id) {
                await this.customerRepo.updateCredit(sale.customer_id, -paymentAmount);

                logger.info('Customer credit reduced', {
                    customerId: sale.customer_id,
                    amount: paymentAmount,
                });
            }

            logger.info('Credit payment processed successfully', {
                saleId,
                paymentAmount,
                newStatus,
            });

            return updatedSale;
        } catch (error) {
            logger.error('Failed to process credit payment', error as Error, {
                saleId,
                paymentAmount,
            });
            throw error;
        }
    }

    /**
     * Get sales by customer
     */
    async getSalesByCustomer(customerId: string): Promise<Sale[]> {
        try {
            logger.debug('Fetching sales for customer', { customerId });
            return await this.saleRepo.findByCustomerId(customerId);
        } catch (error) {
            logger.error('Failed to fetch customer sales', error as Error, { customerId });
            throw new Error('Unable to load customer sales.');
        }
    }

    /**
     * Get credit sales by customer
     */
    async getCreditSalesByCustomer(customerId: string): Promise<Sale[]> {
        try {
            logger.debug('Fetching credit sales for customer', { customerId });
            return await this.saleRepo.findCreditSalesByCustomerId(customerId);
        } catch (error) {
            logger.error('Failed to fetch credit sales', error as Error, { customerId });
            throw new Error('Unable to load credit sales.');
        }
    }

    /**
     * Get sales statistics for a date range
     */
    async getSalesStatistics(startDate: string, endDate: string) {
        try {
            logger.info('Fetching sales statistics', { startDate, endDate });

            const stats = await this.saleRepo.getStatistics(startDate, endDate);

            logger.info('Sales statistics retrieved', stats);

            return stats;
        } catch (error) {
            logger.error('Failed to fetch sales statistics', error as Error, {
                startDate,
                endDate,
            });
            throw new Error('Unable to load sales statistics.');
        }
    }

    /**
     * Validate sale input
     */
    private validateSaleInput(input: CreateSaleInput): void {
        if (!input.cashier_id) {
            throw new Error('Cashier ID is required.');
        }

        if (!input.items || input.items.length === 0) {
            throw new Error('Sale must have at least one item.');
        }

        if (input.total_amount <= 0) {
            throw new Error('Total amount must be greater than zero.');
        }

        if (input.paid_amount < 0) {
            throw new Error('Paid amount cannot be negative.');
        }

        if (input.payment_method === 'credit' && !input.customer_id) {
            throw new Error('Customer is required for credit sales.');
        }

        // Validate items
        for (const item of input.items) {
            if (item.quantity <= 0) {
                throw new Error('Item quantity must be greater than zero.');
            }
            if (item.unit_price < 0) {
                throw new Error('Item price cannot be negative.');
            }
        }
    }

    /**
     * Determine sale status based on payment
     */
    private determineSaleStatus(
        totalAmount: number,
        paidAmount: number,
        paymentMethod: string
    ): 'completed' | 'partial' | 'credit' {
        if (paidAmount >= totalAmount) {
            return 'completed';
        } else if (paidAmount > 0) {
            return 'partial';
        } else if (paymentMethod === 'credit') {
            return 'credit';
        } else {
            return 'completed'; // Default for cash/card
        }
    }

    /**
     * Validate customer credit limit
     */
    private async validateCreditLimit(customerId: string, creditAmount: number): Promise<void> {
        const customer = await this.customerRepo.findById(customerId);

        if (!customer) {
            throw new Error('Customer not found.');
        }

        const newCreditTotal = customer.current_credit + creditAmount;

        if (newCreditTotal > customer.credit_limit) {
            throw new Error(
                `Credit limit exceeded. Available credit: LKR ${(customer.credit_limit - customer.current_credit).toFixed(2)}`
            );
        }
    }

    /**
     * Delete a sale and reverse its effects
     */
    async deleteSale(saleId: string): Promise<void> {
        try {
            logger.info('Deleting sale', { saleId });

            // 1. Get sale with items
            const sale = await this.saleRepo.findByIdWithItems(saleId);
            if (!sale) {
                throw new Error('Sale not found.');
            }

            // 2. Check for associated returns
            const adapter = (this.saleRepo as any).adapter;
            const returns = await adapter.query('returns', {
                where: [{ field: 'sale_id', operator: '=', value: saleId }]
            });

            if (returns.length > 0) {
                throw new Error('Cannot delete a sale that has associated returns. Please handle returns first.');
            }

            // 3. Restore stock levels
            for (const item of sale.items) {
                // Get current batch to know current quantity
                const client = (this.productRepo as any).adapter.getClient();
                const { data: batch, error } = await client
                    .from('product_batches')
                    .select('current_quantity')
                    .eq('id', item.batch_id)
                    .single();

                if (error) {
                    logger.error(`Failed to fetch batch ${item.batch_id} for stock restoration`, error);
                    continue;
                }

                if (batch) {
                    const newQuantity = batch.current_quantity + item.quantity;
                    await this.productRepo.updateStock(item.batch_id, newQuantity);
                    logger.debug('Restored stock for item', {
                        productId: item.product_id,
                        batchId: item.batch_id,
                        addedQuantity: item.quantity,
                        newQuantity
                    });
                }
            }

            // 3. Reverse customer credit if applicable
            if (sale.customer_id && (sale.status === 'credit' || sale.status === 'partial')) {
                const creditAmount = sale.total_amount - sale.paid_amount;
                if (creditAmount > 0) {
                    await this.customerRepo.updateCredit(sale.customer_id, -creditAmount);
                    logger.info('Reversed customer credit', {
                        customerId: sale.customer_id,
                        amount: creditAmount,
                    });
                }
            }

            // 4. Delete the sale and items
            logger.info('Calling repository to delete sale and items', { saleId });
            await this.saleRepo.deleteWithItems(saleId);

            logger.info('Sale deleted successfully from database', { saleId });
        } catch (error) {
            logger.error('Failed to delete sale', error as Error, { saleId });
            throw error;
        }
    }

    /**
     * Generate unique sale number
     */
    private async generateSaleNumber(): Promise<string> {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-6);

        return `SALE-${year}${month}${day}-${timestamp}`;
    }
}
