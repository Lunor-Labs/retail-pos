import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Upload, Download, Mail, Phone, MapPin, Clock, X, FileText, CheckCircle, Eye } from 'lucide-react';
import { customerService, salesService } from '../services';
import { useToast } from '../contexts/ToastContext';
import { Modal, LoadingSpinner } from './ui';
import { Database } from '../lib/database.types';
import { Invoice, InvoiceData } from './Invoice';

type Customer = Database['public']['Tables']['customers']['Row'];

interface SaleStats { total_spent: number; order_count: number; last_visit: string | null; }

interface EnrichedCustomer extends Customer {
  total_spent: number;
  order_count: number;
  last_visit: string | null;
  tier: 'VIP' | 'Gold' | 'Regular' | 'New';
  segment: string;
  initials: string;
  tone: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function deriveTier(pts: number): 'VIP' | 'Gold' | 'Regular' | 'New' {
  if (pts >= 2000) return 'VIP';
  if (pts >= 1000) return 'Gold';
  if (pts >= 100) return 'Regular';
  return 'New';
}

function deriveSegment(stats: SaleStats): string {
  const days = stats.last_visit
    ? Math.floor((Date.now() - new Date(stats.last_visit).getTime()) / 86400000) : 9999;
  if (days > 60) return 'At-risk';
  if (stats.total_spent >= 200000) return 'High value';
  if (stats.order_count >= 10) return 'Frequent';
  if (stats.order_count >= 3) return 'Returning';
  return 'New';
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

const TONES = ['#1B6B4F','#7A2235','#3A4E6B','#6A7048','#5C6675','#22324F','#B89456','#6B4A2B','#8A9078','#5E6539'];
function getTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return TONES[h % TONES.length];
}

function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return n.toString();
}
function fmtDate(iso: string | null): string {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
function fmtJoined(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function tierChipStyle(tier: string) {
  switch (tier) {
    case 'VIP':     return { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' };
    case 'Gold':    return { bg: 'var(--warn-soft)',   fg: 'var(--warn)' };
    case 'Regular': return { bg: 'rgba(20,22,26,0.05)', fg: 'var(--ink-2)' };
    default:        return { bg: '#E8EAF6', fg: '#3340A6' };
  }
}

function enrich(c: Customer, stats: SaleStats): EnrichedCustomer {
  return {
    ...c,
    ...stats,
    tier: deriveTier(c.loyalty_points),
    segment: deriveSegment(stats),
    initials: getInitials(c.name),
    tone: getTone(c.name),
  };
}

// ─── Avatar ─────────────────────────────────────────────────────────────
function Avatar({ initials, tone, size = 36 }: { initials: string; tone: string; size?: number }) {
  const fontSize = size >= 56 ? 19 : size >= 44 ? 16 : size >= 36 ? 13 : 10;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 65%, #000))`,
      color: '#fff', display: 'grid', placeItems: 'center',
      fontWeight: 600, fontSize, letterSpacing: '-0.01em', flexShrink: 0,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)',
    }}>{initials}</div>
  );
}

