import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, FileText, Trash2, Receipt, ChevronRight, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { salesService } from '../services';
import { Invoice, InvoiceData } from './Invoice';
import { LoadingSpinner } from './ui';

type Sale = {
  id: string;
  sale_number: string;
  sale_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  service_charge: number;
  total_amount: number;
  paid_amount: number;
  payment_method: string | null;
  status: string;
  customer_id: string | null;
  cashier_id: string | null;
  cashier?: { full_name: string } | null;
  customer?: { name: string; phone: string } | null;
};

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  is_manual: boolean;
  manual_description: string | null;
  product?: { name: string; sku: string } | null;
  batch?: { batch_number: string } | null;
  warranty_duration?: number;
  warranty_unit?: 'days' | 'months' | 'years' | null;
  warranty_type?: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return n.toString();
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
function paymentChipStyle(method: string | null) {
  const m = (method ?? '').toLowerCase();
  if (m === 'card') return { bg: 'color-mix(in oklab, #3A4E6B 14%, var(--panel-2))', color: '#3A4E6B' };
  if (m === 'credit') return { bg: 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))', color: 'var(--warn)' };
  return { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
}
function statusChipStyle(status: string) {
  if (status === 'completed') return { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
  if (status === 'partial') return { bg: 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))', color: 'var(--warn)' };
  return { bg: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)' };
}

const today = new Date().toISOString().split('T')[0];
const PRESETS = [
  { label: 'Today', start: today, end: today },
  { label: '7 days', start: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })(), end: today },
  { label: '30 days', start: (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0]; })(), end: today },
  { label: 'This month', start: today.slice(0, 7) + '-01', end: today },
];

