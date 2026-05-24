export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'cashier' | 'stock_manager' | 'staff'
          active: boolean
          daily_target: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'cashier' | 'stock_manager' | 'staff'
          active?: boolean
          daily_target?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'cashier' | 'stock_manager'
          active?: boolean
          daily_target?: number
          created_at?: string
          updated_at?: string
        }
      }
      staff_members: {
        Row: {
          id: string
          full_name: string
          email: string
          active: boolean
          daily_target: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string
          active?: boolean
          daily_target?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          active?: boolean
          daily_target?: number
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          address: string | null
          notes: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category: string | null
          brand: string | null
          gender: 'men' | 'women' | 'kids' | 'unisex' | null
          material: string | null
          unit: 'piece' | 'yard' | 'meter' | 'pack'
          image_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name: string
          description?: string | null
          category?: string | null
          brand?: string | null
          gender?: 'men' | 'women' | 'kids' | 'unisex' | null
          material?: string | null
          unit?: 'piece' | 'yard' | 'meter' | 'pack'
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          description?: string | null
          category?: string | null
          brand?: string | null
          gender?: 'men' | 'women' | 'kids' | 'unisex' | null
          material?: string | null
          unit?: 'piece' | 'yard' | 'meter' | 'pack'
          image_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          size: string | null
          color: string | null
          sku: string
          barcode: string | null
          reorder_level: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          size?: string | null
          color?: string | null
          sku: string
          barcode?: string | null
          reorder_level?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          size?: string | null
          color?: string | null
          sku?: string
          barcode?: string | null
          reorder_level?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_batches: {
        Row: {
          id: string
          variant_id: string
          batch_number: string
          purchase_order_id: string | null
          supplier_id: string
          cost_price: number
          selling_price: number
          markup_percentage: number
          initial_quantity: number
          current_quantity: number
          received_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          batch_number: string
          purchase_order_id?: string | null
          supplier_id: string
          cost_price: number
          selling_price: number
          markup_percentage?: number
          initial_quantity: number
          current_quantity: number
          received_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          batch_number?: string
          purchase_order_id?: string | null
          supplier_id?: string
          cost_price?: number
          selling_price?: number
          markup_percentage?: number
          initial_quantity?: number
          current_quantity?: number
          received_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string | null
          email: string | null
          address: string | null
          credit_limit: number
          current_credit: number
          loyalty_points: number
          notes: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          email?: string | null
          address?: string | null
          credit_limit?: number
          current_credit?: number
          loyalty_points?: number
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          credit_limit?: number
          current_credit?: number
          loyalty_points?: number
          notes?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      referral_agents: {
        Row: {
          id: string
          name: string
          type: 'full_time' | 'part_time' | null
          phone: string | null
          email: string | null
          address: string | null
          commission_rate: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: 'full_time' | 'part_time' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          commission_rate?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'full_time' | 'part_time' | null
          phone?: string | null
          email?: string | null
          address?: string | null
          commission_rate?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          supplier_id: string
          order_date: string
          received_date: string | null
          status: 'pending' | 'received' | 'cancelled'
          total_amount: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          po_number: string
          supplier_id: string
          order_date?: string
          received_date?: string | null
          status?: 'pending' | 'received' | 'cancelled'
          total_amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          po_number?: string
          supplier_id?: string
          order_date?: string
          received_date?: string | null
          status?: 'pending' | 'received' | 'cancelled'
          total_amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          quantity: number
          cost_price: number
          selling_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          purchase_order_id: string
          product_id: string
          quantity: number
          cost_price: number
          selling_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          purchase_order_id?: string
          product_id?: string
          quantity?: number
          cost_price?: number
          selling_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          sale_number: string
          customer_id: string | null
          referral_agent_id: string | null
          sale_date: string
          subtotal: number
          tax_amount: number
          discount_amount: number
          service_charge: number
          total_amount: number
          paid_amount: number
          payment_method: 'cash' | 'card' | 'credit' | 'mixed' | null
          status: 'completed' | 'partial' | 'credit'
          notes: string | null
          cashier_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sale_number: string
          customer_id?: string | null
          referral_agent_id?: string | null
          sale_date?: string
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          service_charge?: number
          total_amount: number
          paid_amount?: number
          payment_method?: 'cash' | 'card' | 'credit' | 'mixed' | null
          status?: 'completed' | 'partial' | 'credit'
          notes?: string | null
          cashier_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sale_number?: string
          customer_id?: string | null
          referral_agent_id?: string | null
          sale_date?: string
          subtotal?: number
          tax_amount?: number
          discount_amount?: number
          service_charge?: number
          total_amount?: number
          paid_amount?: number
          payment_method?: 'cash' | 'card' | 'credit' | 'mixed' | null
          status?: 'completed' | 'partial' | 'credit'
          notes?: string | null
          cashier_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string | null
          variant_id: string | null
          batch_id: string | null
          quantity: number
          unit_price: number
          selling_price: number | null
          cost_price: number
          subtotal: number
          is_manual: boolean
          manual_description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          product_id?: string | null
          variant_id?: string | null
          batch_id?: string | null
          quantity: number
          unit_price: number
          selling_price?: number | null
          cost_price: number
          subtotal: number
          is_manual?: boolean
          manual_description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string | null
          variant_id?: string | null
          batch_id?: string | null
          quantity?: number
          unit_price?: number
          selling_price?: number | null
          cost_price?: number
          subtotal?: number
          is_manual?: boolean
          manual_description?: string | null
          created_at?: string
        }
      }
      returns: {
        Row: {
          id: string
          return_number: string
          sale_id: string | null
          customer_id: string | null
          return_date: string
          total_amount: number
          refund_method: 'cash' | 'credit_note' | 'exchange' | null
          reason: string | null
          status: 'pending' | 'approved' | 'rejected'
          processed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          return_number: string
          sale_id?: string | null
          customer_id?: string | null
          return_date?: string
          total_amount: number
          refund_method?: 'cash' | 'credit_note' | 'exchange' | null
          reason?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          processed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          return_number?: string
          sale_id?: string | null
          customer_id?: string | null
          return_date?: string
          total_amount?: number
          refund_method?: 'cash' | 'credit_note' | 'exchange' | null
          reason?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          processed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      return_items: {
        Row: {
          id: string
          return_id: string
          sale_item_id: string | null
          product_id: string | null
          variant_id: string | null
          batch_id: string | null
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          return_id: string
          sale_item_id?: string | null
          product_id?: string | null
          variant_id?: string | null
          batch_id?: string | null
          quantity: number
          unit_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          return_id?: string
          sale_item_id?: string | null
          product_id?: string | null
          variant_id?: string | null
          batch_id?: string | null
          quantity?: number
          unit_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      referral_commissions: {
        Row: {
          id: string
          sale_id: string
          referral_agent_id: string
          commission_rate: number
          sale_amount: number
          commission_amount: number
          status: 'pending' | 'paid'
          payment_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          referral_agent_id: string
          commission_rate: number
          sale_amount: number
          commission_amount: number
          status?: 'pending' | 'paid'
          payment_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          referral_agent_id?: string
          commission_rate?: number
          sale_amount?: number
          commission_amount?: number
          status?: 'pending' | 'paid'
          payment_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loyalty_transactions: {
        Row: {
          id: string
          customer_id: string
          sale_id: string | null
          type: 'earn' | 'redeem'
          points: number
          balance_after: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          sale_id?: string | null
          type: 'earn' | 'redeem'
          points: number
          balance_after: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          sale_id?: string | null
          type?: 'earn' | 'redeem'
          points?: number
          balance_after?: number
          notes?: string | null
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