// ─── KPI row ────────────────────────────────────────────────────────────
function KPIRow({ customers }: { customers: EnrichedCustomer[] }) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const newThisMonth = customers.filter(c => c.created_at.startsWith(thisMonth)).length;
  const active30 = customers.filter(c => c.last_visit && Math.floor((Date.now() - new Date(c.last_visit).getTime()) / 86400000) <= 30).length;
  const atRisk = customers.filter(c => c.segment === 'At-risk').length;
  const avgLtv = customers.length ? customers.reduce((s, c) => s + c.total_spent, 0) / customers.length : 0;

  const kpis = [
    { label: 'Total Customers', value: customers.length.toLocaleString('en-US'), sub: 'across all segments' },
    { label: 'New This Month', value: newThisMonth.toLocaleString('en-US'), sub: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
    { label: 'Active (30d)', value: active30.toLocaleString('en-US'), sub: 'visited in last 30 days' },
    { label: 'Avg. Lifetime Value', value: fmtLKR(avgLtv), sub: 'LKR per customer' },
    { label: 'At-Risk', value: atRisk.toLocaleString('en-US'), sub: 'no visit in 60+ days', warn: true },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--gap)' }}>
      {kpis.map((k, i) => (
        <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, color: k.warn ? 'var(--warn)' : 'var(--ink)' }}>
            {k.value}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Segment chip bar ───────────────────────────────────────────────────
function SegmentBar({ customers, segment, setSegment }: {
  customers: EnrichedCustomer[];
  segment: string;
  setSegment: (s: string) => void;
}) {
  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { All: customers.length };
    customers.forEach(x => {
      c[x.tier] = (c[x.tier] || 0) + 1;
      c[x.segment] = (c[x.segment] || 0) + 1;
    });
    return c;
  }, [customers]);

  const segs = [
    { key: 'All', label: 'All customers' },
    { key: 'VIP', label: 'VIP' },
    { key: 'Gold', label: 'Gold' },
    { key: 'Regular', label: 'Regular' },
    { key: 'New', label: 'New' },
    { key: 'At-risk', label: 'At-risk', warn: true },
    { key: 'High value', label: 'High value' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '2px 0' }}>
      {segs.map(s => {
        const isA = s.key === segment;
        return (
          <button key={s.key} onClick={() => setSegment(s.key)} style={{
            padding: '6px 11px', borderRadius: 999,
            border: isA ? `1px solid ${s.warn ? 'var(--warn)' : 'var(--accent)'}` : '1px solid var(--line)',
            background: isA ? (s.warn ? 'var(--warn-soft)' : 'var(--accent-soft)') : 'var(--panel)',
            color: isA ? (s.warn ? 'var(--warn)' : 'var(--accent-ink)') : 'var(--ink-2)',
            fontSize: 12.5, fontWeight: isA ? 600 : 500,
            cursor: 'pointer', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            transition: 'all .12s',
          }}>
            {s.label}
            <span className="num" style={{ fontSize: 11, fontWeight: 500, color: isA ? 'inherit' : 'var(--faint)' }}>
              {counts[s.key] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Customer list ──────────────────────────────────────────────────────
function CustomerList({ items, search, setSearch, sort, setSort, selectedId, onSelect }: {
  items: EnrichedCustomer[];
  search: string; setSearch: (s: string) => void;
  sort: string; setSort: (s: string) => void;
  selectedId: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 600, overflow: 'hidden' }}>
      {/* Search + sort */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          height: 34, padding: '0 10px', borderRadius: 7,
          background: 'var(--panel-2)', border: '1px solid var(--line)',
        }}>
          <Search size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} strokeWidth={1.6} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone, ID…"
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 12.5, minWidth: 0, color: 'var(--ink)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--faint)', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          appearance: 'none', WebkitAppearance: 'none',
          height: 34, padding: '0 28px 0 10px', borderRadius: 7,
          border: '1px solid var(--line)',
          background: `var(--panel) url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%237C828B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center`,
          fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', outline: 'none', cursor: 'pointer',
        }}>
          <option value="recent">Most recent</option>
          <option value="spent">Highest spend</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {/* Count bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--line-2)', background: 'var(--panel-2)', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {items.length} {items.length === 1 ? 'customer' : 'customers'}
        </span>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} className="custom-scrollbar">
        {items.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No customers match these filters.
          </div>
        ) : items.map((c, i) => (
          <CustomerRow key={c.id} c={c} isLast={i === items.length - 1} selected={c.id === selectedId} onClick={() => onSelect(c.id)} />
        ))}
      </div>
    </div>
  );
}

function CustomerRow({ c, isLast, selected, onClick }: { c: EnrichedCustomer; isLast: boolean; selected: boolean; onClick: () => void }) {
  const ts = tierChipStyle(c.tier);
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12,
      alignItems: 'center', padding: '12px 16px',
      border: 0, borderBottom: isLast ? 'none' : '1px solid var(--line-2)',
      background: selected ? 'color-mix(in oklab, var(--accent) 6%, transparent)' : 'transparent',
      borderLeft: selected ? '3px solid var(--accent)' : '3px solid transparent',
      paddingLeft: selected ? 13 : 16,
      transition: 'background .12s',
    }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--panel-2)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <Avatar initials={c.initials} tone={c.tone} size={36} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.name}
          </span>
          <span style={{ background: ts.bg, color: ts.fg, fontSize: 9.5, padding: '1px 6px', borderRadius: 999, fontWeight: 600, letterSpacing: '.04em', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {c.tier.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {c.address && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address.split(',')[0]}</span>}
          {c.address && <span style={{ color: 'var(--faint)' }}>·</span>}
          <span>{fmtDate(c.last_visit)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {fmtK(c.total_spent)}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 2, fontWeight: 500 }}>
          <span className="num">{c.order_count}</span> orders
        </div>
      </div>
    </button>
  );
}

// ─── Customer detail ─────────────────────────────────────────────────────
function CustomerDetail({ c, onEdit, onManageCredit }: {
  c: EnrichedCustomer;
  onEdit: (c: EnrichedCustomer) => void;
  onManageCredit: (c: EnrichedCustomer) => void;
}) {
  const [tab, setTab] = useState<'orders' | 'notes' | 'activity'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const ts = tierChipStyle(c.tier);
  const pointsToNext = c.tier === 'VIP' ? 0 : c.tier === 'Gold' ? 2000 - c.loyalty_points : c.tier === 'Regular' ? 1000 - c.loyalty_points : 100 - c.loyalty_points;
  const nextTier = c.tier === 'New' ? 'Regular' : c.tier === 'Regular' ? 'Gold' : c.tier === 'Gold' ? 'VIP' : 'VIP+';
  const loyaltyTotal = c.loyalty_points + Math.max(0, pointsToNext);
  const loyaltyPct = loyaltyTotal > 0 ? Math.min(100, (c.loyalty_points / loyaltyTotal) * 100) : 100;

  useEffect(() => {
    setTab('orders');
    setOrders([]);
  }, [c.id]);

  useEffect(() => {
    if (tab !== 'orders') return;
    setLoadingOrders(true);
    salesService.getSalesByCustomer(c.id).then(data => {
      setOrders((data as any[]).slice(0, 20));
    }).catch(() => {}).finally(() => setLoadingOrders(false));
  }, [c.id, tab]);

  const metaItems = [
    c.email && { icon: <Mail size={13} />, text: c.email },
    c.phone && { icon: <Phone size={13} />, text: c.phone },
    c.address && { icon: <MapPin size={13} />, text: c.address },
    { icon: <Clock size={13} />, text: `Customer since ${fmtJoined(c.created_at)}` },
  ].filter(Boolean) as { icon: JSX.Element; text: string }[];

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 600, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 22px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <Avatar initials={c.initials} tone={c.tone} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{c.name}</h2>
            <span style={{ background: ts.bg, color: ts.fg, fontSize: 10.5, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{c.tier} customer</span>
            <span style={{ background: 'rgba(20,22,26,0.05)', color: 'var(--ink-2)', fontSize: 10.5, padding: '2px 8px', borderRadius: 999, fontWeight: 500 }}>{c.segment}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
            {metaItems.map((m, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}>
                {m.icon} {m.text}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => onEdit(c)} className="btn btn-sm" style={{ height: 32 }}>Edit</button>
          {c.current_credit > 0 && (
            <button onClick={() => onManageCredit(c)} className="btn btn-sm" style={{ height: 32 }}>Credit</button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, borderBottom: '1px solid var(--line-2)' }}>
        <StatBlock label="Lifetime spend" value={fmtLKR(c.total_spent)} accent />
        <StatBlock label="Total orders" value={c.order_count.toString()} sub={c.order_count > 0 ? `Avg ${fmtLKR(c.order_count ? c.total_spent / c.order_count : 0)}` : 'No orders yet'} />
        <StatBlock label="Last visit" value={fmtDate(c.last_visit)} sub={`Since ${fmtJoined(c.created_at)}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>Loyalty points</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="num" style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              {c.loyalty_points.toLocaleString('en-US')}
            </span>
            {c.tier !== 'VIP' && (
              <span className="num" style={{ fontSize: 11, color: 'var(--faint)' }}>/ {loyaltyTotal.toLocaleString('en-US')}</span>
            )}
          </div>
          <div style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
            <div style={{ width: loyaltyPct + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
          </div>
          {c.tier !== 'VIP' ? (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              <span className="num" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{pointsToNext}</span> pts to {nextTier}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--accent-ink)', fontWeight: 500 }}>Top tier</div>
          )}
        </div>
      </div>

      {/* Credit strip (only if customer has credit) */}
      {(c.credit_limit > 0 || c.current_credit > 0) && (
        <div style={{ padding: '10px 22px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 16, background: c.current_credit > 0 ? 'var(--danger-soft)' : 'var(--panel-2)' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Outstanding credit</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 600, color: c.current_credit > 0 ? 'var(--danger)' : 'var(--pos)', marginTop: 2 }}>
              {fmtLKR(c.current_credit)}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: 'var(--line)' }} />
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Credit limit</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{fmtLKR(c.credit_limit)}</div>
          </div>
          {c.current_credit > 0 && (
            <button onClick={() => onManageCredit(c)} className="btn btn-sm" style={{ marginLeft: 'auto' }}>Manage credit</button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 22px', borderBottom: '1px solid var(--line-2)', display: 'flex' }}>
        {([
          { k: 'orders' as const, l: `Orders · ${c.order_count}` },
          { k: 'notes' as const, l: 'Notes' },
          { k: 'activity' as const, l: 'Activity' },
        ]).map(t => {
          const isA = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              padding: '12px 4px', marginRight: 24, border: 0, background: 'transparent',
              fontSize: 13, fontWeight: isA ? 600 : 500,
              color: isA ? 'var(--ink)' : 'var(--muted)',
              borderBottom: isA ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1,
            }}>{t.l}</button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }} className="custom-scrollbar">
        {tab === 'orders' && <OrdersTab orders={orders} loading={loadingOrders} />}
        {tab === 'notes' && <NotesTab note={c.notes} />}
        {tab === 'activity' && <ActivityTab c={c} />}
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div className={/[\d,]/.test(value) ? 'num' : ''} style={{
        fontSize: accent ? 19 : 16, fontWeight: 600, letterSpacing: '-0.01em',
        color: accent ? 'var(--accent-ink)' : 'var(--ink)', lineHeight: 1.15,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function OrdersTab({ orders, loading }: { orders: any[]; loading: boolean }) {
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><div className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} /></div>;
  if (orders.length === 0) return <div style={{ padding: '30px 22px', color: 'var(--muted)', fontSize: 13 }}>No orders yet from this customer.</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 120px 90px 80px', gap: 12, padding: '10px 22px', fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--line-2)', background: 'var(--panel-2)' }}>
        <span>Invoice</span><span>Date</span><span style={{ textAlign: 'right' }}>Items</span><span style={{ textAlign: 'right' }}>Amount</span><span>Payment</span><span style={{ textAlign: 'right' }}>Status</span>
      </div>
      {orders.map((o, i) => {
        const isPaid = o.status === 'completed' || o.status === 'paid' || o.paid_amount >= o.total_amount;
        return (
          <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 120px 90px 80px', gap: 12, padding: '12px 22px', alignItems: 'center', borderBottom: i === orders.length - 1 ? 'none' : '1px solid var(--line-2)', fontSize: 13 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{o.sale_number}</span>
            <span style={{ color: 'var(--ink-2)' }}>{new Date(o.sale_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span className="num" style={{ textAlign: 'right', color: 'var(--muted)' }}>{(o as any).item_count ?? '—'}</span>
            <span className="num" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{fmtLKR(o.total_amount)}</span>
            <span style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>{o.payment_method}</span>
            <span style={{ textAlign: 'right' }}>
              {isPaid
                ? <span style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>Paid</span>
                : o.status === 'credit' || o.status === 'partial'
                  ? <span style={{ background: 'var(--warn-soft)', color: 'var(--warn)', fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>Credit</span>
                  : <span style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>Refunded</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NotesTab({ note }: { note: string | null }) {
  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--panel-2)', border: '1px solid var(--line-2)' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {note || 'No notes yet. Edit this customer to add a note.'}
        </p>
      </div>
    </div>
  );
}

function ActivityTab({ c }: { c: EnrichedCustomer }) {
  const items = [
    c.last_visit && { t: fmtDate(c.last_visit), type: 'sale', text: 'Last purchase visit' },
    c.loyalty_points > 0 && { t: 'Loyalty', type: 'loyalty', text: `${c.loyalty_points.toLocaleString('en-US')} loyalty points earned` },
    { t: fmtJoined(c.created_at), type: 'signup', text: 'Joined loyalty program' },
  ].filter(Boolean) as { t: string; type: string; text: string }[];

  const iconFor = (type: string) => {
    if (type === 'sale') return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 002 1.6h7.5a2 2 0 002-1.5L21 7H6"/></svg>;
    if (type === 'loyalty') return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15 9 22 9.3 17 14 18.5 21 12 17.3 5.5 21 7 14 2 9.3 9 9 12 2"/></svg>;
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>;
  };

  return (
    <div style={{ padding: '18px 22px' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, padding: '10px 0', alignItems: 'flex-start', borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', marginTop: 1 }}>
            {iconFor(it.type)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4, paddingTop: 4 }}>{it.text}</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', paddingTop: 5, whiteSpace: 'nowrap' }}>{it.t}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Add/Edit modal ──────────────────────────────────────────────────────
function CustomerModal({ mode, customer, onClose, onSaved }: {
  mode: 'add' | 'edit';
  customer?: EnrichedCustomer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    credit_limit: customer?.credit_limit ?? 0,
    notes: customer?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'add') {
        await customerService.createCustomer({ name: form.name, phone: form.phone || null, email: form.email || null, address: form.address || null, credit_limit: form.credit_limit });
        showToast('Customer added', 'success');
      } else {
        await customerService.updateCustomer(customer!.id, { name: form.name, phone: form.phone || null, email: form.email || null, address: form.address || null, credit_limit: form.credit_limit, notes: form.notes || null });
        showToast('Customer updated', 'success');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = { width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13, color: 'var(--ink)', background: 'var(--panel)', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' };

  return (
    <Modal isOpen onClose={onClose} title={mode === 'add' ? 'Add Customer' : 'Edit Customer'} size="md">
      <form onSubmit={handleSubmit} style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Full Name *</label>
            <input required style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Customer name" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+94 7x xxx xxxx" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="City / district" />
          </div>
          <div>
            <label style={labelStyle}>Credit Limit (LKR)</label>
            <input style={{ ...inputStyle, textAlign: 'right' }} type="number" min={0} value={form.credit_limit} onChange={e => setForm(p => ({ ...p, credit_limit: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <input style={inputStyle} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Internal note" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : mode === 'add' ? 'Add Customer' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Credit modal (kept from existing) ──────────────────────────────────
function CreditModal({ customer, onClose, onUpdated }: { customer: EnrichedCustomer; onClose: () => void; onUpdated: () => void }) {
  const { showToast } = useToast();
  const [creditSales, setCreditSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});

  useEffect(() => {
    salesService.getCreditSalesByCustomer(customer.id).then(d => { setCreditSales(d as any[]); setLoading(false); }).catch(() => setLoading(false));
  }, [customer.id]);

  async function handlePay(sale: any) {
    const amt = parseFloat(paymentAmount[sale.id] || '0');
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'warning'); return; }
    const remaining = sale.total_amount - sale.paid_amount;
    if (amt > remaining) { showToast(`Cannot exceed remaining balance of ${fmtLKR(remaining)}`, 'warning'); return; }
    try {
      await salesService.processCreditPayment(sale.id, amt);
      showToast(`Payment of ${fmtLKR(amt)} recorded`, 'success');
      onUpdated();
      onClose();
    } catch (err: any) { showToast(err.message, 'error'); }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Credit — ${customer.name}`} size="lg">
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Outstanding</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--danger)', marginTop: 4 }}>{fmtLKR(customer.current_credit)}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Credit Limit</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>{fmtLKR(customer.credit_limit)}</div>
          </div>
        </div>
        {loading ? <LoadingSpinner message="Loading…" /> : creditSales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: 13 }}>No outstanding credit sales.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }} className="custom-scrollbar">
            {creditSales.map(sale => {
              const remaining = sale.total_amount - sale.paid_amount;
              return (
                <div key={sale.id} style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{sale.sale_number}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {new Date(sale.sale_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Remaining: <span className="num" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmtLKR(remaining)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={0} max={remaining}
                      value={paymentAmount[sale.id] || ''}
                      onChange={e => setPaymentAmount(p => ({ ...p, [sale.id]: e.target.value }))}
                      placeholder="Amount"
                      style={{ width: 110, height: 32, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--panel)', outline: 'none' }}
                    />
                    <button onClick={() => handlePay(sale)} disabled={!paymentAmount[sale.id]} className="btn btn-sm btn-primary">Pay</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 14 }}>
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────
export function Customers() {
  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, SaleStats>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('All');
  const [sort, setSort] = useState('recent');
  const [selectedId, setSelectedId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editCustomer, setEditCustomer] = useState<EnrichedCustomer | undefined>(undefined);
  const [creditCustomer, setCreditCustomer] = useState<EnrichedCustomer | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [customers] = await Promise.all([customerService.getAllCustomers()]);
      setRawCustomers(customers);

      // Fetch sales aggregates via Supabase client
      try {
        const client = (customerService as any).customerRepo.adapter.getClient();
        const { data } = await client
          .from('sales')
          .select('customer_id, total_amount, sale_date')
          .not('customer_id', 'is', null);

        const map: Record<string, SaleStats> = {};
        (data ?? []).forEach((row: any) => {
          if (!map[row.customer_id]) map[row.customer_id] = { total_spent: 0, order_count: 0, last_visit: null };
          map[row.customer_id].total_spent += row.total_amount;
          map[row.customer_id].order_count += 1;
          if (!map[row.customer_id].last_visit || row.sale_date > map[row.customer_id].last_visit!) {
            map[row.customer_id].last_visit = row.sale_date;
          }
        });
        setStatsMap(map);
      } catch { /* sales aggregates optional */ }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const customers = useMemo<EnrichedCustomer[]>(() => {
    return rawCustomers.map(c => enrich(c, statsMap[c.id] ?? { total_spent: 0, order_count: 0, last_visit: null }));
  }, [rawCustomers, statsMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = customers.filter(c => {
      if (segment !== 'All' && c.tier !== segment && c.segment !== segment) return false;
      if (q && !(
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        c.id.toLowerCase().includes(q)
      )) return false;
      return true;
    });
    if (sort === 'spent') rows = [...rows].sort((a, b) => b.total_spent - a.total_spent);
    else if (sort === 'name') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [customers, search, segment, sort]);

  const current = useMemo(() => {
    return customers.find(c => c.id === selectedId) ?? filtered[0] ?? null;
  }, [customers, selectedId, filtered]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  if (loading) return <LoadingSpinner message="Loading customers…" />;

  return (
    <div style={{ padding: '0 24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page header */}
      <div style={{ padding: '24px 0 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Customers</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{customers.length.toLocaleString('en-US')} people</span> have shopped with Rivonlak
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Export
          </button>
          <button className="btn btn-primary" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setModalMode('add'); setEditCustomer(undefined); setShowModal(true); }}>
            <Plus size={14} /> Add Customer
          </button>
        </div>
      </div>

      <KPIRow customers={customers} />
      <SegmentBar customers={customers} segment={segment} setSegment={setSegment} />

      {/* Split pane */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 420px) minmax(0, 1fr)', gap: 'var(--gap)', alignItems: 'stretch' }}>
        <CustomerList items={filtered} search={search} setSearch={setSearch} sort={sort} setSort={setSort} selectedId={current?.id ?? ''} onSelect={setSelectedId} />
        {current ? (
          <CustomerDetail
            c={current}
            onEdit={c => { setEditCustomer(c); setModalMode('edit'); setShowModal(true); }}
            onManageCredit={c => setCreditCustomer(c)}
          />
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13, minHeight: 600 }}>
            Select a customer to view their profile.
          </div>
        )}
      </div>

      {showModal && (
        <CustomerModal mode={modalMode} customer={editCustomer} onClose={() => setShowModal(false)} onSaved={load} />
      )}
      {creditCustomer && (
        <CreditModal customer={creditCustomer} onClose={() => setCreditCustomer(undefined)} onUpdated={load} />
      )}
    </div>
  );
}
