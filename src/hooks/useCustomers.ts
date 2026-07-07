import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllRows } from '../lib/paginate';
import { Customer } from '../types';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchAllRows<Customer>(() =>
        supabase.from('customers').select('*').order('name').order('id'),
      );

      setCustomers(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load customers';
      setError(errorMessage);
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  return {
    customers,
    loading,
    error,
    refetch: loadCustomers,
  };
}
