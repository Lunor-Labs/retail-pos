import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { Return, ReturnItem, Customer, Product, Sale } from '../types';

export interface ReturnWithDetails extends Return {
    customer: Customer | null;
    sale: Sale | null;
    items: (ReturnItem & { product: Product | null })[];
}

/**
 * Repository for Return and Refund operations
 */
export class ReturnRepository extends BaseRepository<Return> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'returns');
    }

    /**
     * Find all returns with child items and customer details
     */
    async findAllWithDetails(): Promise<ReturnWithDetails[]> {
        const returns = await this.findAll();

        return Promise.all(returns.map(async (returnRecord) => {
            const [customer, sale, items] = await Promise.all([
                returnRecord.customer_id
                    ? this.adapter.query<Customer>('customers', {
                        where: [{ field: 'id', operator: '=', value: returnRecord.customer_id }]
                    }).then(res => res[0] || null)
                    : Promise.resolve(null),
                returnRecord.sale_id
                    ? this.adapter.query<Sale>('sales', {
                        where: [{ field: 'id', operator: '=', value: returnRecord.sale_id }]
                    }).then(res => res[0] || null)
                    : Promise.resolve(null),
                this.findItemsByReturnId(returnRecord.id)
            ]);

            return {
                ...returnRecord,
                customer,
                sale,
                items
            };
        }));
    }

    /**
     * Find items for a specific return with product details
     */
    async findItemsByReturnId(returnId: string): Promise<(ReturnItem & { product: Product | null })[]> {
        const items = await this.adapter.query<ReturnItem>('return_items', {
            where: [{ field: 'return_id', operator: '=', value: returnId }]
        });

        return Promise.all(items.map(async (item) => {
            const product = await this.adapter.query<Product>('products', {
                where: [{ field: 'id', operator: '=', value: item.product_id }]
            }).then(res => res[0] || null);

            return {
                ...item,
                product
            };
        }));
    }

    /**
     * Create a return with its items
     */
    async createWithItems(returnData: Partial<Return>, items: Partial<ReturnItem>[]): Promise<ReturnWithDetails> {
        const returnRecord = await this.create(returnData);

        const createdItems = await Promise.all(items.map(async (item) => {
            const createdItem = await this.adapter.insert<ReturnItem>('return_items', {
                ...item,
                return_id: returnRecord.id
            });

            const product = await this.adapter.query<Product>('products', {
                where: [{ field: 'id', operator: '=', value: createdItem.product_id }]
            }).then(res => res[0] || null);

            return {
                ...createdItem,
                product
            };
        }));

        const [customer, sale] = await Promise.all([
            returnRecord.customer_id
                ? await this.adapter.query<Customer>('customers', {
                    where: [{ field: 'id', operator: '=', value: returnRecord.customer_id }]
                }).then(res => res[0] || null)
                : null,
            returnRecord.sale_id
                ? await this.adapter.query<Sale>('sales', {
                    where: [{ field: 'id', operator: '=', value: returnRecord.sale_id }]
                }).then(res => res[0] || null)
                : null
        ]);

        return {
            ...returnRecord,
            customer,
            sale,
            items: createdItems
        };
    }
}
