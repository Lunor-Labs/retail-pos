import { SupplierRepository } from '../repositories/SupplierRepository';
import { Supplier } from '../types';
import { logger } from '../lib/logger';

export interface CreateSupplierInput {
    name: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
}

export class SupplierService {
    constructor(private supplierRepo: SupplierRepository) { }

    /**
     * Get all active suppliers
     */
    async getActiveSuppliers(): Promise<Supplier[]> {
        try {
            return await this.supplierRepo.findAll({ active: true });
        } catch (error) {
            logger.error('Failed to fetch suppliers', error as Error);
            throw new Error('Unable to load suppliers');
        }
    }

    async createSupplier(input: CreateSupplierInput): Promise<Supplier> {
        try {
            const supplier = await this.supplierRepo.create({
                ...input,
                active: true
            });
            logger.info('Supplier created', { id: supplier.id, name: supplier.name });
            return supplier;
        } catch (error) {
            logger.error('Failed to create supplier', error as Error);
            throw error;
        }
    }

    async updateSupplier(id: string, updates: Partial<CreateSupplierInput>): Promise<Supplier> {
        try {
            const supplier = await this.supplierRepo.update(id, updates);
            logger.info('Supplier updated', { id });
            return supplier;
        } catch (error) {
            logger.error('Failed to update supplier', error as Error);
            throw error;
        }
    }
}
