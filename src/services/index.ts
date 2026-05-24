import { productRepository, customerRepository, saleRepository, adapter, supplierRepository, referralAgentRepository, purchaseOrderRepository, returnRepository, variantRepository, loyaltyRepository } from '../repositories';
import { ProductService } from './ProductService';
import { SalesService } from './SalesService';
import { InventoryService } from './InventoryService';
import { CustomerService } from './CustomerService';
import { SupplierService } from './SupplierService';
import { PurchaseOrderService } from './PurchaseOrderService';
import { ReturnService } from './ReturnService';
import { VariantService } from './VariantService';
import { LoyaltyService } from './LoyaltyService';

// Create service instances
export const productService = new ProductService(productRepository);
export const inventoryService = new InventoryService(productRepository, adapter);
export const salesService = new SalesService(saleRepository, customerRepository, productRepository, inventoryService);
export const customerService = new CustomerService(customerRepository, referralAgentRepository);
export const supplierService = new SupplierService(supplierRepository);
export const purchaseOrderService = new PurchaseOrderService(purchaseOrderRepository, productService);
export const returnService = new ReturnService(returnRepository, productService, customerService);
export const variantService = new VariantService(variantRepository);
export const loyaltyService = new LoyaltyService(loyaltyRepository);
export { referenceDataService } from './ReferenceDataService';
export type { RefType, ReferenceItem } from './ReferenceDataService';

// Export service classes for testing
export { ProductService, SalesService, InventoryService, CustomerService, SupplierService, PurchaseOrderService, ReturnService, VariantService, LoyaltyService };
