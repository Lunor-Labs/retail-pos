import { Database } from '../lib/database.types';

export type Product = Database['public']['Tables']['products']['Row'];
export type ProductVariant = Database['public']['Tables']['product_variants']['Row'];
export type ProductBatch = Database['public']['Tables']['product_batches']['Row'] & {
  supplier?: { name: string };
};
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type ReferralAgent = Database['public']['Tables']['referral_agents']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type Return = Database['public']['Tables']['returns']['Row'];
export type ReturnItem = Database['public']['Tables']['return_items']['Row'];
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type LoyaltyTransaction = Database['public']['Tables']['loyalty_transactions']['Row'];
export type AppSetting = Database['public']['Tables']['app_settings']['Row'];

export interface VariantWithStock extends ProductVariant {
  batches: ProductBatch[];
  total_stock: number;
}

export interface ProductWithVariants extends Product {
  variants: VariantWithStock[];
  total_stock: number;
  base_price: number;
}

// Kept for purchase order and product management screens that don't use variants yet
export interface ProductWithStock extends Product {
  batches: ProductBatch[];
  total_stock: number;
  base_price: number;
}

export interface ProductWithBatches extends Product {
  batches: ProductBatch[];
  total_stock: number;
  base_price: number;
  search_words?: string[];
}

export interface CartItem {
  product: Product;
  variant?: ProductVariant;
  batch: ProductBatch;
  quantity: number;
  price: number;
  original_price: number;
  isManual?: boolean;
  manualDescription?: string;
}
