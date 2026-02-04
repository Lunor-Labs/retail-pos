import { SupabaseAdapter } from './base/SupabaseAdapter';
import { ProductRepository } from './ProductRepository';
import { CustomerRepository } from './CustomerRepository';
import { SaleRepository } from './SaleRepository';
import { SupplierRepository } from './SupplierRepository';
import { PurchaseOrderRepository } from './PurchaseOrderRepository';
import { ReturnRepository } from './ReturnRepository';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

// Create singleton adapter instance
const adapter = new SupabaseAdapter(supabaseUrl, supabaseKey);

// Create repository instances
export const productRepository = new ProductRepository(adapter);
export const customerRepository = new CustomerRepository(adapter);
export const saleRepository = new SaleRepository(adapter);
export const supplierRepository = new SupplierRepository(adapter);
export const purchaseOrderRepository = new PurchaseOrderRepository(adapter);
export const returnRepository = new ReturnRepository(adapter);

// Export adapter for advanced use cases
export { adapter };

// Export repository classes for testing
export {
    ProductRepository,
    CustomerRepository,
    SaleRepository,
    SupplierRepository,
    PurchaseOrderRepository,
    ReturnRepository
};
