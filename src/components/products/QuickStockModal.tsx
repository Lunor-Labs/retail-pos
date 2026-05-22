import { useState, useEffect } from 'react';
import { Modal } from '../ui';
import { useToast } from '../../contexts/ToastContext';
import { productService, supplierService } from '../../services';
import { ProductWithStock } from '../../types';

interface QuickStockModalProps {
  product: ProductWithStock;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickStockModal({ product, onClose, onSuccess }: QuickStockModalProps) {
  const { showToast } = useToast();
  const [variants, setVariants] = useState<{ id: string; label: string; stock: number }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [qty, setQty] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>('');
  const [markup, setMarkup] = useState<number | ''>('');
  const [selling, setSelling] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productService.getProductWithVariants(product.id),
      supplierService.getActiveSuppliers(),
    ]).then(([p, s]) => {
      if (p && p.variants.length > 0) {
        const mapped = p.variants.map(v => ({
          id: v.id,
          label: [v.size, v.color].filter(Boolean).join(' · ') || 'Default',
          stock: (v as any).total_stock ?? 0,
        }));
        setVariants(mapped);
        setSelectedVariantId(mapped[0].id);

        // Pre-fill pricing from the most recent batch across all variants
        const allBatches = p.variants.flatMap(v => (v as any).batches ?? []);
        if (allBatches.length > 0) {
          const latest = allBatches.reduce((a: any, b: any) =>
            new Date(b.created_at) > new Date(a.created_at) ? b : a
          );
          setCost(latest.cost_price);
          setMarkup(latest.markup_percentage);
          setSelling(latest.selling_price);
          if (latest.supplier_id) setSupplierId(latest.supplier_id);
        }
      }
      setSuppliers(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [product.id]);

  function updateCost(val: number | '') {
    setCost(val);
    if (val !== '' && markup !== '') {
      setSelling(parseFloat((val * (1 + (markup as number) / 100)).toFixed(2)));
    }
  }

  function updateMarkup(val: number | '') {
    setMarkup(val);
    if (val !== '' && cost !== '') {
      setSelling(parseFloat(((cost as number) * (1 + (val as number) / 100)).toFixed(2)));
    }
  }

  function updateSelling(val: number | '') {
    setSelling(val);
    if (val !== '' && cost !== '' && (cost as number) > 0) {
      setMarkup(parseFloat((((val as number) - (cost as number)) / (cost as number) * 100).toFixed(2)));
    }
  }

  async function handleSubmit() {
    if (!selectedVariantId) { showToast('Select a variant', 'error'); return; }
    if (!supplierId) { showToast('Select a supplier', 'error'); return; }
    if (!qty || (qty as number) <= 0) { showToast('Quantity must be greater than 0', 'error'); return; }

    setSaving(true);
    try {
      const client = (productService as any).productRepo.adapter.getClient();
      const { error } = await client.from('product_batches').insert({
        variant_id: selectedVariantId,
        supplier_id: supplierId,
        batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        cost_price: cost || 0,
        markup_percentage: markup || 0,
        selling_price: selling || 0,
        initial_quantity: qty,
        current_quantity: qty,
        received_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);

      const varLabel = variants.find(v => v.id === selectedVariantId)?.label ?? '';
      showToast(`Added ${qty} units to ${varLabel}`, 'success');
      onSuccess();
      onClose();
    } catch (e: any) {
      showToast(e.message || 'Failed to add stock', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 10px',
    border: '1px solid var(--line)', borderRadius: 8,
    fontSize: 13, color: 'var(--ink)', background: 'var(--panel)',
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11.5, fontWeight: 600,
    color: 'var(--muted)', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: '.05em',
  };

  return (
    <Modal isOpen onClose={onClose} title={`Add Stock — ${product.name}`} size="md">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 20px 16px' }}>

          {/* Variant */}
          <div>
            <label style={labelStyle}>Variant</label>
            <select style={inputStyle} value={selectedVariantId} onChange={e => setSelectedVariantId(e.target.value)}>
              {variants.map(v => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.stock} in stock
                </option>
              ))}
            </select>
          </div>

          {/* Supplier + Qty on one row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
            <div>
              <label style={labelStyle}>Supplier</label>
              <select style={inputStyle} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Qty</label>
              <input
                style={{ ...inputStyle, textAlign: 'right' }}
                type="number" min={1}
                value={qty}
                onChange={e => setQty(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                placeholder="Qty"
                autoFocus
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--line-2)', margin: '2px 0' }} />

          {/* Pricing — 2×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Cost (LKR)</label>
              <input
                style={{ ...inputStyle, textAlign: 'right' }}
                type="number" min={0} step="any"
                value={cost}
                onChange={e => updateCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="Cost price"
              />
            </div>
            <div>
              <label style={labelStyle}>Markup %</label>
              <input
                style={{ ...inputStyle, textAlign: 'right' }}
                type="number" min={0} step="any"
                value={markup}
                onChange={e => updateMarkup(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="Markup %"
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Selling Price (LKR)</label>
              <input
                style={{ ...inputStyle, textAlign: 'right', fontWeight: 500, fontSize: 14 }}
                type="number" min={0} step="any"
                value={selling}
                onChange={e => updateSelling(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="Selling price"
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Add Stock'}
            </button>
          </div>

        </div>
      )}
    </Modal>
  );
}
