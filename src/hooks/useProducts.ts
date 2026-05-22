import { useState, useEffect, useCallback } from 'react';
import { ProductWithBatches } from '../types';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { productService } from '../services';
import { logger } from '../lib/logger';
import { expandSearchTerm } from '../utils/searchUtils';

export type SearchType = 'all' | 'name' | 'sku' | 'barcode';
export type StockFilter = 'all' | 'low_stock' | 'out_of_stock';

/**
 * Hook for managing products with offline support
 * Uses ProductService for data access and IndexedDB for offline caching
 */
export function useProducts(
  page: number = 1,
  pageSize: number = 20,
  searchQuery: string = '',
  searchType: SearchType = 'all',
  stockFilter: StockFilter = 'all'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<number>(0);

  /**
   * Sync products from database to IndexedDB for offline use
   */
  const syncProducts = useCallback(async (force = false) => {
    if (!navigator.onLine) {
      logger.debug('Skipping sync - offline');
      return;
    }

    // Throttle syncs - skip if synced in the last 60 seconds unless forced
    const now = Date.now();
    if (!force && now - lastSync < 60000) {
      logger.debug('Skipping sync - recently updated');
      return;
    }

    try {
      // Fetch all products from server
      const products = await productService.getAllProducts();

      // Convert to ProductWithBatches format for IndexedDB
      const productsWithBatches: ProductWithBatches[] = products.map(product => ({
        ...product,
        batches: product.batches || [],
        total_stock: product.total_stock || 0,
      }));

      // Update IndexedDB - bulkPut updates existing and adds new
      // We don't clear() to avoid UI flickering ("shaking")
      await db.products.bulkPut(productsWithBatches);

      // Remove local products that are no longer on the server
      const serverIds = new Set(products.map(p => p.id));
      const localIds = await db.products.toCollection().primaryKeys();
      const idsToRemove = localIds.filter(id => !serverIds.has(id));
      if (idsToRemove.length > 0) {
        await db.products.bulkDelete(idsToRemove);
      }

      setSyncStatus('idle');
      setLastSync(Date.now());
      logger.info('Product sync completed', { count: products.length });
    } catch (err) {
      logger.error('Product sync failed', err as Error);
      setSyncStatus('error');
      setError('Sync failed, but you can still use offline data.');
    }
  }, []);

  /**
   * Initial sync on mount
   */
  useEffect(() => {
    const checkInitialLoad = async () => {
      const count = await db.products.count();
      if (count === 0) {
        setLoading(true);
        logger.info('No cached products, performing initial sync');
      }
      await syncProducts();
      setLoading(false);
    };
    checkInitialLoad();
  }, [syncProducts]);

  /**
   * Query local IndexedDB with live updates
   */
  const queryResult = useLiveQuery(async () => {
    try {
      let collection = db.products.toCollection();

      // Apply search filters
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        // Expand search term to include synonyms
        const expandedTerms = expandSearchTerm(query);

        switch (searchType) {
          case 'sku':
            collection = db.products.filter(p => p.sku.toLowerCase() === query);
            break;
          case 'barcode':
            collection = db.products.where('barcode').equals(query);
            break;
          case 'name':
            collection = db.products.filter(p => {
              // Check if ANY of the expanded terms match the product name
              return expandedTerms.some(term => {
                // Multi-word check for each expanded term
                const words = term.split(/\s+/);
                const match = words.every(word => p.name.toLowerCase().includes(word));
                if (match) return true;

                // Fallback: Space-insensitive check
                const normalizedName = p.name.toLowerCase().replace(/\s+/g, '');
                const normalizedTerm = term.replace(/\s+/g, '');
                return normalizedName.includes(normalizedTerm);
              });
            });
            break;
          case 'all':
          default:
            collection = db.products.filter(p => {
              const nameMatch = expandedTerms.some(term => {
                const words = term.split(/\s+/);
                return words.every(word => p.name.toLowerCase().includes(word));
              });
              if (nameMatch) return true;

              const brandMatch = (p as any).brand
                ? expandedTerms.some(term => (p as any).brand!.toLowerCase().includes(term))
                : false;
              if (brandMatch) return true;

              return p.sku.toLowerCase() === query ||
                p.name.toLowerCase().replace(/\s+/g, '').includes(query.replace(/\s+/g, ''));
            });
            break;
        }
      }

      // Apply stock status filters
      if (stockFilter === 'low_stock') {
        collection = collection.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= 5);
      } else if (stockFilter === 'out_of_stock') {
        collection = collection.filter(p => (p.total_stock || 0) === 0);
      }

      // Pagination
      const count = await collection.count();
      // Get data and handle sorting
      let data: ProductWithBatches[];
      const offset = (page - 1) * pageSize;

      if (!searchQuery.trim() && stockFilter === 'all') {
        // Optimized path: Use Dexie to get all then sort in memory for natural ordering
        // Standard index-based orderBy is lexicographical (1, 10, 100)
        // For natural sort (1, 2, 10), we sort in memory. 
        // Modern JS handles several thousand items in < 5ms.
        const allProducts = await db.products.toArray();
        allProducts.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));
        data = allProducts.slice(offset, offset + pageSize);
      } else {
        // Filtered path: Fetch all filtered items and sort in memory natural order
        const allFiltered = await collection.toArray();
        allFiltered.sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));
        data = allFiltered.slice(offset, offset + pageSize);
      }

      return { products: data, totalCount: count };
    } catch (err) {
      logger.error('Local product query failed', err as Error);
      return { products: [], totalCount: 0 };
    }
  }, [page, pageSize, searchQuery, searchType, stockFilter]);

  return {
    products: queryResult?.products || [],
    loading,
    error,
    totalCount: queryResult?.totalCount || 0,
    totalPages: Math.ceil((queryResult?.totalCount || 0) / pageSize),
    refetch: syncProducts,
    syncStatus
  };
}
