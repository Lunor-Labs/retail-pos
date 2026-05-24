import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X, Phone, Mail, MapPin, FileText, Pencil, Truck, ChevronRight, Package } from 'lucide-react';
import { supplierService } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LoadingSpinner } from './ui';
import { supabase } from '../lib/supabase';

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type BatchDelivery = {
  id: string;
  batch_number: string;
  received_date: string;
  initial_quantity: number;
  current_quantity: number;
  cost_price: number;
  selling_price: number;
  markup_percentage: number;
  variant: {
    sku: string;
    size: string | null;
    color: string | null;
    product: { name: string; sku: string } | null;
  } | null;
};

type EnrichedSupplier = Supplier & {
  initials: string;
  tone: string;
  totalCost: number;
  batchCount: number;
  lastDelivery: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────
const TONES = ['#1B6B4F','#3A4E6B','#7A2235','#6A7048','#22324F','#B89456','#5C6675','#8A9078','#7A8050','#6B4A2B'];
function getTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return TONES[h % TONES.length];
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}
function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return n.toString();
}
function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Avatar ──────────────────────────────────────────────────────────────
function Avatar({ initials, tone, size = 40 }: { initials: string; tone: string; size?: number }) {
  const fontSize = size >= 44 ? 14 : size >= 36 ? 13 : size >= 30 ? 12 : 10;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 65%, #000))`,
      color: '#fff', display: 'grid', placeItems: 'center',
      fontWeight: 600, fontSize, letterSpacing: '-0.01em',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
    }}>{initials}</div>
  );
}

// ─── Supplier Modal ───────────────────────────────────────────────────────
type ModalMode = { kind: 'add' } | { kind: 'edit'; supplier: EnrichedSupplier };

const emptyForm = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' };

