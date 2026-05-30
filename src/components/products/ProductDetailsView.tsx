import { useState, useEffect } from 'react';
import { ProductWithStock, VariantWithStock, ProductBatch } from '../../types';
import { ProductImage } from '../ProductImage';
import { Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { productService } from '../../services';
import { useProductAudit } from '../../lib/auditLog';
import { CostInput, CostDisplay } from '../ui';
import { useCostCode } from '../../contexts/CostCodeContext';

interface ProductDetailsViewProps {
  product: ProductWithStock;
  onClose: () => void;
  onUpdate?: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface BatchRowProps {
  batch: ProductBatch;
  isAdmin: boolean;
  onSave: (id: string, data: Partial<ProductBatch>) => Promise<void>;
}

function BatchRow({ batch, isAdmin, onSave }: BatchRowProps) {
  const [editing, setEditing] = useState(false);
  const { isAdmin } = useAuth();
  const { isConfigured } = useCostCode();
  const useEncoding = !isAdmin && isConfigured;
  const [d, setD] = useState({ current_quantity: batch.current_quantity, cost_price: batch.cost_price, markup_percentage: batch.markup_percentage, selling_price: batch.selling_price });
  const [saving, setSaving] = useState(false);

  function updateCost(cost: number) {
    const selling = parseFloat((cost * (1 + d.markup_percentage / 100)).toFixed(2));
    setD(p => ({ ...p, cost_price: cost, selling_price: selling }));
  }
  function updateMarkup(markup: number) {
    const selling = parseFloat((d.cost_price * (1 + markup / 100)).toFixed(2));
    setD(p => ({ ...p, markup_percentage: markup, selling_price: selling }));
  }
  function updateSelling(selling: number) {
    const markup = d.cost_price > 0 ? parseFloat(((selling - d.cost_price) / d.cost_price * 100).toFixed(2)) : 0;
    setD(p => ({ ...p, selling_price: selling, markup_percentage: markup }));
  }

  async function save() {
    setSaving(true);
    try { await onSave(batch.id, d); setEditing(false); }
    finally { setSaving(false); }
  }

  const isEmpty = batch.current_quantity === 0;

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)', background: isEmpty ? 'rgba(20,22,26,0.02)' : 'transparent', opacity: isEmpty ? 0.5 : 1 }}>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>#{batch.batch_number}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setEditing(false)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 5 }}><X size={14} /></button>
              <button onClick={save} disabled={saving} style={{ border: 0, background: 'transparent', color: 'var(--pos)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 5 }}><Check size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {/* Qty */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Qty</div>
              <input type="number" min={0} step="any" value={d.current_quantity || ''} onChange={e => setD(p => ({ ...p, current_quantity: parseFloat(e.target.value) || 0 }))}
                style={{ width: '100%', height: 30, padding: '0 7px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', textAlign: 'right' }} />
            </div>
            {/* Cost */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Cost</div>
              <CostInput value={d.cost_price} onChange={updateCost}
                style={{ width: '100%', height: 30, padding: '0 7px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', textAlign: 'right' }} />
            </div>
            {/* Markup % */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Markup %</div>
              <input type="number" min={0} step="any" value={d.markup_percentage || ''} onChange={e => updateMarkup(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', height: 30, padding: '0 7px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', textAlign: 'right' }} />
            </div>
            {/* Selling */}
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Selling (LKR)</div>
              <input type="number" min={0} step="any" value={d.selling_price || ''} onChange={e => updateSelling(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', height: 30, padding: '0 7px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', textAlign: 'right' }} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>
              {fmtDate(batch.received_date)}
              {batch.supplier && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>· {batch.supplier.name}</span>}
            </div>
            {(isAdmin || isConfigured) && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Cost <CostDisplay value={batch.cost_price} /> · {batch.markup_percentage ?? 0}% markup
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>LKR {batch.selling_price.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: batch.current_quantity === 0 ? 'var(--danger)' : 'var(--pos)', fontWeight: 600, marginTop: 1 }}>
                {batch.current_quantity} left
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => setEditing(true)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 5 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                <Pencil size={13} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface VariantSectionProps {
  variant: VariantWithStock;
  isAdmin: boolean;
  onBatchSave: (batchId: string, data: Partial<ProductBatch>) => Promise<void>;
}

function VariantSection({ variant, isAdmin, onBatchSave }: VariantSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const label = [variant.size, variant.color].filter(Boolean).join(' · ') || variant.sku;

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      {/* Variant header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--panel-2)', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {expanded ? <ChevronDown size={14} style={{ color: 'var(--muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--muted)' }} />}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>{variant.sku}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: variant.total_stock === 0 ? 'var(--danger)' : 'var(--pos)' }}>
          {variant.total_stock} in stock
        </span>
      </div>

      {expanded && (
        <>
          {/* Batch list */}
          {variant.batches.length === 0 ? (
            <div style={{ padding: '16px 14px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>No batches yet</div>
          ) : variant.batches
            .slice()
            .sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime())
            .map(batch => (
              <BatchRow key={batch.id} batch={batch} isAdmin={isAdmin} onSave={onBatchSave} />
            ))}
        </>
      )}
    </div>
  );
}

export function ProductDetailsView({ product, onClose, onUpdate }: ProductDetailsViewProps) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const logAudit = useProductAudit();
  const isAdmin = profile?.role === 'admin';
  const [variants, setVariants] = useState<VariantWithStock[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(true);

  useEffect(() => {
    loadVariants();
  }, [product.id]);

  async function loadVariants() {
    setLoadingVariants(true);
    try {
      const p = await productService.getProductWithVariants(product.id);
      setVariants(p?.variants ?? []);
    } catch {
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  }

  async function handleBatchSave(batchId: string, data: Partial<ProductBatch>) {
    try {
      // Capture old values for the audit detail before saving
      let oldSelling: number | undefined;
      let oldQty: number | undefined;
      for (const v of variants) {
        const b = v.batches.find(b => b.id === batchId);
        if (b) { oldSelling = b.selling_price; oldQty = b.current_quantity; break; }
      }

      await productService.updateBatch(batchId, data as any);

      const parts: string[] = [];
      if (data.selling_price !== undefined && oldSelling !== undefined && data.selling_price !== oldSelling)
        parts.push(`price: LKR ${oldSelling.toLocaleString()} → LKR ${data.selling_price.toLocaleString()}`);
      if (data.current_quantity !== undefined && oldQty !== undefined && data.current_quantity !== oldQty)
        parts.push(`qty: ${oldQty} → ${data.current_quantity}`);

      logAudit({
        action_type: 'batch_updated',
        product_id: product.id,
        product_name: product.name,
        detail: parts.length > 0 ? parts.join(' · ') : undefined,
      });

      showToast('Batch updated', 'success');
      loadVariants();
      onUpdate?.();
    } catch (e: any) {
      showToast(e.message || 'Failed to update batch', 'error');
    }
  }

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Product header */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {product.image_url && (
          <ProductImage imageUrl={product.image_url} alt={product.name} size="lg" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{product.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
            {[(product as any).brand, product.category, product.material].filter(Boolean).join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'SKU', value: product.sku, mono: true },
              { label: 'Total Stock', value: String(product.total_stock), highlight: true },
              { label: 'Unit', value: product.unit },
              { label: 'Gender', value: (product as any).gender || null },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: f.highlight ? 700 : 500, color: f.highlight ? 'var(--pos)' : 'var(--ink)', fontFamily: f.mono ? "'JetBrains Mono',monospace" : undefined, marginTop: 2 }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Variants + batches */}
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Variants & Batches
        </div>
        {loadingVariants ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)', margin: '0 auto' }} />
          </div>
        ) : variants.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>No variants found</div>
        ) : variants.map(v => (
          <VariantSection
            key={v.id}
            variant={v}
            isAdmin={isAdmin}
            onBatchSave={handleBatchSave}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 13 }}>Close</button>
      </div>
    </div>
  );
}
