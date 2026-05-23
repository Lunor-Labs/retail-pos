// Base repository interface for all data access operations
export interface IRepository<T, ID = string> {
    /**
     * Find all records with optional filtering
     */
    findAll(filters?: Record<string, any>): Promise<T[]>;

    /**
     * Find a single record by ID
     */
    findById(id: ID): Promise<T | null>;

    /**
     * Create a new record
     */
    create(data: Partial<T>): Promise<T>;

    /**
     * Update an existing record
     */
    update(id: ID, data: Partial<T>): Promise<T>;

    /**
     * Delete a record by ID
     */
    delete(id: ID): Promise<void>;

    /**
     * Check if a record exists
     */
    exists(id: ID): Promise<boolean>;

    /**
     * Count records with optional filtering
     */
    count(filters?: Record<string, any>): Promise<number>;
}

/**
 * Query builder interface for complex queries
 */
export interface QueryBuilder<T> {
    select(fields: string[]): QueryBuilder<T>;
    where(field: string, operator: string, value: any): QueryBuilder<T>;
    orderBy(field: string, direction: 'asc' | 'desc'): QueryBuilder<T>;
    limit(count: number): QueryBuilder<T>;
    offset(count: number): QueryBuilder<T>;
    execute(): Promise<T[]>;
    first(): Promise<T | null>;
}
