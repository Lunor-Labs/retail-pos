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
}
