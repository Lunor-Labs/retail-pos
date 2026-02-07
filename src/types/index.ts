import { Database } from '../lib/database.types';

export type Product = Database['public']['Tables']['products']['Row'];
export type ProductBatch = Database['public']['Tables']['product_batches']['Row'] & {
  markup_percentage?: number;
  supplier?: { name: string };
};
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type ReferralAgent = Database['public']['Tables']['referral_agents']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'] & {
  warranty_duration?: number;
  warranty_unit?: 'days' | 'months' | 'years' | null;
  warranty_type?: string | null;
};
export type Return = Database['public']['Tables']['returns']['Row'];
export type ReturnItem = Database['public']['Tables']['return_items']['Row'];
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

export interface ProductWithStock extends Product {
  batches: ProductBatch[];
  total_stock: number;
}

export interface ProductWithBatches extends Product {
  batches: ProductBatch[];
  total_stock: number;
  search_words?: string[];
}

export interface CartItem {
  product: Product;
  batch: ProductBatch;
  quantity: number;
  price: number; // The actual selling price (editable)
  original_price: number; // The base selling price from batch
  warranty_duration?: number;
  warranty_unit?: 'days' | 'months' | 'years';
  warranty_type?: string;
}
