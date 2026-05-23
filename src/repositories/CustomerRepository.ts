import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { Customer } from '../types';

/**
 * Repository for Customer-related database operations
 */
export class CustomerRepository extends BaseRepository<Customer> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'customers');
    }

    /**
     * Find all active customers
     */
    async findAllActive(): Promise<Customer[]> {
        return this.findAll({ active: true });
    }

    /**
     * Count all active customers
     */
    async countActive(): Promise<number> {
        return this.count({ active: true });
    }

    /**
     * Find customer by phone number
     */
    async findByPhone(phone: string): Promise<Customer | null> {
        const results = await this.query({
            where: [{ field: 'phone', operator: '=', value: phone }],
            limit: 1,
        });

        return results[0] || null;
    }

    /**
     * Find customer by email
     */
    async findByEmail(email: string): Promise<Customer | null> {
        const results = await this.query({
            where: [{ field: 'email', operator: '=', value: email }],
            limit: 1,
        });

        return results[0] || null;
    }

    /**
     * Search customers by name or phone
     */
    async search(searchTerm: string): Promise<Customer[]> {
        // Note: This is a simplified search. In production, you'd want to use
        // full-text search or multiple OR conditions
        const byName = await this.query({
            where: [
                { field: 'name', operator: 'like', value: searchTerm },
                { field: 'active', operator: '=', value: true },
            ],
        });

        const byPhone = await this.query({
            where: [
                { field: 'phone', operator: 'like', value: searchTerm },
                { field: 'active', operator: '=', value: true },
            ],
        });

        // Merge and deduplicate
        const merged = [...byName, ...byPhone];
        const unique = merged.filter((customer, index, self) =>
            index === self.findIndex(c => c.id === customer.id)
        );

        return unique;
    }

    /**
     * Find customers with outstanding credit
     */
    async findWithCredit(): Promise<Customer[]> {
        const allCustomers = await this.findAllActive();
        return allCustomers.filter(c => c.current_credit > 0);
    }

    /**
     * Update customer credit
     */
    async updateCredit(customerId: string, amount: number): Promise<Customer> {
        const customer = await this.findById(customerId);
        if (!customer) {
            throw new Error(`Customer not found: ${customerId}`);
        }

        const newCredit = customer.current_credit + amount;

        if (newCredit < 0) {
            throw new Error('Credit cannot be negative');
        }

        if (newCredit > customer.credit_limit) {
            throw new Error('Credit limit exceeded');
        }

        return this.update(customerId, {
            current_credit: newCredit,
            updated_at: new Date().toISOString(),
        } as Partial<Customer>);
    }
}
