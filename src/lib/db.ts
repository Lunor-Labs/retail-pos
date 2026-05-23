import Dexie, { Table } from 'dexie';
import { ProductWithBatches } from '../types';

// Define the Offline Sale Interface
export interface OfflineSale {
    id?: number; // Auto-incremented ID
    sale_data: any; // The payload we would send to Supabase
    created_at: string;
    synced: boolean;
    status: 'pending' | 'syncing' | 'failed' | 'idle';
    error?: string;
}

// Define the Database
export class GasithMotorsDB extends Dexie {
    products!: Table<ProductWithBatches, string>; // Maps to 'products' table, indexed by 'id'
    offline_sales!: Table<OfflineSale, number>;

    constructor() {
        super('GasithMotorsPOS');

        this.version(1).stores({
            products: 'id, sku, barcode, name, *name_words', // Index name_words for full-text-like search
            offline_sales: '++id, created_at, status'
        });
    }
}

export const db = new GasithMotorsDB();

// Hook to populate search_words before saving
db.products.hook('creating', function (_primKey, obj, _transaction) {
    if (typeof obj.name === 'string') {
        obj.search_words = obj.name.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    }
});

db.products.hook('updating', function (mods, _primKey, _obj, _transaction) {
    const modifications = mods as any;
    if (modifications.name && typeof modifications.name === 'string') {
        return { search_words: modifications.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 0) };
    }
});
