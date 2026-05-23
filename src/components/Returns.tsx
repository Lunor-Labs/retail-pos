import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X, RotateCcw, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { returnService, salesService, customerService } from '../services';
import { LoadingSpinner } from './ui';

// ─── Types ────────────────────────────────────────────────────────────────
type ReturnStatus = 'pending' | 'approved' | 'rejected';
type RefundMethod = 'cash' | 'credit_note' | 'exchange';

type ReturnRecord = {
  id: string;
  return_number: string;
  return_date: string;
  total_amount: number;
  refund_method: RefundMethod | null;
  status: ReturnStatus;
  reason: string | null;
  sale_id: string | null;
  customer_id: string | null;
  customer: { name: string; phone?: string } | null;
  sale: { sale_number: string } | null;
  items: ReturnItem[];
};

type ReturnItem = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product: { name: string; sku?: string } | null;
};

type Sale = { id: string; sale_number: string; total_amount: number };
type Customer = { id: string; name: string };
type SaleItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  batch_id: string | null;
  quantity: number;
  unit_price: number;
  is_manual: boolean;
  manual_description: string | null;
  product?: { name: string; sku: string } | null;
  variant?: { color: string | null; size: string | null } | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return Math.round(n).toString();
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function statusStyle(s: ReturnStatus) {
  if (s === 'approved') return { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
  if (s === 'pending')  return { bg: 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))', color: 'var(--warn)' };
  return { bg: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)' };
}

function methodStyle(m: RefundMethod | null) {
  if (m === 'credit_note') return { bg: 'color-mix(in oklab, #3A4E6B 14%, var(--panel-2))', color: '#3A4E6B' };
  if (m === 'exchange')    return { bg: 'color-mix(in oklab, var(--warn) 12%, var(--panel-2))', color: 'var(--warn)' };
  return { bg: 'var(--accent-soft)', color: 'var(--accent-ink)' };
}

