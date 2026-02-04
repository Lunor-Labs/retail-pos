import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { PurchaseOrder, PurchaseOrderItem, Supplier, Product } from '../types';

export interface PurchaseOrderWithDetails extends PurchaseOrder {
    supplier: Supplier | null;
    items: (PurchaseOrderItem & { product: Product | null })[];
}

/**
 * Repository for Purchase Order operations
 */
export class PurchaseOrderRepository extends BaseRepository<PurchaseOrder> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'purchase_orders');
    }

    /**
     * Find all purchase orders with items and supplier details
     */
    async findAllWithDetails(): Promise<PurchaseOrderWithDetails[]> {
        const orders = await this.findAll();

        return Promise.all(orders.map(async (order) => {
            const [supplier, items] = await Promise.all([
                this.adapter.query<Supplier>('suppliers', {
                    where: [{ field: 'id', operator: '=', value: order.supplier_id }]
                }).then(res => res[0] || null),
                this.findItemsByOrderId(order.id)
            ]);

            return {
                ...order,
                supplier,
                items
            };
        }));
    }

    /**
     * Find items for a specific purchase order with product details
     */
    async findItemsByOrderId(orderId: string): Promise<(PurchaseOrderItem & { product: Product | null })[]> {
        const items = await this.adapter.query<PurchaseOrderItem>('purchase_order_items', {
            where: [{ field: 'purchase_order_id', operator: '=', value: orderId }]
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
     * Create a purchase order with its items
     */
    async createWithItems(poData: Partial<PurchaseOrder>, items: Partial<PurchaseOrderItem>[]): Promise<PurchaseOrderWithDetails> {
        const po = await this.create(poData);

        const createdItems = await Promise.all(items.map(async (item) => {
            const createdItem = await this.adapter.insert<PurchaseOrderItem>('purchase_order_items', {
                ...item,
                purchase_order_id: po.id
            });

            const product = await this.adapter.query<Product>('products', {
                where: [{ field: 'id', operator: '=', value: createdItem.product_id }]
            }).then(res => res[0] || null);

            return {
                ...createdItem,
                product
            };
        }));

        const supplier = await this.adapter.query<Supplier>('suppliers', {
            where: [{ field: 'id', operator: '=', value: po.supplier_id }]
        }).then(res => res[0] || null);

        return {
            ...po,
            supplier,
            items: createdItems
        };
    }
}
