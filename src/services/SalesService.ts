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
        product_id?: string | null;
        variant_id?: string | null;
        batch_id?: string | null;
        quantity: number;
        unit_price: number;
        selling_price: number;
        cost_price: number;
        is_manual?: boolean;
        manual_description?: string;
    }>;
    payment_method: 'cash' | 'card' | 'credit' | 'mixed';
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    notes?: string;
    referral_commission_rate?: number;
    service_charge?: number;
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
                service_charge: input.service_charge || 0,
            };

            // Prepare sale items
            const saleItems: Partial<SaleItem>[] = input.items.map(item => ({
                product_id: item.product_id || null,
                variant_id: item.variant_id || null,
                batch_id: item.batch_id || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                selling_price: item.selling_price,
                cost_price: item.cost_price,
                subtotal: item.quantity * item.unit_price,
                is_manual: item.is_manual || false,
                manual_description: item.manual_description || null,
            }));

            // Only deduct stock for regular (non-manual) items
            const stockItems = input.items.filter(i => !i.is_manual) as Array<{
                product_id: string;
                batch_id: string;
                quantity: number;
                unit_price: number;
                selling_price: number;
                cost_price: number;
            }>;
            await this.inventoryRepo.deductStock(stockItems);

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

            // Create referral commission if agent provided (exclude service charge)
            if (input.referral_agent_id && input.referral_commission_rate !== undefined) {
                const commissionableAmount = input.total_amount - (input.service_charge || 0);
                const commissionAmount = commissionableAmount * (input.referral_commission_rate / 100);
                await this.saleRepo.createCommission({
                    referral_agent_id: input.referral_agent_id,
                    sale_id: sale.id,
                    commission_amount: commissionAmount,
                    commission_rate: input.referral_commission_rate,
                    sale_amount: commissionableAmount,
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
            // Regular items must have product and batch references
            if (!item.is_manual && (!item.product_id || !item.batch_id)) {
                throw new Error('Regular items must have a product and batch.');
            }
            // Manual items must have a description
            if (item.is_manual && !item.manual_description?.trim()) {
                throw new Error('Manual items must have a description.');
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

            // 3. Restore stock levels (skip manual items which have no batch)
            for (const item of sale.items) {
                if (item.is_manual || !item.batch_id) continue;

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
     * Get today's sales
     */
    async getTodaySales() {
        try {
            const sales = await this.saleRepo.findTodaySales();

            const totalAmount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

            return {
                count: sales.length,
                revenue: totalAmount,
                sales
            };
        } catch (error) {
            logger.error('Failed to get today sales', error as Error);
            throw new Error('Unable to load today\'s sales');
        }
    }

    /**
     * Get recent sales
     */
    async getRecentSales(limit: number = 5) {
        try {
            return await this.saleRepo.findRecentSales(limit);
        } catch (error) {
            logger.error('Failed to fetch recent sales', error as Error);
            throw new Error('Unable to fetch recent sales');
        }
    }

    /**
     * Get sales history for chart
     */
    async getSalesHistory(limit: number = 50) {
        try {
            return await this.saleRepo.findSalesHistory(limit);
        } catch (error) {
            logger.error('Failed to fetch sales history', error as Error);
            throw new Error('Unable to fetch sales history');
        }
    }

    /**
     * Get sales history with cost (COGS) for revenue vs expense chart.
     * Returns daily grouped data with both revenue and cost totals.
     */
    async getSalesHistoryWithCost(days: number = 30): Promise<{ date: string; revenue: number; cost: number }[]> {
        try {
            const adapter = (this.saleRepo as any).adapter;
            const since = new Date();
            since.setDate(since.getDate() - days);
            const sinceStr = since.toISOString();

            // Fetch sales for revenue
            const sales: any[] = await adapter.query('sales', {
                select: 'created_at, total_amount',
                where: [{ field: 'created_at', operator: '>=', value: sinceStr }],
                orderBy: [{ field: 'created_at', direction: 'asc' }],
            });

            // Fetch sale items for COGS
            const items: any[] = await adapter.query('sale_items', {
                select: 'created_at, cost_price, quantity',
                where: [{ field: 'created_at', operator: '>=', value: sinceStr }],
            });

            // Group revenue by date
            const revenueMap = new Map<string, number>();
            for (const s of sales) {
                const day = new Date(s.created_at).toISOString().split('T')[0];
                revenueMap.set(day, (revenueMap.get(day) || 0) + Number(s.total_amount));
            }

            // Group cost by date
            const costMap = new Map<string, number>();
            for (const item of items) {
                const day = new Date(item.created_at).toISOString().split('T')[0];
                costMap.set(day, (costMap.get(day) || 0) + Number(item.cost_price) * Number(item.quantity));
            }

            // Merge into sorted daily array
            const allDays = Array.from(new Set([...revenueMap.keys(), ...costMap.keys()])).sort();
            return allDays.map(day => ({
                date: day,
                revenue: revenueMap.get(day) || 0,
                cost: costMap.get(day) || 0,
            }));
        } catch (error) {
            logger.error('Failed to fetch sales history with cost', error as Error);
            throw new Error('Unable to fetch chart data');
        }
    }

    /**
     * Get top selling items
     */
    async getTopSellingItems(limit: number = 5, period: 'month' | 'all' = 'all') {
        try {
            const adapter = (this.saleRepo as any).adapter;
            
            let whereClause: any[] | undefined = undefined;
            if (period === 'month') {
                const date = new Date();
                const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
                whereClause = [{ field: 'created_at', operator: '>=', value: firstDayOfMonth }];
            }

            const items = await adapter.query('sale_items', {
                select: 'quantity, products(name)',
                where: whereClause
            });

            // Aggregate items
            const itemMap = new Map<string, number>();
            (items as any[]).forEach(item => {
                const name = item.products?.name || 'Unknown';
                itemMap.set(name, (itemMap.get(name) || 0) + Number(item.quantity));
            });

            const sortedItems = Array.from(itemMap.entries())
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, limit);

            return sortedItems;
        } catch (error) {
            logger.error('Failed to fetch top selling items', error as Error);
            throw new Error('Unable to fetch top selling items');
        }
    }

    /**
     * Get returns count pending
     */
    async getPendingReturnsCount(): Promise<number> {
        try {
            const adapter = (this.saleRepo as any).adapter;
            const returns = await adapter.query('returns', {
                where: [{ field: 'status', operator: '=', value: 'pending' }]
            });
            return returns.length;
        } catch (error) {
            logger.error('Failed to count pending returns', error as Error);
            return 0;
        }
    }


    /**
     * Get sales for a date range with details
     */
    async getSales(startDate: string, endDate: string): Promise<any[]> {
        try {
            return await this.saleRepo.findSalesWithDetails(startDate, endDate);
        } catch (error) {
            logger.error('Failed to fetch sales', error as Error);
            throw new Error('Unable to load sales data');
        }
    }

    /**
     * Get a single sale by ID with details
     */
    async getSaleById(saleId: string): Promise<any> {
        try {
            return await this.saleRepo.findByIdWithItems(saleId);
        } catch (error) {
            logger.error('Failed to fetch sale by ID', error as Error, { saleId });
            throw new Error('Unable to load sale details');
        }
    }

    /**
     * Get items for a specific sale with details
     */
    async getSaleItems(saleId: string): Promise<any[]> {
        try {
            return await this.saleRepo.findItemsWithDetails(saleId);
        } catch (error) {
            logger.error('Failed to fetch sale items', error as Error);
            throw new Error('Unable to load sale items');
        }
    }


    /**
     * Sync offline sale
     */
    async syncOfflineSale(data: any): Promise<void> {
        try {
            const { sale, items, batches, customerCredit, commission } = data;

            // 1. Create Sale and Items
            const createdSale = await this.saleRepo.createWithItems(sale, items);
            logger.info('Offline sale synced', { saleId: createdSale.id, saleNumber: createdSale.sale_number });

            // 2. Update Batches (Stock)
            if (batches && Array.isArray(batches)) {
                for (const b of batches) {
                    await this.productRepo.updateStock(b.id, b.newQuantity);
                }
            }

            // 3. Update Customer Credit
            if (customerCredit) {
                await this.customerRepo.update(customerCredit.id, {
                    current_credit: customerCredit.newCredit,
                    updated_at: new Date().toISOString()
                });
            }

            // 4. Client Commission
            if (commission) {
                await this.saleRepo.createCommission({
                    ...commission,
                    sale_id: createdSale.id
                });
            }
        } catch (error) {
            logger.error('Failed to sync offline sale', error as Error);
            throw error;
        }
    }

    /**
     * Get commissions by agent
     */
    async getCommissionsByAgent(agentId: string) {
        try {
            logger.debug('Fetching commissions for agent', { agentId });
            return await this.saleRepo.findCommissionsByAgent(agentId);
        } catch (error) {
            logger.error('Failed to fetch commissions', error as Error);
            throw new Error('Unable to load commissions');
        }
    }

    /**
     * Payout commissions
     */
    async payoutCommissions(commissionIds: string[]) {
        try {
            logger.info('Paying out commissions', { count: commissionIds.length });
            await this.saleRepo.payoutCommissions(commissionIds);
            logger.info('Commissions paid out successfully');
        } catch (error) {
            logger.error('Failed to payout commissions', error as Error);
            throw error;
        }
    }

    /**
     * Find sale by sale number
     */
    async findSaleByNumber(saleNumber: string): Promise<SaleWithItems | null> {
        try {
            logger.debug('Finding sale by number', { saleNumber });
            return await this.saleRepo.findBySaleNumber(saleNumber);
        } catch (error) {
            logger.error('Failed to find sale by number', error as Error);
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

    /**
     * Add a custom commission for a sale
     */
    async addCustomCommission(data: {
        referral_agent_id: string;
        sale_id: string;
        commission_amount: number;
        sale_amount: number;
    }) {
        try {
            logger.info('Adding custom commission', data);

            // Calculate a temporary rate for display/reference
            const commissionRate = (data.commission_amount / data.sale_amount) * 100;

            await this.saleRepo.createCommission({
                referral_agent_id: data.referral_agent_id,
                sale_id: data.sale_id,
                commission_amount: data.commission_amount,
                commission_rate: Math.round(commissionRate * 100) / 100,
                sale_amount: data.sale_amount,
            });

            logger.info('Custom commission added successfully');
        } catch (error) {
            logger.error('Failed to add custom commission', error as Error);
            throw error;
        }
    }
}