function methodLabel(m: RefundMethod | null) {
  if (m === 'credit_note') return 'Credit Note';
  if (m === 'exchange') return 'Exchange';
  return 'Cash';
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

// ─── New Return Modal ─────────────────────────────────────────────────────
function NewReturnModal({ sales, customers, onClose, onSaved }: {
  sales: Sale[];
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [saleId, setSaleId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
  const [reason, setReason] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!saleId) { setSaleItems([]); setReturnQty({}); return; }
    setLoadingItems(true);
    salesService.getSaleItems(saleId)
      .then(items => {
        setSaleItems(items as SaleItem[]);
        const init: Record<string, number> = {};
        (items as SaleItem[]).forEach(it => { init[it.id] = 0; });
        setReturnQty(init);
      })
      .catch(() => showToast('Failed to load sale items', 'error'))
      .finally(() => setLoadingItems(false));
  }, [saleId]);

  const totalAmount = useMemo(() => {
    return Object.entries(returnQty).reduce((sum, [id, qty]) => {
      const item = saleItems.find(it => it.id === id);
      return sum + (item ? item.unit_price * qty : 0);
    }, 0);
  }, [returnQty, saleItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (totalAmount <= 0 && saleItems.length > 0) { setErr('Select at least one item to return.'); return; }
    if (totalAmount <= 0 && !saleId) { setErr('Enter a return amount or link to a sale.'); return; }
    if (!profile?.id) return;
    setSaving(true);
    try {
      const itemsToReturn = Object.entries(returnQty)
        .filter(([, qty]) => qty > 0)
        .map(([saleItemId, qty]) => {
          const item = saleItems.find(it => it.id === saleItemId)!;
          return {
            product_id: item.product_id,
            variant_id: item.variant_id ?? null,
            batch_id: item.batch_id,
            quantity: qty,
            subtotal: item.unit_price * qty,
            unit_price: item.unit_price,
            sale_item_id: item.id,
          };
        });

      const ret = await returnService.createReturn(profile.id, {
        sale_id: saleId || null,
        customer_id: customerId || null,
        total_amount: totalAmount,
        refund_method: refundMethod,
        reason: reason || '',
        items: itemsToReturn,
        status: autoApprove ? 'approved' : 'pending',
      } as any);

      showToast(`Return ${ret.return_number} created`, 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to create return.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,12,15,0.55)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--panel)', borderRadius: 14, width: '100%', maxWidth: 560,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>New Return</h2>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 4, lineHeight: 0, borderRadius: 6 }}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {err && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))', color: 'var(--danger)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} strokeWidth={1.7} style={{ flexShrink: 0 }} /> {err}
            </div>
          )}

          {/* Sale selector */}
          <div>
            <label style={labelStyle}>Linked Sale (optional)</label>
            <select value={saleId} onChange={e => setSaleId(e.target.value)} style={{ ...inputStyle, height: 36 }}>
              <option value="">— No linked sale —</option>
              {sales.map(s => (
                <option key={s.id} value={s.id}>{s.sale_number} · LKR {Math.round(s.total_amount).toLocaleString()}</option>
              ))}
            </select>
          </div>

          {/* Sale items */}
          {loadingItems && <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Loading items…</div>}
          {saleItems.length > 0 && (
            <div style={{ borderRadius: 9, border: '1px solid var(--line)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                Select Items to Return
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {saleItems.map((item, i) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < saleItems.length - 1 ? '1px solid var(--line-2)' : 'none',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.is_manual ? (item.manual_description ?? 'Manual Item') : (item.product?.name ?? 'Unknown')}
                      </div>
                      {item.variant && (item.variant.color || item.variant.size) && (
                        <div style={{ fontSize: 11, color: 'var(--accent-ink)', marginTop: 1 }}>
                          {[item.variant.color, item.variant.size].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>
                        Qty: {item.quantity} · LKR {Math.round(item.unit_price).toLocaleString()} each
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Return</span>
                      <input
                        type="number" min={0} max={item.quantity}
                        value={returnQty[item.id] ?? 0}
                        onChange={e => setReturnQty(prev => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)) }))}
                        style={{ width: 56, height: 30, textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {totalAmount > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--panel-2)', borderTop: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  <span>Return total</span>
                  <span className="num">{fmtLKR(totalAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Customer */}
          <div>
            <label style={labelStyle}>Customer (optional)</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ ...inputStyle, height: 36 }}>
              <option value="">— Walk-in —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Refund method */}
          <div>
            <label style={labelStyle}>Refund Method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['cash', 'Cash'], ['credit_note', 'Credit Note'], ['exchange', 'Exchange']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setRefundMethod(v)} style={{
                  flex: 1, height: 36, borderRadius: 7,
                  border: refundMethod === v ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: refundMethod === v ? 'var(--accent-soft)' : 'var(--panel-2)',
                  color: refundMethod === v ? 'var(--accent-ink)' : 'var(--ink-2)',
                  fontSize: 12.5, fontWeight: refundMethod === v ? 600 : 500, cursor: 'pointer',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label style={labelStyle}>Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Defective, wrong item, customer changed mind…"
              style={{ ...inputStyle, height: 68, padding: '8px 11px', resize: 'vertical' } as React.CSSProperties} />
          </div>

          {/* Auto approve toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Approve immediately</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Restores stock and processes refund now</div>
            </div>
            <button type="button" onClick={() => setAutoApprove(v => !v)} style={{
              width: 40, height: 22, borderRadius: 99, border: 0, cursor: 'pointer',
              background: autoApprove ? 'var(--accent)' : 'var(--faint)',
              position: 'relative', transition: 'background .15s', flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 3, left: autoApprove ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} className="btn" style={{ height: 34, fontSize: 12.5 }} disabled={saving}>Cancel</button>
          <button onClick={e => { e.preventDefault(); handleSubmit(e as any); }} className="btn btn-primary" style={{ height: 34, fontSize: 12.5, minWidth: 120 }} disabled={saving}>
            {saving ? 'Creating…' : 'Create Return'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────
function DetailPanel({ ret }: { ret: ReturnRecord }) {
  const ss = statusStyle(ret.status);
  const ms = methodStyle(ret.refund_method);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', padding: '0 0 24px' }}>
      {/* Header card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {ret.return_number}
              </span>
              <span style={{ ...ss, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>
                {ret.status}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fmtDateTime(ret.return_date)}</div>
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', textAlign: 'right', flexShrink: 0 }}>
            {fmtLKR(ret.total_amount)}
          </div>
        </div>

        {/* Meta */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line-2)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>Customer</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{ret.customer?.name ?? 'Walk-in'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>Linked Sale</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
              {ret.sale?.sale_number ?? '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>Refund Method</div>
            <span style={{ ...ms, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, display: 'inline-block' }}>
              {methodLabel(ret.refund_method)}
            </span>
          </div>
        </div>

        {/* Reason */}
        {ret.reason && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-2)', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Reason: </span>{ret.reason}
          </div>
        )}
      </div>

      {/* Items */}
      {ret.items.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Returned Items</h3>
            <span className="num" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{ret.items.length} line{ret.items.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px 100px 100px', gap: 10, padding: '9px 18px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)' }}>
            {['Product', 'Qty', 'Unit Price', 'Subtotal'].map((h, i) => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {ret.items.map((item, i) => (
            <div key={item.id} style={{
              display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 52px 100px 100px', gap: 10,
              padding: '11px 18px', alignItems: 'center',
              borderBottom: i < ret.items.length - 1 ? '1px solid var(--line-2)' : 'none',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.product?.name ?? 'Unknown Item'}
                </div>
                {item.product?.sku && (
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{item.product.sku}</div>
                )}
              </div>
              <div className="num" style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink)' }}>{item.quantity}</div>
              <div className="num" style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)' }}>{fmtLKR(item.unit_price)}</div>
              <div className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtLKR(item.subtotal)}</div>
            </div>
          ))}
          {/* Total */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--panel-2)', display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            <span>Total refund</span>
            <span className="num">{fmtLKR(ret.total_amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function Returns() {
  const { showToast } = useToast();
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selected, setSelected] = useState<ReturnRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const [returnsData, salesData, customersData] = await Promise.all([
        returnService.getAllReturns(),
        salesService.getRecentSales(200),
        customerService.getAllCustomers(),
      ]);
      setReturns(returnsData as ReturnRecord[]);
      setSales(salesData as unknown as Sale[]);
      setCustomers(customersData as Customer[]);
      setSelected(prev => prev ? ((returnsData as ReturnRecord[]).find(r => r.id === prev.id) ?? null) : null);
    } catch {
      showToast('Failed to load returns', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return returns.filter(r => {
      if (methodFilter !== 'All' && (r.refund_method ?? 'cash') !== methodFilter) return false;
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (q && !(r.return_number.toLowerCase().includes(q) || (r.customer?.name ?? '').toLowerCase().includes(q) || (r.sale?.sale_number ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [returns, search, methodFilter, statusFilter]);

  const totalRefunded = returns.reduce((s, r) => s + (r.status === 'approved' ? Number(r.total_amount) : 0), 0);
  const pendingCount  = returns.filter(r => r.status === 'pending').length;
  const cashCount     = returns.filter(r => (r.refund_method ?? 'cash') === 'cash').length;
  const creditCount   = returns.filter(r => r.refund_method === 'credit_note').length;

  if (loading) return <LoadingSpinner message="Loading returns…" />;

  return (
    <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '24px 0 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Returns</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{returns.length} returns</span>
            {pendingCount > 0 && <> · <span style={{ color: 'var(--warn)', fontWeight: 500 }}>{pendingCount} pending</span></>}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> New Return
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--gap)' }}>
        {[
          { label: 'Total Returns', value: returns.length.toString(), sub: 'all time' },
          { label: 'Total Refunded', value: 'LKR ' + fmtK(totalRefunded), sub: 'approved only' },
          { label: 'Pending Review', value: pendingCount.toString(), sub: pendingCount > 0 ? 'awaiting action' : 'all clear' },
          { label: 'Cash / Credit', value: `${cashCount} / ${creditCount}`, sub: 'refund method split' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
            <div className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: k.label === 'Pending Review' && pendingCount > 0 ? 'var(--warn)' : 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Split layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 400px) minmax(0, 1fr)', gap: 'var(--gap)', alignItems: 'start' }}>
        {/* Left: list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Filters */}
          <div className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 12px',
              borderRadius: 8, background: 'var(--panel-2)', border: '1px solid var(--line)',
            }}>
              <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} strokeWidth={1.6} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Return #, customer or sale…"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', minWidth: 0 }} />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status chips */}
            <div style={{ display: 'flex', gap: 4 }}>
              {['All', 'approved', 'pending', 'rejected'].map(s => {
                const isA = s === statusFilter;
                const count = s === 'All' ? returns.length : returns.filter(r => r.status === s).length;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{
                    flex: 1, height: 28, borderRadius: 6,
                    border: isA ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                    background: isA ? 'var(--accent-soft)' : 'var(--panel-2)',
                    color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                    fontSize: 11, fontWeight: isA ? 600 : 500, cursor: 'pointer',
                    textTransform: 'capitalize', whiteSpace: 'nowrap',
                  }}>{s === 'All' ? `All (${count})` : `${s} (${count})`}</button>
                );
              })}
            </div>

            {/* Method chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', 'cash', 'credit_note', 'exchange'].map(m => {
                const isA = m === methodFilter;
                const count = m === 'All' ? returns.length : returns.filter(r => (r.refund_method ?? 'cash') === m).length;
                const label = m === 'All' ? 'All methods' : m === 'credit_note' ? 'Credit Note' : m.charAt(0).toUpperCase() + m.slice(1);
                return (
                  <button key={m} onClick={() => setMethodFilter(m)} style={{
                    padding: '4px 10px', borderRadius: 999,
                    border: isA ? '1px solid var(--accent)' : '1px solid var(--line)',
                    background: isA ? 'var(--accent-soft)' : 'var(--panel)',
                    color: isA ? 'var(--accent-ink)' : 'var(--ink-2)',
                    fontSize: 11.5, fontWeight: isA ? 600 : 500, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    {label}
                    <span className="num" style={{ fontSize: 10.5, color: isA ? 'inherit' : 'var(--faint)' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Returns list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <RotateCcw size={28} style={{ color: 'var(--faint)', marginBottom: 10 }} strokeWidth={1.5} />
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>No returns found</div>
              </div>
            ) : filtered.map((r, i) => {
              const isSelected = selected?.id === r.id;
              const ss = statusStyle(r.status);
              const ms = methodStyle(r.refund_method);
              return (
                <div key={r.id} onClick={() => setSelected(isSelected ? null : r)} style={{
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
                    <RotateCcw size={14} style={{ color: 'var(--muted)' }} strokeWidth={1.6} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {r.return_number}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{r.customer?.name ?? 'Walk-in'}</span>
                      <span style={{ color: 'var(--faint)' }}>·</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.return_date)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>LKR {fmtK(r.total_amount)}</span>
                    <span style={{ ...ss, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        {selected ? (
          <DetailPanel ret={selected} />
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 320, color: 'var(--muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <RotateCcw size={32} style={{ color: 'var(--faint)', marginBottom: 12 }} strokeWidth={1.5} />
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-2)' }}>Select a return</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>Click any row to view items and details</div>
            </div>
          </div>
        )}
      </div>

      {/* New Return Modal */}
      {showModal && (
        <NewReturnModal
          sales={sales}
          customers={customers}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
