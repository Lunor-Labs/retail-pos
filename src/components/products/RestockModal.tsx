import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { productService, supplierService } from '../../services';
import { ProductWithStock } from '../../types';
import { DropdownSelect } from '../ui';
import { useProductAudit } from '../../lib/auditLog';

interface VariantRow {
  variantId: string;
  label: string;
  sku: string;
  currentStock: number;
  qty: number | '';
  cost: number | '';
  markup: number | '';
  selling: number | '';
}

interface RestockModalProps {
  product: ProductWithStock;
  onClose: () => void;
  onSuccess: () => void;
}

export function RestockModal({ product, onClose, onSuccess }: RestockModalProps) {
  const { showToast } = useToast();
  const logAudit = useProductAudit();
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productService.getProductWithVariants(product.id),
      supplierService.getActiveSuppliers(),
    ]).then(([p, s]) => {
      if (p?.variants) {
        setRows(p.variants
          .filter(v => v.active)
          .map(v => {
            const batches: any[] = (v as any).batches ?? [];
            const lastBatch = batches.length > 0
              ? batches.reduce((a: any, b: any) => new Date(b.created_at) > new Date(a.created_at) ? b : a)
              : null;
            return {
              variantId: v.id,
              label: [v.size, v.color].filter(Boolean).join(' · ') || 'Default',
              sku: v.sku,
              currentStock: (v as any).total_stock ?? 0,
              qty: '',
              cost: lastBatch?.cost_price ?? '',
              markup: lastBatch?.markup_percentage ?? '',
              selling: lastBatch?.selling_price ?? '',
            };
          })
        );

        // Pre-fill supplier from most recent batch across all variants
        const allBatches = p.variants.flatMap(v => (v as any).batches ?? []);
        if (allBatches.length > 0) {
          const latest = allBatches.reduce((a: any, b: any) =>
            new Date(b.created_at) > new Date(a.created_at) ? b : a
          );
          if (latest.supplier_id) setSupplierId(latest.supplier_id);
        }
      }
      setSuppliers(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [product.id]);

  function updateCost(i: number, cost: number | '') {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const selling = cost !== '' && r.markup !== ''
        ? parseFloat(((cost as number) * (1 + (r.markup as number) / 100)).toFixed(2))
        : r.selling;
      return { ...r, cost, selling };
    }));
  }

  function updateMarkup(i: number, markup: number | '') {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const selling = markup !== '' && r.cost !== ''
        ? parseFloat(((r.cost as number) * (1 + (markup as number) / 100)).toFixed(2))
        : r.selling;
      return { ...r, markup, selling };
    }));
  }

  function updateSelling(i: number, selling: number | '') {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const markup = selling !== '' && r.cost !== '' && (r.cost as number) > 0
        ? parseFloat((((selling as number) - (r.cost as number)) / (r.cost as number) * 100).toFixed(2))
        : r.markup;
      return { ...r, selling, markup };
    }));
  }

  function updateQty(i: number, qty: number | '') {
    setRows(prev => prev.map((r, idx) => idx !== i ? r : { ...r, qty }));
  }

  async function handleSubmit() {
    if (!supplierId) { showToast('Select a supplier', 'error'); return; }
    const toAdd = rows.filter(r => r.qty !== '' && (r.qty as number) > 0);
    if (toAdd.length === 0) { showToast('Enter quantity for at least one variant', 'error'); return; }

    setSaving(true);
    try {
      const client = (productService as any).productRepo.adapter.getClient();
      const now = new Date().toISOString();
      const batches = toAdd.map(r => ({
        variant_id: r.variantId,
        supplier_id: supplierId,
        batch_number: `B-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        cost_price: r.cost || 0,
        markup_percentage: r.markup || 0,
        selling_price: r.selling || 0,
        initial_quantity: r.qty as number,
        current_quantity: r.qty as number,
        received_date: now.split('T')[0],
        created_at: now,
        updated_at: now,
      }));

      const { error } = await client.from('product_batches').insert(batches);
      if (error) throw new Error(error.message);

      const totalUnits = toAdd.reduce((sum, r) => sum + (r.qty as number), 0);
      logAudit({
        action_type: 'stock_restocked',
        product_id: product.id,
        product_name: product.name,
        detail: `+${totalUnits} units across ${toAdd.length} variant${toAdd.length > 1 ? 's' : ''}`,
      });
      showToast(`Added ${totalUnits} units across ${toAdd.length} variant${toAdd.length > 1 ? 's' : ''}`, 'success');
      onSuccess();
      onClose();
    } catch (e: any) {
      showToast(e.message || 'Failed to add stock', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputNum: React.CSSProperties = {
    width: '100%', height: 32, padding: '0 8px',
    border: '1px solid var(--line)', borderRadius: 6,
    fontSize: 12.5, color: 'var(--ink)', background: 'var(--panel)',
    outline: 'none', boxSizing: 'border-box', textAlign: 'right',
  };

  const activeCount = rows.filter(r => r.qty !== '' && (r.qty as number) > 0).length;
  const totalUnits = rows.reduce((s, r) => s + (r.qty !== '' ? (r.qty as number) : 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 740, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Restock — {product.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Enter quantities for variants you're restocking. Leave blank to skip.</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : (
          <>
            {/* Supplier row */}
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--line-2)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', flexShrink: 0 }}>Supplier</span>
              <div style={{ maxWidth: 280, flex: 1 }}>
                <DropdownSelect
                  value={supplierId}
                  onChange={setSupplierId}
                  options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="Select supplier…"
                />
              </div>
            </div>

            {/* Variant table */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--panel-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                    {['Variant', 'In Stock', 'Qty', 'Cost (LKR)', 'Markup %', 'Selling (LKR)'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em',
                        textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap',
                        textAlign: ['In Stock', 'Qty', 'Cost (LKR)', 'Markup %', 'Selling (LKR)'].includes(h) ? 'right' : 'left',
                        borderBottom: '1px solid var(--line-2)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isActive = row.qty !== '' && (row.qty as number) > 0;
                    return (
                      <tr key={row.variantId} style={{ borderBottom: '1px solid var(--line-2)', background: isActive ? 'color-mix(in oklab, var(--accent) 3%, var(--panel))' : 'transparent' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{row.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>{row.sku}</div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <span className="num" style={{ fontSize: 13, fontWeight: 600, color: row.currentStock === 0 ? 'var(--danger)' : 'var(--pos)' }}>
                            {row.currentStock}
                          </span>
                        </td>
                        <td style={{ padding: '6px 12px', width: 80 }}>
                          <input
                            style={{ ...inputNum, borderColor: isActive ? 'var(--accent)' : 'var(--line)' }}
                            type="number" min={1}
                            value={row.qty}
                            onChange={e => updateQty(i, e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                            placeholder="—"
                          />
                        </td>
                        <td style={{ padding: '6px 12px', width: 110 }}>
                          <input style={inputNum} type="number" min={0} step="any"
                            value={row.cost}
                            onChange={e => updateCost(i, e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder="—"
                          />
                        </td>
                        <td style={{ padding: '6px 12px', width: 90 }}>
                          <input style={inputNum} type="number" min={0} step="any"
                            value={row.markup}
                            onChange={e => updateMarkup(i, e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder="—"
                          />
                        </td>
                        <td style={{ padding: '6px 12px', width: 120 }}>
                          <input
                            style={{ ...inputNum, fontWeight: isActive ? 600 : 400 }}
                            type="number" min={0} step="any"
                            value={row.selling}
                            onChange={e => updateSelling(i, e.target.value === '' ? '' : parseFloat(e.target.value))}
                            placeholder="—"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {activeCount > 0
                  ? `${totalUnits} units across ${activeCount} variant${activeCount > 1 ? 's' : ''}`
                  : 'No quantities entered'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 13 }}>Cancel</button>
                <button onClick={handleSubmit} disabled={saving || activeCount === 0} className="btn btn-primary" style={{ height: 34, fontSize: 13, minWidth: 110 }}>
                  {saving ? 'Adding…' : 'Add Stock'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
