import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight, ShoppingCart, RotateCcw, Truck, Users, AlertTriangle } from 'lucide-react';
import { StockFilter } from '../hooks/useProducts';
import { productService, customerService, salesService, variantService } from '../services';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  onNavigate?: (view: string) => void;
  onFilterNavigate?: (filter: StockFilter) => void;
}

// ── Sparkline ─────────────────────────────────────────────
function Sparkline({ data, color = 'var(--accent)', width = 72, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const n = data.length;
  const stepX = width / (n - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = path + ` L${width},${height} L0,${height} Z`;
  const gid = 'sg' + Math.random().toString(36).slice(2, 7);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, sub, spark, delta = 0, tone = 'default' }: {
  label: string; value: string; sub: string;
  spark?: number[]; delta?: number; tone?: 'default' | 'warn' | 'danger';
}) {
  const positive = tone === 'warn' ? false : delta >= 0;
  const chipClass = tone === 'warn' ? 'chip-warn' : tone === 'danger' ? 'chip-neg' : positive ? 'chip-pos' : 'chip-neg';
  const sparkColor = tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : positive ? 'var(--accent)' : 'var(--danger)';
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
        <span className={`chip ${chipClass}`} style={{ fontSize: 10.5, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Arrow size={10} strokeWidth={2.5} />
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div className="num kpi-value" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {spark && <div className="kpi-spark" style={{ flexShrink: 0 }}><Sparkline data={spark} color={sparkColor} width={64} height={26} /></div>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

// ── Revenue Chart ─────────────────────────────────────────
function RevenueChart({ data, period, onPeriod }: { data: { name: string; revenue: number; cost: number }[]; period: string; onPeriod: (p: string) => void }) {
  const W = 720, H = 240, PL = 52, PR = 12, PT = 14, PB = 28;
  const iw = W - PL - PR, ih = H - PT - PB;

  const fmtK = (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(Math.round(v));
  const fmtFull = (v: number) => `LKR ${Math.round(v).toLocaleString()}`;

  if (data.length < 2) return (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Not enough data to draw chart yet.</div>
  );

  const xs = data.map((_, i) => PL + (i / Math.max(data.length - 1, 1)) * iw);
  const maxY = Math.max(...data.map(d => d.revenue)) * 1.12 || 1;
  const y = (v: number) => PT + ih - (v / maxY) * ih;

  const linePath = (key: 'revenue' | 'cost') =>
    data.map((d, i) => (i ? 'L' : 'M') + xs[i].toFixed(1) + ',' + y(d[key]).toFixed(1)).join(' ');
  const areaPath = (key: 'revenue' | 'cost') =>
    linePath(key) + ` L${xs[xs.length - 1]},${PT + ih} L${xs[0]},${PT + ih} Z`;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxY / ticks) * i));

  const xLabels = data.reduce<{ x: number; label: string }[]>((acc, d, i) => {
    const step = Math.max(1, Math.floor(data.length / 6));
    if (i % step === 0 || i === data.length - 1) acc.push({ x: xs[i], label: d.name });
    return acc;
  }, []);

  const lastIdx = data.length - 1;
  const totalRev = data.reduce((s, d) => s + d.revenue, 0);
  const totalCost = data.reduce((s, d) => s + d.cost, 0);
  const margin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Revenue &amp; Cost</h3>
          <div className="sub" style={{ marginTop: 2 }}>Sales performance over time</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['7D', '30D', '90D', 'YTD'].map(r => (
            <button key={r} onClick={() => onPeriod(r)} className="btn btn-sm" style={{
              background: r === period ? 'var(--accent-soft)' : 'transparent',
              borderColor: r === period ? 'transparent' : 'var(--line)',
              color: r === period ? 'var(--accent-ink)' : 'var(--ink-2)',
              fontWeight: r === period ? 600 : 500,
            }}>{r}</button>
          ))}
        </div>
      </div>

      <div className="chart-stat-row" style={{ padding: '14px 18px 6px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <ChartStat label="Total Revenue" value={fmtFull(totalRev)} delta={+12.4} />
        <ChartStat label="Total Cost" value={fmtFull(totalCost)} delta={+8.1} invert />
        <ChartStat label="Gross Margin" value={margin.toFixed(1) + '%'} delta={+2.3} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, paddingBottom: 4 }}>
          <LegendDot color="var(--accent)" label="Revenue" />
          <LegendDot color="#C68A2E" label="Cost (COGS)" />
        </div>
      </div>

      <div style={{ padding: '4px 8px 14px 0', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="rev-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="var(--line-2)" strokeDasharray={i ? '2 4' : ''} />
              <text x={PL - 6} y={y(t) + 3} fontSize="10.5" textAnchor="end" fill="var(--faint)" fontFamily="'JetBrains Mono',monospace">{fmtK(t)}</text>
            </g>
          ))}

          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={H - 8} fontSize="10.5" textAnchor="middle" fill="var(--faint)">{l.label}</text>
          ))}

          <path d={areaPath('revenue')} fill="url(#rev-g)" />
          <path d={linePath('revenue')} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          <path d={linePath('cost')} fill="none" stroke="#C68A2E" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 3" />
          <circle cx={xs[lastIdx]} cy={y(data[lastIdx].revenue)} r="4" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
          <circle cx={xs[lastIdx]} cy={y(data[lastIdx].cost)} r="3" fill="#C68A2E" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}

