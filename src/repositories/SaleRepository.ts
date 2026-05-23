import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { Sale, SaleItem } from '../types';

export interface SaleWithItems extends Sale {
    items: SaleItem[];
    customer?: { name: string; phone: string } | null;
    cashier?: { full_name: string } | null;
}

/**
 * Repository for Sale-related database operations
 */
export class SaleRepository extends BaseRepository<Sale> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'sales');
    }

    /**
     * Find all sales with items
     */
    async findAllWithItems(): Promise<SaleWithItems[]> {
        const sales = await this.findAll();

        return Promise.all(
            sales.map(async (sale) => {
                const items = await this.findItemsBySaleId(sale.id);
                return {
                    ...sale,
                    items,
                } as SaleWithItems;
            })
        );
    }

    /**
     * Find sale by ID with items
     */
    async findByIdWithItems(id: string): Promise<SaleWithItems | null> {
        const sale = await this.findById(id);
        if (!sale) return null;

        const items = await this.findItemsBySaleId(id);

        return {
            ...sale,
            items,
        } as SaleWithItems;
    }

    /**
     * Find sales by customer ID
     */
    async findByCustomerId(customerId: string): Promise<Sale[]> {
        return this.query({
            where: [{ field: 'customer_id', operator: '=', value: customerId }],
            orderBy: [{ field: 'sale_date', direction: 'desc' }],
        });
    }

    /**
     * Find credit sales for a customer
     */
    async findCreditSalesByCustomerId(customerId: string): Promise<Sale[]> {
        const sales = await this.query({
            where: [
                { field: 'customer_id', operator: '=', value: customerId },
            ],
            orderBy: [{ field: 'sale_date', direction: 'desc' }],
        });

        // Filter for credit/partial status
        return sales.filter(s => s.status === 'credit' || s.status === 'partial');
    }

    /**
     * Find today's sales
     */
    async findTodaySales(): Promise<Sale[]> {
        const today = new Date().toISOString().split('T')[0];
        return this.query({
            where: [{ field: 'sale_date', operator: '>=', value: today }]
        });
    }

    /**
     * Find recent sales
     */
    async findRecentSales(limit: number): Promise<Sale[]> {
        return this.adapter.query<Sale>('sales', {
            select: '*, customers(name), sale_items(id)',
            orderBy: [{ field: 'created_at', direction: 'desc' }],
            limit
        });
    }

    /**
     * Find sales history
     */
    async findSalesHistory(limit: number): Promise<Partial<Sale>[]> {
        return this.query({
            select: 'created_at, total_amount',
            orderBy: [{ field: 'created_at', direction: 'asc' }],
            limit
        });
    }

    /**
     * Find top selling items
     */
    async findTopSellingItems(startDate: string): Promise<any[]> {
        return this.adapter.query('sale_items', {
            select: 'quantity, products(name)',
            where: [{ field: 'created_at', operator: '>=', value: startDate }]
        });
    }

    /**
     * Count pending returns
     */
    async countPendingReturns(): Promise<number> {
        const results = await this.adapter.query('returns', {
            where: [{ field: 'status', operator: '=', value: 'pending' }]
        });
        return results.length;
    }

    /**
     * Find sales by date range
     */
    async findByDateRange(startDate: string, endDate: string): Promise<Sale[]> {
        return this.query({
            where: [
                { field: 'sale_date', operator: '>=', value: startDate },
                { field: 'sale_date', operator: '<=', value: endDate },
            ],
            orderBy: [{ field: 'sale_date', direction: 'desc' }],
        });
    }

    /**
     * Find sales by cashier
     */
    async findByCashierId(cashierId: string): Promise<Sale[]> {
        return this.query({
            where: [{ field: 'cashier_id', operator: '=', value: cashierId }],
            orderBy: [{ field: 'sale_date', direction: 'desc' }],
        });
    }

    /**
     * Create sale with items
     */
    async createWithItems(saleData: Partial<Sale>, items: Partial<SaleItem>[]): Promise<SaleWithItems> {
        // Create the sale
        const sale = await this.create(saleData);

        // Create sale items
        const createdItems = await Promise.all(
            items.map(item =>
                this.adapter.insert<SaleItem>('sale_items', {
                    ...item,
                    sale_id: sale.id,
                })
            )
        );

        return {
            ...sale,
            items: createdItems,
        } as SaleWithItems;
    }

    /**
     * Update sale status and paid amount
     */
    async updatePayment(
        saleId: string,
        paidAmount: number,
        status: 'completed' | 'partial' | 'credit'
    ): Promise<Sale> {
        return this.update(saleId, {
            paid_amount: paidAmount,
            status,
            updated_at: new Date().toISOString(),
        } as Partial<Sale>);
    }

    /**
     * Find items for a sale
     */
    private async findItemsBySaleId(saleId: string): Promise<SaleItem[]> {
        return this.adapter.query<SaleItem>('sale_items', {
            where: [{ field: 'sale_id', operator: '=', value: saleId }],
        });
    }

    /**
     * Get sales statistics for a date range
     */
    async getStatistics(startDate: string, endDate: string) {
        const sales = await this.findByDateRange(startDate, endDate);

        return {
            totalSales: sales.length,
            totalRevenue: sales.reduce((sum, sale) => sum + sale.total_amount, 0),
            totalPaid: sales.reduce((sum, sale) => sum + sale.paid_amount, 0),
            creditSales: sales.filter(s => s.status === 'credit' || s.status === 'partial').length,
            completedSales: sales.filter(s => s.status === 'completed').length,
        };
    }

    /**
     * Delete sale and its items
     */
    async deleteWithItems(id: string): Promise<void> {
        const client = (this.adapter as any).getClient();

        // 1. Delete associated referral commissions
        const { error: commError } = await client.from('referral_commissions').delete().eq('sale_id', id);
        if (commError) {
            throw new Error(`Failed to delete referral commissions: ${commError.message}`);
        }

        // 2. Delete sale items
        const { error: itemError } = await client.from('sale_items').delete().eq('sale_id', id);
        if (itemError) {
            throw new Error(`Failed to delete sale items: ${itemError.message}`);
        }

        // 3. Delete the sale itself
        const { error: saleError } = await client.from('sales').delete().eq('id', id);
        if (saleError) {
            throw new Error(`Failed to delete sale record: ${saleError.message}`);
        }
    }

    /**
     * Create a referral commission
     */
    async createCommission(data: {
        referral_agent_id: string;
        sale_id: string;
        commission_amount: number;
        commission_rate: number;
        sale_amount: number;
    }): Promise<void> {
        await this.adapter.insert('referral_commissions', data);
    }

    /**
     * Find sales with full details (customer, cashier) for a date range
     */
    async findSalesWithDetails(startDate: string, endDate: string): Promise<SaleWithItems[]> {
        return this.adapter.query<SaleWithItems>('sales', {
            select: '*, cashier:user_profiles!cashier_id(full_name), customer:customers(name, phone)',
            where: [
                { field: 'sale_date', operator: '>=', value: startDate },
                { field: 'sale_date', operator: '<=', value: endDate },
            ],
            orderBy: [{ field: 'sale_date', direction: 'desc' }],
        });
    }

    /**
     * Find sale by sale number with items
     */
    async findBySaleNumber(saleNumber: string): Promise<SaleWithItems | null> {
        const sale = await this.adapter.query<Sale>('sales', {
            where: [{ field: 'sale_number', operator: '=', value: saleNumber }]
        }).then(res => res[0] || null);

        if (!sale) return null;

        const items = await this.findItemsWithDetails(sale.id);

        return {
            ...sale,
            items
        };
    }

    /**
     * Find items with product and batch details for a sale
     */
    async findItemsWithDetails(saleId: string): Promise<SaleItem[]> {
        return this.adapter.query<SaleItem>('sale_items', {
            select: '*, product:products(name, sku), batch:product_batches(batch_number)',
            where: [{ field: 'sale_id', operator: '=', value: saleId }],
        });
    }

    /**
     * Find commissions by agent
     */
    async findCommissionsByAgent(agentId: string): Promise<any[]> {
        const client = (this.adapter as any).getClient();
        const { data, error } = await client
            .from('referral_commissions')
            .select(`
                *,
                sale:sales(sale_number)
            `)
            .eq('referral_agent_id', agentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Payout commissions
     */
    async payoutCommissions(ids: string[]): Promise<void> {
        const client = (this.adapter as any).getClient();
        const { error } = await client
            .from('referral_commissions')
            .update({
                status: 'paid',
                payment_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as any)
            .in('id', ids);

        if (error) throw error;
    }
}