// ─── Delete confirmation modal ────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel, busy }: { onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div style={{
        background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', display: 'grid', placeItems: 'center' }}>
            <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Delete Sale</h3>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              This will restore stock levels, reverse any customer credit, and permanently remove the transaction. This cannot be undone.
            </p>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={busy}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{
            height: 34, padding: '0 16px', borderRadius: 7, border: 0,
            background: 'var(--danger)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            opacity: busy ? 0.7 : 1,
          }}>
            {busy ? 'Deleting…' : 'Delete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sale detail panel ────────────────────────────────────────────────────
function DetailPanel({ sale, items, loadingItems, isAdmin, onDelete, onInvoice, onBack }: {
  sale: Sale;
  items: SaleItem[];
  loadingItems: boolean;
  isAdmin: boolean;
  onDelete: () => void;
  onInvoice: () => void;
  onBack: () => void;
}) {
  const chip = paymentChipStyle(sale.payment_method);
  const sc = statusChipStyle(sale.status);
  const hasDiscount = (sale.discount_amount ?? 0) > 0;
  const hasTax = (sale.tax_amount ?? 0) > 0;
  const hasSvc = (sale.service_charge ?? 0) > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', padding: '0 0 24px' }}>
      {/* Mobile back button */}
      <button className="sh-back" onClick={onBack} style={{
        display: 'none', alignItems: 'center', gap: 6, border: 0, background: 'transparent',
        color: 'var(--accent-ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
      }}>
        <ChevronLeft size={18} strokeWidth={2} /> Back to Sales
      </button>

      {/* Header card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                {sale.sale_number}
              </span>
              <span style={{ ...sc, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                {sale.status}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fmtDateTime(sale.sale_date)}</div>
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', textAlign: 'right', flexShrink: 0 }}>
            {fmtLKR(sale.total_amount)}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-2)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>Customer</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{sale.customer?.name ?? 'Walk-in'}</div>
            {sale.customer?.phone && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{sale.customer.phone}</div>}
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>Cashier</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{sale.cashier?.full_name ?? 'System'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>Payment</div>
            <span style={{ ...chip, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, textTransform: 'capitalize', display: 'inline-block' }}>
              {sale.payment_method ?? 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Items</h3>
          {!loadingItems && <span className="num" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{items.length} line{items.length !== 1 ? 's' : ''}</span>}
        </div>

        {loadingItems ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <LoadingSpinner message="Loading items…" />
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px 100px 100px', gap: 10, padding: '9px 18px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)' }}>
              {['Product', 'Qty', 'Unit Price', 'Subtotal'].map((h, i) => (
                <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {items.map((item, i) => (
              <div key={item.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px 100px 100px', gap: 10,
                padding: '11px 18px', alignItems: 'center',
                borderBottom: i < items.length - 1 ? '1px solid var(--line-2)' : 'none',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.is_manual ? (item.manual_description ?? 'Manual Item') : (item.product?.name ?? 'Unknown')}
                    </span>
                    {item.is_manual && (
                      <span style={{ fontSize: 10, fontWeight: 600, background: 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))', color: 'var(--warn)', padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>MANUAL</span>
                    )}
                  </div>
                  {!item.is_manual && item.product?.sku && (
                    <div style={{ fontSize: 11, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{item.product.sku}</div>
                  )}
                  {item.warranty_duration && item.warranty_duration > 0 && (
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                      Warranty: {item.warranty_duration} {item.warranty_unit}{item.warranty_type ? ` · ${item.warranty_type}` : ''}
                    </div>
                  )}
                </div>
                <div className="num" style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink)' }}>{item.quantity}</div>
                <div className="num" style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)' }}>{fmtLKR(item.unit_price)}</div>
                <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtLKR(item.subtotal)}</div>
              </div>
            ))}

            {/* Totals */}
            <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 7, background: 'var(--panel-2)' }}>
              {[
                { label: 'Subtotal', value: sale.subtotal + (sale.discount_amount ?? 0), show: true },
                { label: 'Discount', value: -(sale.discount_amount ?? 0), show: hasDiscount },
                { label: 'Tax', value: sale.tax_amount ?? 0, show: hasTax },
                { label: 'Service charge', value: sale.service_charge ?? 0, show: hasSvc },
              ].filter(r => r.show).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)' }}>
                  <span>{r.label}</span>
                  <span className="num">{r.value < 0 ? '−' : ''}{fmtLKR(Math.abs(r.value))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: 'var(--ink)', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <span>Total</span>
                <span className="num">{fmtLKR(sale.total_amount)}</span>
              </div>
              {sale.status === 'partial' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--warn)' }}>
                  <span>Balance due</span>
                  <span className="num">{fmtLKR(sale.total_amount - (sale.paid_amount ?? 0))}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onInvoice} className="btn" style={{ flex: 1, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12.5 }} disabled={loadingItems || items.length === 0}>
          <FileText size={14} strokeWidth={1.7} /> Print Invoice
        </button>
        {isAdmin && (
          <button onClick={onDelete} style={{
            height: 36, padding: '0 14px', borderRadius: 7,
            border: '1px solid color-mix(in oklab, var(--danger) 40%, var(--line))',
            background: 'transparent', color: 'var(--danger)', fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Trash2 size={13} strokeWidth={1.7} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function SalesHistory() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState(2); // default: 30 days
  const [dateRange, setDateRange] = useState({ start: PRESETS[2].start, end: PRESETS[2].end });
  const [customRange, setCustomRange] = useState(false);
  const [payFilter, setPayFilter] = useState('All');

  const [selected, setSelected] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesService.getSales(
        `${dateRange.start}T00:00:00`,
        `${dateRange.end}T23:59:59`
      );
      setSales(data);
    } catch {
      showToast('Failed to load sales history', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, showToast]);

  useEffect(() => { load(); }, [load]);

  // Load items when selection changes
  useEffect(() => {
    if (!selected) { setSaleItems([]); return; }
    setLoadingItems(true);
    salesService.getSaleItems(selected.id)
      .then(data => setSaleItems(data as SaleItem[]))
      .catch(() => showToast('Failed to load sale items', 'error'))
      .finally(() => setLoadingItems(false));
  }, [selected?.id]);

  function applyPreset(idx: number) {
    setPreset(idx);
    setCustomRange(false);
    setDateRange({ start: PRESETS[idx].start, end: PRESETS[idx].end });
  }

  const paymentMethods = useMemo(() => {
    const methods = Array.from(new Set(sales.map(s => s.payment_method ?? 'unknown')));
    return ['All', ...methods];
  }, [sales]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sales.filter(s => {
      if (payFilter !== 'All' && (s.payment_method ?? 'unknown') !== payFilter) return false;
      if (q && !(
        s.sale_number.toLowerCase().includes(q) ||
        (s.customer?.name ?? '').toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [sales, search, payFilter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await salesService.deleteSale(deleteTarget);
      setSales(prev => prev.filter(s => s.id !== deleteTarget));
      if (selected?.id === deleteTarget) setSelected(null);
      showToast('Sale deleted and stock restored', 'success');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete sale', 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function openInvoice() {
    if (!selected || !saleItems.length) return;
    const data: InvoiceData = {
      saleNumber: selected.sale_number,
      date: new Date(selected.sale_date).toLocaleString(),
      customerName: selected.customer?.name ?? 'Walk-in Customer',
      customerPhone: selected.customer?.phone ?? undefined,
      items: saleItems.map(item => ({
        name: item.is_manual ? (item.manual_description ?? 'Manual Item') : (item.product?.name ?? 'Unknown Item'),
        quantity: item.quantity,
        unitPrice: (item as any).selling_price ?? item.unit_price,
        discountedUnitPrice: item.unit_price,
        subtotal: ((item as any).selling_price ?? item.unit_price) * item.quantity,
        discountedSubtotal: item.unit_price * item.quantity,
        batchNumber: item.is_manual ? '' : (item.batch?.batch_number ?? ''),
        isManual: item.is_manual,
        warranty: (!item.is_manual && item.warranty_duration && item.warranty_duration > 0) ? {
          duration: item.warranty_duration,
          unit: (item.warranty_unit as any) ?? 'months',
          type: item.warranty_type ?? undefined,
        } : undefined,
      })),
      subtotal: selected.subtotal + (selected.discount_amount ?? 0),
      discount: selected.discount_amount,
      tax: selected.tax_amount,
      total: selected.total_amount,
      paidAmount: selected.paid_amount,
      changeAmount: Math.max(0, selected.paid_amount - selected.total_amount),
      paymentMethod: selected.payment_method ?? 'cash',
      cashierName: selected.cashier?.full_name ?? 'System',
      serviceCharge: selected.service_charge ?? 0,
    };
    setInvoiceData(data);
    setShowInvoice(true);
  }

  // KPIs for the current filtered period
  const totalRevenue = filtered.reduce((s, x) => s + Number(x.total_amount), 0);
  const avgSale = filtered.length > 0 ? totalRevenue / filtered.length : 0;
  const cashCount = filtered.filter(s => (s.payment_method ?? '').toLowerCase() === 'cash').length;
  const cardCount = filtered.filter(s => (s.payment_method ?? '').toLowerCase() === 'card').length;

  return (
    <div className="sh-outer" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '24px 0 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Sales History</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{filtered.length} transactions</span>{' · '}
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>LKR {fmtK(totalRevenue)}</span>{' in this period'}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--gap)' }}>
        {[
          { label: 'Transactions', value: filtered.length.toString(), sub: 'in selected period' },
          { label: 'Total Revenue', value: 'LKR ' + fmtK(totalRevenue), sub: 'net of discounts' },
          { label: 'Avg Sale', value: fmtLKR(avgSale), sub: 'per transaction' },
          { label: 'Cash / Card', value: `${cashCount} / ${cardCount}`, sub: 'payment split' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Split layout */}
      <div className={`sh-split ${selected ? 'sh-detail-active' : ''}`}>
        {/* Left: list */}
        <div className="sh-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Filters */}
          <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 12px',
              borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)',
            }}>
              <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} strokeWidth={1.6} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Receipt # or customer…"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', minWidth: 0 }} />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Date presets */}
            <div style={{ display: 'flex', gap: 4 }}>
              {PRESETS.map((p, i) => (
                <button key={p.label} onClick={() => applyPreset(i)} style={{
                  flex: 1, height: 28, borderRadius: 6,
                  border: preset === i && !customRange ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: preset === i && !customRange ? 'var(--accent-soft)' : 'var(--panel-2)',
                  color: preset === i && !customRange ? 'var(--accent-ink)' : 'var(--ink-2)',
                  fontSize: 11, fontWeight: preset === i && !customRange ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{p.label}</button>
              ))}
              <button onClick={() => setCustomRange(v => !v)} style={{
                flex: 1, height: 28, borderRadius: 6,
                border: customRange ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                background: customRange ? 'var(--accent-soft)' : 'var(--panel-2)',
                color: customRange ? 'var(--accent-ink)' : 'var(--ink-2)',
                fontSize: 11, fontWeight: customRange ? 600 : 500, cursor: 'pointer',
              }}>Custom</button>
            </div>

            {/* Custom date inputs */}
            {customRange && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['start', 'end'] as const).map(k => (
                  <div key={k}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{k === 'start' ? 'From' : 'To'}</div>
                    <input type="date" value={dateRange[k]} max={today}
                      onChange={e => setDateRange(r => ({ ...r, [k]: e.target.value }))}
                      style={{ width: '100%', height: 32, padding: '0 9px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Payment filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {paymentMethods.map(m => {
                const isA = m === payFilter;
                const count = m === 'All' ? filtered.length : sales.filter(s => (s.payment_method ?? 'unknown') === m).length;
                return (
                  <button key={m} onClick={() => setPayFilter(m)} style={{
                    padding: '4px 10px', borderRadius: 999,
                    border: isA ? '1px solid var(--accent)' : '1px solid var(--line)',
                    background: isA ? 'var(--accent-soft)' : 'var(--panel)',
                    color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                    fontSize: 11.5, fontWeight: isA ? 600 : 500, cursor: 'pointer', textTransform: 'capitalize',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    {m}
                    <span className="num" style={{ fontSize: 10.5, color: isA ? 'inherit' : 'var(--faint)' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sales list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}><LoadingSpinner message="Loading…" /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Receipt size={28} style={{ color: 'var(--faint)', marginBottom: 10 }} />
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>No sales found</div>
              </div>
            ) : filtered.map((s, i) => {
              const isSelected = selected?.id === s.id;
              const chip = paymentChipStyle(s.payment_method);
              return (
                <div key={s.id} onClick={() => setSelected(isSelected ? null : s)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--line-2)' : 'none',
                  background: isSelected ? 'color-mix(in oklab, var(--accent) 6%, var(--panel))' : 'transparent',
                  borderLeft: isSelected ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                  transition: 'background .1s',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--panel-2)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Receipt size={15} style={{ color: 'var(--muted)' }} strokeWidth={1.6} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.sale_number}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{s.customer?.name ?? 'Walk-in'}</span>
                      <span style={{ color: 'var(--faint)' }}>·</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(s.sale_date)} {fmtTime(s.sale_date)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>LKR {fmtK(s.total_amount)}</div>
                    <span style={{ ...chip, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, textTransform: 'capitalize', display: 'inline-block', marginTop: 3 }}>
                      {s.payment_method ?? '—'}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="sh-detail">
          {selected ? (
            <DetailPanel
              sale={selected}
              items={saleItems}
              loadingItems={loadingItems}
              isAdmin={isAdmin}
              onDelete={() => setDeleteTarget(selected.id)}
              onInvoice={openInvoice}
              onBack={() => setSelected(null)}
            />
          ) : (
            <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 320, color: 'var(--muted)' }}>
              <div style={{ textAlign: 'center' }}>
                <FileText size={32} style={{ color: 'var(--faint)', marginBottom: 12 }} strokeWidth={1.5} />
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>Select a transaction</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>Click any row to view items and print invoice</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          busy={deleting}
        />
      )}

      {/* Invoice */}
      {showInvoice && invoiceData && (
        <div style={{ position: 'relative', zIndex: 70 }}>
          <Invoice invoiceData={invoiceData} onClose={() => setShowInvoice(false)} />
        </div>
      )}
    </div>
  );
}
