import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { encodeCost, decodeCost, isValidCostCode, isValidKey } from '../lib/costCode';

interface CostCodeContextType {
  key: string;
  isConfigured: boolean;
  encode: (n: number) => string;
  decode: (s: string) => number;
  isValid: (s: string) => boolean;
  reload: () => void;
}

const CostCodeContext = createContext<CostCodeContextType>({
  key: '',
  isConfigured: false,
  encode: (n) => Math.round(n).toString(),
  decode: (s) => parseFloat(s) || 0,
  isValid: (s) => !isNaN(parseFloat(s)),
  reload: () => {},
});

export function CostCodeProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState('');

  async function load() {
    try {
      const { data } = await (supabase.from('app_settings') as any)
        .select('value')
        .eq('key', 'cost_code_key')
        .maybeSingle();
      const raw = data?.value ?? '';
      setKey(isValidKey(raw) ? raw.toUpperCase() : '');
    } catch {
      setKey('');
    }
  }

  useEffect(() => { load(); }, []);

  const isConfigured = isValidKey(key);

  const value: CostCodeContextType = {
    key,
    isConfigured,
    encode: (n) => encodeCost(n, key),
    decode: (s) => decodeCost(s, key),
    isValid: (s) => isValidCostCode(s, key),
    reload: load,
  };

  return (
    <CostCodeContext.Provider value={value}>
      {children}
    </CostCodeContext.Provider>
  );
}

export const useCostCode = () => useContext(CostCodeContext);