function SupplierModal({ mode, onClose, onSaved }: {
  mode: ModalMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const isAdd = mode.kind === 'add';
  const [form, setForm] = useState(isAdd ? emptyForm : {
    name: mode.supplier.name,
    contact_person: mode.supplier.contact_person ?? '',
    phone: mode.supplier.phone ?? '',
    email: mode.supplier.email ?? '',
    address: mode.supplier.address ?? '',
    notes: mode.supplier.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(k: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSave() {
    setErr('');
    if (!form.name.trim()) { setErr('Supplier name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (isAdd) {
        await supplierService.createSupplier(payload);
      } else {
        await supplierService.updateSupplier((mode as { kind: 'edit'; supplier: EnrichedSupplier }).supplier.id, payload);
      }
      showToast(isAdd ? 'Supplier added' : 'Supplier updated', 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'An error occurred.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 11px', borderRadius: 7,
    border: '1px solid var(--line)', background: 'var(--panel-2)',
    color: 'var(--ink)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5,
    display: 'block', letterSpacing: '.06em', textTransform: 'uppercase',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
            {isAdd ? 'Add Supplier' : 'Edit Supplier'}
          </h2>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12.5 }}>
              {err}
            </div>
          )}
          <div>
            <label style={labelStyle}>Supplier Name *</label>
            <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="e.g. ABC Distributors" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Contact Person</label>
              <input style={inputStyle} value={form.contact_person} onChange={set('contact_person')} placeholder="e.g. Kasun Perera" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="e.g. 077 123 4567" type="tel" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={form.email} onChange={set('email')} placeholder="e.g. orders@abc.lk" type="email" />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={form.address} onChange={set('address')} placeholder="e.g. 42 Main St, Colombo 03" />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Payment terms, delivery windows, etc."
              style={{ ...inputStyle, height: 72, padding: '8px 11px', resize: 'vertical' } as React.CSSProperties} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, minWidth: 100 }} disabled={saving}>
            {saving ? 'Saving…' : isAdd ? 'Add Supplier' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Supplier detail panel ────────────────────────────────────────────────
function DetailPanel({ supplier, batches, onEdit }: {
  supplier: EnrichedSupplier;
  batches: BatchDelivery[];
  onEdit: () => void;
}) {
  const infoRow = (icon: React.ReactNode, value: string | null, href?: string) => {
    if (!value) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--ink-2)' }}>
        <span style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 1 }}>{icon}</span>
        {href
          ? <a href={href} style={{ color: 'var(--accent-ink)', textDecoration: 'none' }}>{value}</a>
          : <span>{value}</span>}
      </div>
    );
  };

  const totalCost = batches.reduce((s, b) => s + b.cost_price * b.initial_quantity, 0);
  const totalUnits = batches.reduce((s, b) => s + b.initial_quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', height: '100%', overflowY: 'auto', padding: '0 0 24px' }}>
      {/* Identity card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar initials={supplier.initials} tone={supplier.tone} size={52} />
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{supplier.name}</h2>
              {supplier.contact_person && (
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{supplier.contact_person}</div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>Supplier since {fmtJoined(supplier.created_at)}</div>
            </div>
          </div>
          <button onClick={onEdit} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
            border: '1px solid var(--line)', borderRadius: 7, background: 'var(--panel-2)',
            color: 'var(--ink-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            <Pencil size={12} strokeWidth={1.7} /> Edit
          </button>
        </div>

        {/* Contact info */}
        {(supplier.phone || supplier.email || supplier.address) && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
            {infoRow(<Phone size={14} />, supplier.phone, supplier.phone ? `tel:${supplier.phone}` : undefined)}
            {infoRow(<Mail size={14} />, supplier.email, supplier.email ? `mailto:${supplier.email}` : undefined)}
            {infoRow(<MapPin size={14} />, supplier.address)}
          </div>
        )}

        {supplier.notes && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)', display: 'flex', gap: 10 }}>
            <FileText size={14} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{supplier.notes}</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
        {[
          { label: 'Total Cost', value: fmtLKR(totalCost), sub: 'stock cost value' },
          { label: 'Units Received', value: totalUnits.toLocaleString(), sub: `${batches.length} batch${batches.length !== 1 ? 'es' : ''}` },
          { label: 'Last Delivery', value: supplier.lastDelivery ? fmtDate(supplier.lastDelivery)! : '—', sub: supplier.batchCount > 0 ? `${supplier.batchCount} total batches` : 'No deliveries yet' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 6, letterSpacing: '.03em' }}>{s.label}</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Stock received history */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Stock Received</h3>
          <span className="num" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
        </div>

        {batches.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            <Package size={28} style={{ color: 'var(--faint)', marginBottom: 10 }} />
            <div>No stock received yet</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--panel-2)' }}>
                {['Product', 'Variant', 'Date', 'Qty', 'Cost/unit', 'Selling'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: ['Qty', 'Cost/unit', 'Selling'].includes(h) ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--line-2)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b, i) => {
                const variantLabel = [b.variant?.size, b.variant?.color].filter(Boolean).join(' · ') || b.variant?.sku || '—';
                return (
                  <tr key={b.id} style={{ borderBottom: i < batches.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.variant?.product?.name ?? '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>
                        {b.batch_number}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{variantLabel}</span>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{fmtDate(b.received_date)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{b.initial_quantity}</span>
                      {b.current_quantity < b.initial_quantity && (
                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1 }}>{b.current_quantity} left</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>LKR {b.cost_price.toLocaleString()}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>LKR {b.selling_price.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function Suppliers() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<EnrichedSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EnrichedSupplier | null>(null);
  const [selectedBatches, setSelectedBatches] = useState<BatchDelivery[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [sort, setSort] = useState<'name' | 'spend' | 'batches'>('spend');

  const load = useCallback(async () => {
    try {
      const raw = await supplierService.getActiveSuppliers();

      // Aggregate batch stats per supplier
      const { data: agg } = await supabase
        .from('product_batches')
        .select('supplier_id, cost_price, initial_quantity, received_date');

      const batchMap: Record<string, { cost: number; count: number; lastDate: string | null }> = {};
      for (const b of (agg ?? [])) {
        if (!b.supplier_id) continue;
        if (!batchMap[b.supplier_id]) batchMap[b.supplier_id] = { cost: 0, count: 0, lastDate: null };
        batchMap[b.supplier_id].cost += Number(b.cost_price) * Number(b.initial_quantity);
        batchMap[b.supplier_id].count++;
        if (!batchMap[b.supplier_id].lastDate || b.received_date > batchMap[b.supplier_id].lastDate!) {
          batchMap[b.supplier_id].lastDate = b.received_date;
        }
      }

      const enriched: EnrichedSupplier[] = raw.map(s => ({
        ...s,
        initials: getInitials(s.name),
        tone: getTone(s.name),
        totalCost: batchMap[s.id]?.cost ?? 0,
        batchCount: batchMap[s.id]?.count ?? 0,
        lastDelivery: batchMap[s.id]?.lastDate ?? null,
      }));

      setSuppliers(enriched);
      setSelected(prev => prev ? (enriched.find(s => s.id === prev.id) ?? null) : null);
    } catch {
      showToast('Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Load batch details for selected supplier
  useEffect(() => {
    if (!selected) { setSelectedBatches([]); return; }
    setBatchesLoading(true);
    supabase
      .from('product_batches')
      .select('id, batch_number, received_date, initial_quantity, current_quantity, cost_price, selling_price, markup_percentage, variant:product_variants(sku, size, color, product:products(name, sku))')
      .eq('supplier_id', selected.id)
      .order('received_date', { ascending: false })
      .then(({ data }) => { setSelectedBatches((data ?? []) as BatchDelivery[]); })
      .finally(() => setBatchesLoading(false));
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = suppliers.filter(s =>
      !q || s.name.toLowerCase().includes(q) ||
      (s.contact_person ?? '').toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q)
    );
    return rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'batches') return b.batchCount - a.batchCount;
      return b.totalCost - a.totalCost;
    });
  }, [suppliers, search, sort]);

  const totalCost = suppliers.reduce((s, x) => s + x.totalCost, 0);
  const totalBatches = suppliers.reduce((s, x) => s + x.batchCount, 0);

  if (loading) return <LoadingSpinner message="Loading suppliers…" />;

  return (
    <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '24px 0 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Suppliers</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{suppliers.length} suppliers</span>{' · '}
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{totalBatches} batches received</span>
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setModal({ kind: 'add' })} className="btn btn-primary" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add Supplier
          </button>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--gap)' }}>
        {[
          { label: 'Total Suppliers', value: suppliers.length.toString(), sub: 'active vendors' },
          { label: 'Total Stock Cost', value: 'LKR ' + fmtK(totalCost), sub: 'across all batches' },
          { label: 'Total Batches', value: totalBatches.toString(), sub: 'stock deliveries received' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Split layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 'var(--gap)', alignItems: 'start' }}>
        {/* Left: list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Search + sort */}
          <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 12px',
              borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)',
            }}>
              <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} strokeWidth={1.6} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', minWidth: 0 }} />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['spend', 'Top Spend'], ['batches', 'Most Batches'], ['name', 'A–Z']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setSort(k)} style={{
                  flex: 1, height: 28, borderRadius: 6, border: sort === k ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: sort === k ? 'var(--accent-soft)' : 'var(--panel-2)',
                  color: sort === k ? 'var(--accent-ink)' : 'var(--ink-2)',
                  fontSize: 11.5, fontWeight: sort === k ? 600 : 500, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Supplier rows */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <Truck size={28} style={{ color: 'var(--faint)', marginBottom: 10 }} />
                <div>No suppliers found</div>
              </div>
            ) : filtered.map((s, i) => {
              const isSelected = selected?.id === s.id;
              return (
                <div key={s.id} onClick={() => setSelected(isSelected ? null : s)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--line-2)' : 'none',
                  background: isSelected ? 'color-mix(in oklab, var(--accent) 6%, var(--panel))' : 'transparent',
                  borderLeft: isSelected ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                  transition: 'background .1s',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--panel-2)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Avatar initials={s.initials} tone={s.tone} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {s.contact_person && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{s.contact_person}</span>}
                      {s.contact_person && s.batchCount > 0 && <span style={{ color: 'var(--faint)' }}>·</span>}
                      {s.batchCount > 0 && <span className="num">{s.batchCount} batch{s.batchCount !== 1 ? 'es' : ''}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {s.totalCost > 0 ? (
                      <div className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>LKR {fmtK(s.totalCost)}</div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>No stock</div>
                    )}
                    <ChevronRight size={14} style={{ color: 'var(--faint)', marginTop: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        {selected ? (
          batchesLoading ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 200 }}>
              <LoadingSpinner message="Loading batches…" />
            </div>
          ) : (
            <DetailPanel
              supplier={selected}
              batches={selectedBatches}
              onEdit={() => isAdmin && setModal({ kind: 'edit', supplier: selected })}
            />
          )
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 300, color: 'var(--muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <Truck size={32} style={{ color: 'var(--faint)', marginBottom: 12 }} />
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>Select a supplier</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>Click any row to view contact details and order history</div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <SupplierModal
          mode={modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