function ChartStat({ label, value, delta, invert = false }: { label: string; value: string; delta: number; invert?: boolean }) {
  const positive = invert ? delta < 0 : delta >= 0;
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div className="num" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{value}</div>
        <span className={`chip ${positive ? 'chip-pos' : 'chip-neg'}`} style={{ fontSize: 10.5, padding: '1px 6px' }}>
          {delta >= 0 ? '+' : ''}{delta}%
        </span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

// ── Top Sellers ───────────────────────────────────────────
function TopSellers({ items }: { items: { name: string; sku: string; units: number; rev: number; color: string }[] }) {
  const maxRev = Math.max(...items.map(i => i.rev), 1);
  const fmtLKR = (v: number) => `LKR ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toLocaleString()}`;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Top Sellers</h3>
          <div className="sub" style={{ marginTop: 2 }}>by revenue · this period</div>
        </div>
      </div>
      <div style={{ padding: '4px 0' }}>
        {items.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No sales data yet.</div>
        ) : items.map((it, i) => (
          <div key={i} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
            <div style={{ width: 34, height: 42, borderRadius: 5, flexShrink: 0, background: `linear-gradient(160deg, ${it.color}, color-mix(in oklab, ${it.color} 78%, #000))`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: "'JetBrains Mono',monospace" }}>{it.sku}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {it.units} units</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
              <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{fmtLKR(it.rev)}</div>
              <div style={{ marginTop: 6, height: 3, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: ((it.rev / maxRev) * 100) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recent Invoices ───────────────────────────────────────
function RecentInvoices({ items, onViewAll }: { items: any[]; onViewAll: () => void }) {
  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Recent Invoices</h3>
          <div className="sub" style={{ marginTop: 2 }}>{items.length} recent transactions</div>
        </div>
        <button onClick={onViewAll} className="btn btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          View all <ArrowRight size={12} />
        </button>
      </div>
      <div style={{ padding: '4px 0' }}>
        {items.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No recent sales found.</div>
        ) : items.map((sale, i) => {
          const name = sale.customers?.name || 'Walk-in customer';
          const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
          const isWalkin = !sale.customers?.name;
          const itemCount = sale.sale_items?.length ?? 0;
          const isRefunded = sale.status === 'refunded';
          return (
            <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: isWalkin ? 'rgba(20,22,26,0.06)' : 'var(--accent-soft)', color: isWalkin ? 'var(--muted)' : 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  {isRefunded && <span className="chip chip-neg" style={{ fontSize: 10 }}>Refunded</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <span className="num" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>#{sale.sale_number?.slice(-6)}</span>
                  <span style={{ color: 'var(--faint)' }}>·</span>
                  {itemCount > 0 && <><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span><span style={{ color: 'var(--faint)' }}>·</span></>}
                  <span style={{ textTransform: 'capitalize' }}>{sale.payment_method || 'cash'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', color: isRefunded ? 'var(--danger)' : 'var(--ink)' }}>
                  {isRefunded && '−'}LKR {Number(sale.total_amount).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap' }}>{timeAgo(sale.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stock Alerts ──────────────────────────────────────────
function StockAlerts({ lowItems, outItems, variantItems, onNavigate }: {
  lowItems: any[]; outItems: any[]; variantItems: any[];
  onNavigate: (filter: StockFilter) => void;
}) {
  const [tab, setTab] = useState<'low' | 'out' | 'variants'>('low');
  const tabs = [
    { id: 'low' as const, label: 'Low Stock', count: lowItems.length, tone: 'warn' },
    { id: 'out' as const, label: 'Out of Stock', count: outItems.length, tone: 'danger' },
    { id: 'variants' as const, label: 'Variants', count: variantItems.length, tone: 'neutral' },
  ];
  const list = tab === 'low' ? lowItems : tab === 'out' ? outItems : variantItems;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-h">
        <div>
          <h3>Stock Alerts</h3>
          <div className="sub" style={{ marginTop: 2 }}>{lowItems.length + outItems.length} items need attention</div>
        </div>
        <button onClick={() => onNavigate(tab === 'out' ? 'out_of_stock' : 'low_stock')} className="btn btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Reorder <ArrowRight size={12} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, padding: '0 14px', borderBottom: '1px solid var(--line-2)' }}>
        {tabs.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 12px 10px', border: 0, background: 'transparent', cursor: 'default',
              borderBottom: isActive ? '2px solid var(--ink)' : '2px solid transparent',
              marginBottom: -1, color: isActive ? 'var(--ink)' : 'var(--muted)',
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              <span style={{ fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: isActive ? 'var(--accent-soft)' : 'rgba(20,22,26,0.05)', color: isActive ? 'var(--accent-ink)' : 'var(--muted)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        {list.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {tab === 'variants' ? 'All variants are well stocked.' : 'All good — no alerts.'}
          </div>
        ) : list.slice(0, 6).map((it: any, i: number) => {
          const isVariant = tab === 'variants';
          const isOut = tab === 'out';
          const stock = it.total_stock ?? 0;
          const reorder = it.reorder_level || (isOut ? 6 : 10);
          const pct = Math.min(100, stock === 0 ? 0 : (stock / Math.max(reorder, stock)) * 100);

          return (
            <div key={i} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i === Math.min(list.length, 6) - 1 ? 'none' : '1px solid var(--line-2)', cursor: 'pointer' }}
              onClick={() => onNavigate(isOut ? 'out_of_stock' : 'low_stock')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isVariant ? (it.sku || it.color + ' ' + it.size) : it.name}
                </div>
                <div style={{ fontSize: 11, marginTop: 3, fontFamily: isVariant ? undefined : "'JetBrains Mono',monospace", color: 'var(--faint)' }}>
                  {isVariant
                    ? ([it.color, it.size].filter(Boolean).join(' · ') || 'Variant')
                    : (it.sku || '')
                  }
                </div>
              </div>
              {isVariant ? (
                <span className="chip chip-warn" style={{ flexShrink: 0 }}>{stock} left</span>
              ) : (
                <div style={{ width: 96, flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'baseline' }}>
                    <span className="num" style={{ color: isOut ? 'var(--danger)' : 'var(--warn)', fontWeight: 600, fontSize: 12 }}>{stock}</span>
                    <span className="num" style={{ color: 'var(--faint)' }}>/ {reorder}</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: pct + '%', height: '100%', background: isOut ? 'var(--danger)' : 'var(--warn)', borderRadius: 2 }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Staff Leaderboard ─────────────────────────────────────
function StaffLeaderboard({ staff }: { staff: { name: string; role: string; initials: string; sales: number; revenue: number; tone: string }[] }) {
  const maxRev = Math.max(...staff.map(s => s.revenue), 1);
  const fmtLKR = (v: number) => `LKR ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toLocaleString()}`;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Today's Top Staff</h3>
          <div className="sub" style={{ marginTop: 2 }}>by revenue generated</div>
        </div>
        <span className="chip chip-neutral">{staff.reduce((s, p) => s + p.sales, 0)} sales</span>
      </div>
      <div style={{ padding: '4px 0' }}>
        {staff.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No sales recorded today yet.</div>
        ) : staff.map((s, i) => (
          <div key={i} style={{ padding: '12px 18px', borderBottom: i === staff.length - 1 ? 'none' : '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${s.tone}, color-mix(in oklab, ${s.tone} 70%, #000))`, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600 }}>
                {s.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{s.role}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtLKR(s.revenue)}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.sales} sales</div>
              </div>
            </div>
            <div style={{ height: 3, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden', marginLeft: 44 }}>
              <div style={{ width: ((s.revenue / maxRev) * 100) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────
type ActivityType = 'sale' | 'refund' | 'stock' | 'restock' | 'customer';

function ActivityFeed({ items }: { items: { type: ActivityType; text: string; time: string; by: string }[] }) {
  const dotConfig: Record<ActivityType, { bg: string; fg: string; Icon: React.ComponentType<{ size: number; strokeWidth: number }> }> = {
    sale: { bg: 'var(--accent-soft)', fg: 'var(--accent)', Icon: ShoppingCart },
    refund: { bg: 'var(--danger-soft)', fg: 'var(--danger)', Icon: RotateCcw },
    stock: { bg: 'var(--warn-soft)', fg: 'var(--warn)', Icon: AlertTriangle },
    restock: { bg: 'rgba(20,22,26,0.05)', fg: 'var(--ink-2)', Icon: Truck },
    customer: { bg: 'rgba(20,22,26,0.05)', fg: 'var(--ink-2)', Icon: Users },
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Activity</h3>
          <div className="sub" style={{ marginTop: 2 }}>Recent store events</div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--accent)', fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)' }} />
          LIVE
        </span>
      </div>
      <div style={{ padding: '4px 14px 14px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 4px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No recent activity.</div>
        ) : items.map((a, i) => {
          const d = dotConfig[a.type] || dotConfig.sale;
          const { Icon } = d;
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 4px', alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: d.bg, color: d.fg, display: 'grid', placeItems: 'center', marginTop: 1 }}>
                <Icon size={13} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>{a.text}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                  <span className="num">{a.time}</span> · by {a.by}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────
export function Dashboard({ onNavigate, onFilterNavigate }: DashboardProps) {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState({ count: 0, revenue: 0 });
  const [yesterdayStats, setYesterdayStats] = useState({ count: 0, revenue: 0 });
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [pendingReturns, setPendingReturns] = useState(0);
  const [salesData, setSalesData] = useState<{ name: string; revenue: number; cost: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState('30D');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [variantLowStockItems, setVariantLowStockItems] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<{ name: string; sku: string; units: number; rev: number; color: string }[]>([]);
  const [cashierStats, setCashierStats] = useState<{ cashier_id: string; full_name: string; sales: number; revenue: number }[]>([]);
  const [activityItems, setActivityItems] = useState<{ type: ActivityType; text: string; time: string; by: string }[]>([]);

  useEffect(() => {
    const days = chartPeriod === '7D' ? 7 : chartPeriod === '90D' ? 90 : chartPeriod === 'YTD' ? Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) : 30;
    load(days);
  }, [chartPeriod]);

  const timeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  async function load(days: number) {
    try {
      const [
        allProducts, customerCount, todaySalesData, yesterdaySalesData, pendingCount,
        recentSalesData, historyData, topSellerData, variantLowStock, cashiers,
      ] = await Promise.all([
        productService.getAllProducts(),
        customerService.getCustomerCount(),
        salesService.getTodaySales(),
        salesService.getYesterdayStats(),
        salesService.getPendingReturnsCount(),
        salesService.getRecentSales(8),
        salesService.getSalesHistoryWithCost(days),
        salesService.getTopSellingWithRevenue(5),
        variantService.getLowStockVariants(),
        salesService.getCashierStats(),
      ]);

      const lowList = allProducts.filter(p => p.total_stock > 0 && p.total_stock <= 5);
      const outList = allProducts.filter(p => p.total_stock === 0);

      const chartData = (historyData || []).map((day: any) => ({
        name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(day.revenue),
        cost: Math.round(day.cost),
      }));

      // Build activity from recent sales
      const activity: { type: ActivityType; text: string; time: string; by: string }[] = (recentSalesData || [])
        .slice(0, 5)
        .map((s: any) => ({
          type: 'sale' as ActivityType,
          text: `${s.sale_number} · ${s.customers?.name || 'Walk-in'} · LKR ${Number(s.total_amount).toLocaleString()}`,
          time: timeAgo(s.created_at),
          by: 'Cashier',
        }));

      // Append stock alerts as activity if any
      if (lowList.length > 0) {
        activity.push({
          type: 'stock',
          text: `Low stock alert · ${lowList[0].name} (${lowList[0].total_stock} left)`,
          time: 'Today',
          by: 'system',
        });
      }

      setTodayStats({ count: todaySalesData.count, revenue: todaySalesData.revenue });
      setYesterdayStats(yesterdaySalesData);
      setTotalProducts(allProducts.length);
      setTotalCustomers(customerCount || 0);
      setPendingReturns(pendingCount || 0);
      setSalesData(chartData);
      setRecentSales(recentSalesData || []);
      setLowStockItems(lowList);
      setOutOfStockItems(outList);
      setVariantLowStockItems(variantLowStock || []);
      setTopSellers(topSellerData);
      setCashierStats(cashiers);
      setActivityItems(activity);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Compute deltas
  const delta = (current: number, prev: number) => prev > 0 ? ((current - prev) / prev) * 100 : 0;
  const revDelta = delta(todayStats.revenue, yesterdayStats.revenue);
  const salesDelta = delta(todayStats.count, yesterdayStats.count);

  // Spark from chart data (last 12 points)
  const revSpark = salesData.slice(-12).map(d => d.revenue);
  const countSpark = salesData.slice(-12).map((_, i) => i + 1);

  const fmtLKR = (v: number) => `LKR ${Math.round(v).toLocaleString()}`;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Build staff display list - use cashier stats, fall back to design placeholder if empty
  const STAFF_TONES = ['#1B6B4F', '#3A4E6B', '#7A2A56', '#5C6675'];
  const staffList = cashierStats.length > 0
    ? cashierStats.map((c, i) => ({
        name: c.full_name,
        role: 'Cashier',
        initials: c.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
        sales: c.sales,
        revenue: c.revenue,
        tone: STAFF_TONES[i % STAFF_TONES.length],
      }))
    : [
        { name: profile?.full_name || 'Cashier', role: profile?.role === 'admin' ? 'Admin' : 'Cashier', initials: (profile?.full_name || 'C').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(), sales: todayStats.count, revenue: todayStats.revenue, tone: '#1B6B4F' },
      ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', paddingBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Good morning, {firstName}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            Here's how the store is performing today — <span style={{ color: 'var(--ink-2)' }}>{today}</span>.
          </p>
        </div>
        <div className="dashboard-status" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Store</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Open · 09:00–21:00</span>
          </div>
          <div style={{ width: 1, height: 14, background: 'var(--line)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pending returns</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 500, color: pendingReturns > 0 ? 'var(--warn)' : 'var(--ink)' }}>{pendingReturns}</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid-kpi">
        <KPICard label="Today's Revenue" value={fmtLKR(todayStats.revenue)} sub="vs. yesterday" spark={revSpark.length ? revSpark : [1, 2]} delta={revDelta} />
        <KPICard label="Invoices Today" value={todayStats.count.toLocaleString()} sub="vs. yesterday" spark={countSpark} delta={salesDelta} />
        <KPICard label="Total Products" value={totalProducts.toLocaleString()} sub="Active SKUs in inventory" spark={[10, 11, 11, 12, 12, 13, 13, 14, 14, 14, 15, 15]} delta={1.8} />
        <KPICard label="Active Customers" value={totalCustomers.toLocaleString()} sub="Customer profiles" spark={[14, 15, 15, 16, 17, 17, 18, 18, 19, 19, 20, 21]} delta={1.8} />
        <KPICard label="Low Stock SKUs" value={lowStockItems.length.toLocaleString()} sub="Needs reorder" tone="warn" delta={-2} />
        <KPICard label="Returns This Week" value={pendingReturns.toLocaleString()} sub="Pending review" tone={pendingReturns > 0 ? 'warn' : 'default'} delta={pendingReturns > 0 ? 0 : -1} />
      </div>

      {/* Revenue chart + Top sellers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--gap)' }}>
        <div style={{ minWidth: 0 }}>
          <RevenueChart data={salesData} period={chartPeriod} onPeriod={setChartPeriod} />
        </div>
        <div style={{ minWidth: 0 }}>
          <TopSellers items={topSellers} />
        </div>
      </div>

      {/* Invoices + Stock alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--gap)' }}>
        <RecentInvoices items={recentSales} onViewAll={() => onNavigate?.('sales-history')} />
        <StockAlerts lowItems={lowStockItems} outItems={outOfStockItems} variantItems={variantLowStockItems} onNavigate={(f) => onFilterNavigate?.(f)} />
      </div>

      {/* Staff leaderboard + Activity feed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--gap)' }}>
        <StaffLeaderboard staff={staffList} />
        <ActivityFeed items={activityItems} />
      </div>

    </div>
  );
}
