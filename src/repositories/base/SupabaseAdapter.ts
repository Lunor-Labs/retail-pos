import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../lib/database.types';
import {
    DatabaseAdapter,
    QueryOptions,
    Transaction,
    WhereClause,
} from './DatabaseAdapter';

/**
 * Supabase implementation of the DatabaseAdapter
 */
export class SupabaseAdapter implements DatabaseAdapter {
    private client: SupabaseClient<Database>;

    constructor(url: string, key: string) {
        this.client = createClient<Database>(url, key);
    }

    /**
     * Get the underlying Supabase client (for advanced operations)
     */
    getClient(): SupabaseClient<Database> {
        return this.client;
    }

    async query<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
        // Handle select - can be array or string (for Supabase joins)
        let selectClause = '*';
        if (options.select) {
            if (Array.isArray(options.select)) {
                selectClause = options.select.join(',');
            } else if (typeof options.select === 'string') {
                selectClause = options.select;
            }
        }

        let query = this.client.from(table).select(selectClause);

        // Apply where clauses
        if (options.where) {
            for (const clause of options.where) {
                query = this.applyWhereClause(query, clause);
            }
        }

        // Apply ordering
        if (options.orderBy) {
            for (const order of options.orderBy) {
                query = query.order(order.field, { ascending: order.direction === 'asc' });
            }
        }

        // Apply pagination
        if (options.limit) {
            query = query.limit(options.limit);
        }
        if (options.offset) {
            query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Database query failed: ${error.message}`);
        }

        return (data as T[]) || [];
    }

    async insert<T>(table: string, data: Partial<T>): Promise<T> {
        const { data: result, error } = await this.client
            .from(table)
            .insert(data as any)
            .select()
            .single();

        if (error) {
            throw new Error(`Database insert failed: ${error.message}`);
        }

        return result as T;
    }

    async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
        const { data: result, error } = await (this.client.from(table) as any)
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Database update failed: ${error.message}`);
        }

        return result as T;
    }

    async delete(table: string, id: string): Promise<void> {
        const { error } = await this.client.from(table).delete().eq('id', id);

        if (error) {
            throw new Error(`Database delete failed: ${error.message}`);
        }
    }

    async raw<T>(_query: string, _params?: any[]): Promise<T[]> {
        // Supabase doesn't support raw SQL directly in the client
        // This would need to be implemented via RPC functions
        throw new Error('Raw queries not implemented for Supabase adapter');
    }

    async beginTransaction(): Promise<Transaction> {
        // Supabase doesn't support client-side transactions
        // This is a limitation we'll document
        throw new Error('Transactions not supported in Supabase client');
    }

    private applyWhereClause(query: any, clause: WhereClause): any {
        const { field, operator, value } = clause;

        switch (operator) {
            case '=':
                return query.eq(field, value);
            case '!=':
                return query.neq(field, value);
            case '>':
                return query.gt(field, value);
            case '<':
                return query.lt(field, value);
            case '>=':
                return query.gte(field, value);
            case '<=':
                return query.lte(field, value);
            case 'in':
                return query.in(field, value);
            case 'like':
                return query.ilike(field, `%${value}%`);
            default:
                return query;
        }
    }
}
