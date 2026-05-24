import { supabase } from '../lib/supabase';

export type RefType = 'brand' | 'category' | 'material' | 'product_name';

export interface ReferenceItem {
  id: string;
  type: RefType;
  name: string;
  active: boolean;
  created_at: string;
}

export const referenceDataService = {
  async getByType(type: RefType): Promise<ReferenceItem[]> {
    const { data, error } = await supabase
      .from('reference_data')
      .select('id, type, name, active, created_at')
      .eq('type', type)
      .order('name');
    if (error) throw error;
    return (data ?? []) as ReferenceItem[];
  },

  async getActiveNames(type: RefType): Promise<string[]> {
    const { data, error } = await supabase
      .from('reference_data')
      .select('name')
      .eq('type', type)
      .eq('active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []).map((d: any) => d.name);
  },

  async add(type: RefType, name: string): Promise<ReferenceItem> {
    const { data, error } = await supabase
      .from('reference_data')
      .insert({ type, name })
      .select()
      .single();
    if (error) throw error;
    return data as ReferenceItem;
  },

  async rename(id: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('reference_data')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('reference_data')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
