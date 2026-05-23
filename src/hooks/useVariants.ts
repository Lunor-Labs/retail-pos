import { useState, useEffect, useCallback } from 'react';
import { VariantWithStock } from '../types';
import { variantService } from '../services';

export function useVariants(productId: string | null) {
  const [variants, setVariants] = useState<VariantWithStock[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!productId) { setVariants([]); return; }
    setLoading(true);
    try {
      const data = await variantService.getVariantsForProduct(productId);
      setVariants(data);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const addVariant = async (data: Parameters<typeof variantService.createVariant>[0]) => {
    await variantService.createVariant(data);
    await load();
  };

  const updateVariant = async (id: string, data: Parameters<typeof variantService.updateVariant>[1]) => {
    await variantService.updateVariant(id, data);
    await load();
  };

  return { variants, loading, addVariant, updateVariant, reload: load };
}
