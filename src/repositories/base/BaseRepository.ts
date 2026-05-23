import { IRepository } from './IRepository';
import { DatabaseAdapter, QueryOptions } from './DatabaseAdapter';

/**
 * Base repository implementation with common CRUD operations
 */
export abstract class BaseRepository<T, ID = string> implements IRepository<T, ID> {
    constructor(
        protected adapter: DatabaseAdapter,
        protected tableName: string
    ) { }

    async findAll(filters?: Record<string, any>): Promise<T[]> {
        const options: QueryOptions = {};

        if (filters) {
            options.where = Object.entries(filters).map(([field, value]) => ({
                field,
                operator: '=' as const,
                value,
            }));
        }

        return this.adapter.query<T>(this.tableName, options);
    }

    async findById(id: ID): Promise<T | null> {
        const results = await this.adapter.query<T>(this.tableName, {
            where: [{ field: 'id', operator: '=', value: id }],
            limit: 1,
        });

        return results[0] || null;
    }

    async create(data: Partial<T>): Promise<T> {
        return this.adapter.insert<T>(this.tableName, data);
    }

    async update(id: ID, data: Partial<T>): Promise<T> {
        return this.adapter.update<T>(this.tableName, id as string, data);
    }

    async delete(id: ID): Promise<void> {
        return this.adapter.delete(this.tableName, id as string);
    }

    async exists(id: ID): Promise<boolean> {
        const result = await this.findById(id);
        return result !== null;
    }

    async count(filters?: Record<string, any>): Promise<number> {
        const results = await this.findAll(filters);
        return results.length;
    }

    /**
     * Helper method for complex queries
     */
    protected async query(options: QueryOptions): Promise<T[]> {
        return this.adapter.query<T>(this.tableName, options);
    }
}
