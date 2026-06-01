import { useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../contexts/AuthContext';

export type AuditActionType =
  | 'product_added'
  | 'product_updated'
  | 'product_deleted'
  | 'variant_added'
  | 'variant_updated'
  | 'batch_updated'
  | 'stock_restocked'
  | 'csv_imported';

interface AuditParams {
  action_type: AuditActionType;
  actor_id?: string;
  actor_name: string;
  product_id?: string;
  product_name: string;
  detail?: string;
}

export async function logProductAction(params: AuditParams): Promise<void> {
  try {
    await (supabase.from('product_audit_log') as any).insert({
      action_type: params.action_type,
      actor_id: params.actor_id ?? null,
      actor_name: params.actor_name,
      product_id: params.product_id ?? null,
      product_name: params.product_name,
      detail: params.detail ?? null,
    });
  } catch {
    // Audit failures must never break the main operation
  }
}

// Hook that pre-fills actor info from auth context
export function useProductAudit() {
  const { profile } = useAuth();

  return useCallback(
    (params: Omit<AuditParams, 'actor_id' | 'actor_name'>) =>
      logProductAction({
        ...params,
        actor_id: profile?.id,
        actor_name: profile?.full_name ?? 'Unknown',
      }),
    [profile]
  );
}
