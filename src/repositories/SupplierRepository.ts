import { BaseRepository } from './base/BaseRepository';
import { DatabaseAdapter } from './base/DatabaseAdapter';
import { Supplier } from '../types';

/**
 * Repository for Supplier-related database operations
 */
export class SupplierRepository extends BaseRepository<Supplier> {
    constructor(adapter: DatabaseAdapter) {
        super(adapter, 'suppliers');
    }

    /**
     * Find suppliers by name search
     */
    async searchByName(searchTerm: string): Promise<Supplier[]> {
        return this.query({
            where: [
                { field: 'name', operator: 'like', value: `%${searchTerm}%` },
                { field: 'active', operator: '=', value: true }
            ],
            orderBy: [{ field: 'name', direction: 'asc' }]
        });
    }

    /**
     * Find active suppliers
     */
    async findActive(): Promise<Supplier[]> {
        return this.findAll({ active: true });
    }
}
