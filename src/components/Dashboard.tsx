import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Package, Users, ShoppingCart, DollarSign, AlertTriangle, RotateCcw, ArrowRight, FileText } from 'lucide-react';
import { StockFilter } from '../hooks/useProducts';
import { productService, customerService, salesService, variantService } from '../services';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalProducts: number;
  totalCustomers: number;
  todaySales: number;
  todayRevenue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  pendingReturns: number;
}

interface DashboardProps {
  onNavigate?: (view: string) => void;
  onFilterNavigate?: (filter: StockFilter) => void;
}

// ── Sparkline SVG ─────────────────────────────────────────
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

// ── Revenue SVG chart ─────────────────────────────────────
function RevenueChart({ data, period, onPeriod }: { data: { name: string; revenue: number; cost: number }[]; period: string; onPeriod: (p: string) => void }) {
  const W = 720, H = 220, PL = 52, PR = 12, PT = 14, PB = 28;
  const iw = W - PL - PR, ih = H - PT - PB;

  if (!data.length) return (
    <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No chart data yet.</div>
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
  const fmtLKR = (v: number) => `LKR ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toLocaleString()}`;
  const fmtFull = (v: number) => `LKR ${Math.round(v).toLocaleString()}`;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Revenue &amp; Cost</h3>
          <div className="sub" style={{ marginTop: 2 }}>Sales performance over time</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['7D', '30D', '90D'].map(r => (
            <button key={r} onClick={() => onPeriod(r)} className="btn btn-sm" style={{
              background: r === period ? 'var(--accent-soft)' : 'transparent',
              borderColor: r === period ? 'transparent' : 'var(--line)',
              color: r === period ? 'var(--accent-ink)' : 'var(--ink-2)',
              fontWeight: r === period ? 600 : 500,
            }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px 6px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <StatBlock label="Total Revenue" value={fmtFull(totalRev)} positive />
        <StatBlock label="Total Cost" value={fmtFull(totalCost)} positive={false} />
        <StatBlock label="Gross Margin" value={margin.toFixed(1) + '%'} positive={margin > 30} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, paddingBottom: 4 }}>
          <LegendDot color="var(--accent)" label="Revenue" />
          <LegendDot color="#C68A2E" label="Cost" />
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
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)}
                stroke="var(--line-2)" strokeDasharray={i ? '2 4' : ''} />
              <text x={PL - 6} y={y(t) + 3} fontSize="10" textAnchor="end"
                fill="var(--faint)" fontFamily="'JetBrains Mono',monospace">{fmtLKR(t)}</text>
            </g>
          ))}

          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={H - 8} fontSize="10" textAnchor="middle" fill="var(--faint)">{l.label}</text>
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

