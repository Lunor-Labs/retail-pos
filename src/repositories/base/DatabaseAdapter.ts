/**
 * Database adapter interface
 * Abstracts the underlying database implementation
 */
export interface DatabaseAdapter {
    /**
     * Execute a query and return results
     */
    query<T>(table: string, options?: QueryOptions): Promise<T[]>;

    /**
     * Insert a record
     */
    insert<T>(table: string, data: Partial<T>): Promise<T>;

    /**
     * Update records
     */
    update<T>(table: string, id: string, data: Partial<T>): Promise<T>;

    /**
     * Delete a record
     */
    delete(table: string, id: string): Promise<void>;

    /**
     * Execute a raw query (for complex operations)
     */
    raw<T>(query: string, params?: any[]): Promise<T[]>;

    /**
     * Call a stored database function. The way to run an operation that has to be
     * atomic, since the client cannot open a transaction of its own.
     */
    rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T>;

    /**
     * Begin a transaction
     */
    beginTransaction(): Promise<Transaction>;
}

export interface QueryOptions {
    select?: string | string[]; // Support both array and string (for Supabase joins)
    where?: WhereClause[];
    orderBy?: OrderByClause[];
    limit?: number;
    offset?: number;
    join?: JoinClause[];
}

export interface WhereClause {
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'like';
    value: any;
}

export interface OrderByClause {
    field: string;
    direction: 'asc' | 'desc';
}

export interface JoinClause {
    table: string;
    on: string;
    type?: 'inner' | 'left' | 'right';
}

export interface Transaction {
    commit(): Promise<void>;
    rollback(): Promise<void>;
    query<T>(table: string, options?: QueryOptions): Promise<T[]>;
    insert<T>(table: string, data: Partial<T>): Promise<T>;
    update<T>(table: string, id: string, data: Partial<T>): Promise<T>;
    delete(table: string, id: string): Promise<void>;
}