function StatBlock({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{value}</div>
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

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, sub, spark, positive = true, tone = 'default' }: {
  label: string; value: string; sub: string;
  spark?: number[]; positive?: boolean; tone?: 'default' | 'warn' | 'danger';
}) {
  const chipClass = tone === 'warn' ? 'chip-warn' : tone === 'danger' ? 'chip-neg' : positive ? 'chip-pos' : 'chip-neg';
  const sparkColor = tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : positive ? 'var(--accent)' : 'var(--danger)';
  const Arrow = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
        <span className={`chip ${chipClass}`} style={{ fontSize: 10.5, padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Arrow size={10} strokeWidth={2.5} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} width={64} height={26} />}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

// ── Top Sellers ───────────────────────────────────────────
function TopSellers({ items }: { items: { name: string; value: number; color: string }[] }) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-h" style={{ borderBottom: '1px solid var(--line-2)' }}>
        <div>
          <h3>Top Sellers</h3>
          <div className="sub" style={{ marginTop: 2 }}>by units sold</div>
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
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{it.value} units sold</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 60 }}>
              <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{it.value}</div>
              <div style={{ marginTop: 6, height: 3, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden', width: 60 }}>
                <div style={{ width: ((it.value / maxVal) * 100) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
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
          return (
            <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--line-2)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: isWalkin ? 'rgba(20,22,26,0.06)' : 'var(--accent-soft)', color: isWalkin ? 'var(--muted)' : 'var(--accent-ink)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  <span className="num" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>#{sale.sale_number?.slice(-8)}</span>
                  <span style={{ color: 'var(--faint)' }}>·</span>
                  <span style={{ textTransform: 'capitalize' }}>{sale.payment_method || 'cash'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                  LKR {Number(sale.total_amount).toLocaleString()}
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
      <div className="card-h" style={{ borderBottom: 'none' }}>
        <div>
          <h3>Stock Alerts</h3>
          <div className="sub" style={{ marginTop: 2 }}>{lowItems.length + outItems.length} items need attention</div>
        </div>
        <button onClick={() => onNavigate(tab === 'low' ? 'low_stock' : 'out_of_stock')} className="btn btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          View all <ArrowRight size={12} />
        </button>
      </div>

      {/* Underline tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 14px', borderBottom: '1px solid var(--line-2)' }}>
        {tabs.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 12px 10px', border: 0, background: 'transparent', cursor: 'default',
              borderBottom: isActive ? '2px solid var(--ink)' : '2px solid transparent',
              marginBottom: -1,
              color: isActive ? 'var(--ink)' : 'var(--muted)',
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
            {tab === 'variants' ? 'All variants are well stocked.' : 'No items in this category.'}
          </div>
        ) : list.slice(0, 8).map((it: any, i: number) => {
          const isVariant = tab === 'variants';
          const stock = isVariant ? it.total_stock : it.total_stock;
          const reorder = isVariant ? (it.reorder_level || 5) : 5;
          const pct = Math.min(100, (stock / Math.max(reorder, stock)) * 100);
          const isOut = tab === 'out';

          return (
            <div key={i} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i === Math.min(list.length, 8) - 1 ? 'none' : '1px solid var(--line-2)', cursor: 'pointer' }}
              onClick={() => onNavigate(tab === 'low' ? 'low_stock' : 'out_of_stock')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isVariant ? it.sku : it.name}
                </div>
                {isVariant && (it.color || it.size) && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {[it.color, it.size].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ width: 90, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, alignItems: 'baseline' }}>
                  <span className="num" style={{ color: isOut ? 'var(--danger)' : 'var(--warn)', fontWeight: 600, fontSize: 12 }}>{stock}</span>
                  <span className="num" style={{ color: 'var(--faint)' }}>/ {reorder} min</span>
                </div>
                <div style={{ height: 3, background: 'var(--line-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: isOut ? 'var(--danger)' : 'var(--warn)', borderRadius: 2 }} />
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

  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0, totalCustomers: 0, todaySales: 0,
    todayRevenue: 0, lowStockProducts: 0, outOfStockProducts: 0, pendingReturns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<{ name: string; revenue: number; cost: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState('30D');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [variantLowStockItems, setVariantLowStockItems] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<{ name: string; value: number; color: string }[]>([]);

  const COLORS = ['#1B6B4F', '#3340A6', '#7A2A56', '#C68A2E', '#3A4E6B'];

  useEffect(() => {
    const days = chartPeriod === '7D' ? 7 : chartPeriod === '90D' ? 90 : 30;
    load(days);
  }, [chartPeriod]);

  async function load(days: number) {
    try {
      const [allProducts, customerCount, todaySalesData, pendingCount, recentSalesData, historyData, topSellingData, variantLowStock] = await Promise.all([
        productService.getAllProducts(),
        customerService.getCustomerCount(),
        salesService.getTodaySales(),
        salesService.getPendingReturnsCount(),
        salesService.getRecentSales(8),
        salesService.getSalesHistoryWithCost(days),
        salesService.getTopSellingItems(5),
        variantService.getLowStockVariants(),
      ]);

      const lowList = allProducts.filter(p => p.total_stock > 0 && p.total_stock <= 5);
      const outList = allProducts.filter(p => p.total_stock === 0);

      const chartData = (historyData || []).map((day: any) => ({
        name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(day.revenue),
        cost: Math.round(day.cost),
      }));

      const sellers = (topSellingData as any[]).map((item, idx) => ({
        name: item.name,
        value: item.value,
        color: COLORS[idx % COLORS.length],
      }));

      setSalesData(chartData);
      setRecentSales(recentSalesData || []);
      setLowStockItems(lowList);
      setOutOfStockItems(outList);
      setVariantLowStockItems(variantLowStock || []);
      setTopSellers(sellers);
      setStats({
        totalProducts: allProducts.length,
        totalCustomers: customerCount || 0,
        todaySales: todaySalesData.count,
        todayRevenue: todaySalesData.revenue,
        lowStockProducts: lowList.length,
        outOfStockProducts: outList.length,
        pendingReturns: pendingCount || 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Generate decorative sparkline from salesData (last N days revenue)
  const spark = (scale = 1) => salesData.slice(-10).map(d => d.revenue * scale || Math.random() * 100);

  const fmtLKR = (v: number) => `LKR ${Math.round(v).toLocaleString()}`;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Store</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Open</span>
          </div>
          <div style={{ width: 1, height: 14, background: 'var(--line)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pending returns</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 500, color: stats.pendingReturns > 0 ? 'var(--warn)' : 'var(--ink)' }}>{stats.pendingReturns}</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--gap)' }}>
        <KPICard label="Today's Revenue" value={fmtLKR(stats.todayRevenue)} sub="Gross income today" spark={spark()} positive />
        <KPICard label="Today's Sales" value={stats.todaySales.toLocaleString()} sub="Invoices created" spark={spark(0.8)} positive />
        <KPICard label="Total Products" value={stats.totalProducts.toLocaleString()} sub="Active SKUs in inventory" spark={spark(0.5)} positive />
        <KPICard label="Total Customers" value={stats.totalCustomers.toLocaleString()} sub="Customer profiles" spark={spark(0.6)} positive />
        <KPICard label="Low Stock" value={stats.lowStockProducts.toLocaleString()} sub="Items below reorder level" tone="warn" />
        <KPICard label="Out of Stock" value={stats.outOfStockProducts.toLocaleString()} sub="Needs immediate restock" tone="danger" />
      </div>

      {/* Chart + Top sellers */}
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
        <StockAlerts
          lowItems={lowStockItems}
          outItems={outOfStockItems}
          variantItems={variantLowStockItems}
          onNavigate={(filter) => onFilterNavigate?.(filter)}
        />
      </div>

    </div>
  );
}
