import { useState, useEffect, useCallback } from 'react';
import { Download, Star, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './ui';

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmtLKR(n: number) { return 'LKR ' + Math.round(n).toLocaleString('en-US'); }
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return Math.round(n).toString();
}

const CHART_COLORS = ['var(--accent)', '#C68A2E', '#3A4E6B', '#7A2235', '#6A7048', '#5C6675', '#8A9078'];

type RangeId = 'today' | 'week' | 'month' | 'quarter' | 'ytd' | 'custom';

const todayStr = new Date().toISOString().split('T')[0];

function getRange(id: RangeId, customStart: string, customEnd: string) {
  const d = new Date();
  let start = todayStr, end = todayStr;

  if (id === 'today') { start = end = todayStr; }
  else if (id === 'week') {
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
    const mon = new Date(d); mon.setDate(d.getDate() - dow);
    start = mon.toISOString().split('T')[0]; end = todayStr;
  } else if (id === 'month') {
    start = todayStr.slice(0, 7) + '-01'; end = todayStr;
  } else if (id === 'quarter') {
    const qm = Math.floor(d.getMonth() / 3) * 3;
    start = new Date(d.getFullYear(), qm, 1).toISOString().split('T')[0]; end = todayStr;
  } else if (id === 'ytd') {
    start = d.getFullYear() + '-01-01'; end = todayStr;
  } else {
    start = customStart; end = customEnd;
  }

  // Previous period: same length ending day before start
  const days = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
  const prevEnd = new Date(new Date(start).getTime() - 86400000).toISOString().split('T')[0];
  const prevStart = new Date(new Date(prevEnd).getTime() - (days - 1) * 86400000).toISOString().split('T')[0];

  return { start, end, prevStart, prevEnd, isToday: id === 'today', days };
}

// ─── Trend chart (daily bars or hourly) ──────────────────────────────────
function TrendChart({ buckets, isHourly }: {
  buckets: { label: string; revenue: number; count: number }[];
  isHourly: boolean;
}) {
  const max = Math.max(...buckets.map(b => b.revenue), 1);
  const peakIdx = buckets.reduce((pi, b, i) => b.revenue > buckets[pi].revenue ? i : pi, 0);
  const total = buckets.reduce((s, b) => s + b.revenue, 0);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
            {isHourly ? 'Sales by hour' : 'Sales by day'}
          </h3>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
            Peak: <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{buckets[peakIdx]?.label}</span>
            {' · '}Total: <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>LKR {fmtK(total)}</span>
          </div>
        </div>
        <BarChart2 size={16} style={{ color: 'var(--faint)' }} strokeWidth={1.6} />
      </div>
      <div style={{ padding: '18px 18px 14px' }}>
        <div style={{ display: 'flex', gap: buckets.length > 14 ? 3 : 6, alignItems: 'flex-end', height: 130 }}>
          {buckets.map((b, i) => {
            const h = Math.max(2, (b.revenue / max) * 118);
            const isPeak = i === peakIdx;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {isPeak && (
                  <div style={{ fontSize: 9.5, color: 'var(--accent-ink)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {fmtK(b.revenue)}
                  </div>
                )}
                {!isPeak && <div style={{ height: 16 }} />}
                <div style={{
                  width: '100%', height: h + 'px',
                  background: isPeak ? 'var(--accent)' : 'color-mix(in oklab, var(--accent) 22%, var(--panel-2))',
                  borderRadius: '3px 3px 0 0',
                }} />
                {buckets.length <= 20 && (
                  <div style={{ fontSize: 9.5, color: isPeak ? 'var(--ink-2)' : 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", fontWeight: isPeak ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {b.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Donut chart (category) ───────────────────────────────────────────────
function DonutChart({ data, title, subtitle }: {
  data: { label: string; value: number; pct: number }[];
  title: string;
  subtitle: string;
}) {
  const r = 58, cx = 80, cy = 80;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{subtitle}</div>
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No data for this period</div>
      ) : (
        <div style={{ padding: '18px', display: 'flex', gap: 18, alignItems: 'center' }}>
          <div style={{ position: 'relative', flexShrink: 0, width: 160, height: 160 }}>
            <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
              {data.map((d, i) => {
                const len = (d.pct / 100) * C;
                const seg = (
                  <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                    stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="20"
                    strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
                );
                offset += len;
                return seg;
              })}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Total</div>
              <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>LKR {fmtK(total)}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.slice(0, 6).map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</span>
                <span className="num" style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtK(d.value)}</span>
                <span className="num" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', width: 38, textAlign: 'right' }}>{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payment mix ──────────────────────────────────────────────────────────
function PaymentMix({ data }: { data: { method: string; count: number; revenue: number; pct: number }[] }) {
  const colors = ['var(--accent)', '#C68A2E', '#3A4E6B', '#7A2235'];
  const totalTxns = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line-2)' }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Payment methods</h3>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{totalTxns.toLocaleString()} transactions</div>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No data</div>
      ) : (
        <>
          <div style={{ padding: '14px 18px 0' }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
              {data.map((d, i) => (
                <div key={i} style={{ width: d.pct + '%', background: colors[i % colors.length], transition: 'width .3s' }} />
              ))}
            </div>
          </div>
          <div>
            {data.map((d, i) => (
              <div key={i} style={{
                padding: '11px 18px', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto',
                alignItems: 'center', gap: 12, borderTop: '1px solid var(--line-2)',
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, textTransform: 'capitalize' }}>{d.method}</span>
                <span className="num" style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{d.count} txns</span>
                <span className="num" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtLKR(d.revenue)}</span>
                <span className="num" style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600, width: 42, textAlign: 'right' }}>{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Top products table ───────────────────────────────────────────────────
function TopProducts({ data }: { data: { name: string; sku: string; units: number; revenue: number; margin: number }[] }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Top products</h3>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>by revenue · selected period</div>
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No product sales in this period</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 56px 110px 60px', padding: '9px 18px', gap: 10, fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--line-2)', background: 'var(--panel-2)' }}>
            <span>#</span><span>Product</span>
            <span style={{ textAlign: 'right' }}>Units</span>
            <span style={{ textAlign: 'right' }}>Revenue</span>
            <span style={{ textAlign: 'right' }}>Margin</span>
          </div>
          {data.slice(0, 8).map((p, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 56px 110px 60px',
              padding: '11px 18px', gap: 10, alignItems: 'center',
              borderBottom: i < Math.min(data.length, 8) - 1 ? '1px solid var(--line-2)' : 'none',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 5, display: 'grid', placeItems: 'center',
                background: i < 3 ? 'var(--accent-soft)' : 'rgba(20,22,26,0.04)',
                color: i < 3 ? 'var(--accent-ink)' : 'var(--muted)',
                fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              }}>{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{p.sku}</div>
              </div>
              <span className="num" style={{ fontSize: 12.5, textAlign: 'right', color: 'var(--ink-2)' }}>{p.units}</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{fmtLKR(p.revenue)}</span>
              <span className="num" style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 500, color: p.margin >= 30 ? 'var(--pos)' : 'var(--ink-2)' }}>
                {p.margin > 0 ? p.margin.toFixed(1) + '%' : '—'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Dimension table (category / brand) ──────────────────────────────────
function DimensionTable({ title, data }: { title: string; data: { label: string; units: number; revenue: number }[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--line-2)' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</h3>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>No data for this period</div>
      ) : (
        <div>
          {data.map((row, i) => (
            <div key={i} style={{
              padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: i < data.length - 1 ? '1px solid var(--line-2)' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{row.label}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>LKR {fmtK(row.revenue)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--panel-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: ((row.revenue / max) * 100) + '%', background: 'var(--accent)', borderRadius: 2, transition: 'width .3s' }} />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{row.units} units sold</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
interface KpiData { sales: number; revenue: number; profit: number; avgOrder: number; }

export function Reports() {
  const [rangeId, setRangeId] = useState<RangeId>('month');
  const [customStart, setCustomStart] = useState(todayStr.slice(0, 7) + '-01');
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  const [kpi, setKpi] = useState<KpiData>({ sales: 0, revenue: 0, profit: 0, avgOrder: 0 });
  const [prevKpi, setPrevKpi] = useState<KpiData>({ sales: 0, revenue: 0, profit: 0, avgOrder: 0 });
  const [trend, setTrend] = useState<{ label: string; revenue: number; count: number }[]>([]);
  const [isHourly, setIsHourly] = useState(false);
  const [categoryData, setCategoryData] = useState<{ label: string; value: number; pct: number }[]>([]);
  const [brandData, setBrandData] = useState<{ label: string; units: number; revenue: number }[]>([]);
  const [paymentData, setPaymentData] = useState<{ method: string; count: number; revenue: number; pct: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; sku: string; units: number; revenue: number; margin: number }[]>([]);
  const [loyalty, setLoyalty] = useState({ earned: 0, redeemed: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end, prevStart, prevEnd, isToday } = getRange(rangeId, customStart, customEnd);
      setIsHourly(isToday);

      const [salesRes, prevSalesRes, itemsRes, loyaltyRes] = await Promise.all([
        supabase.from('sales')
          .select('total_amount, payment_method, sale_date, sale_items(quantity, unit_price, cost_price)')
          .gte('sale_date', `${start}T00:00:00`)
          .lte('sale_date', `${end}T23:59:59`),
        supabase.from('sales')
          .select('total_amount')
          .gte('sale_date', `${prevStart}T00:00:00`)
          .lte('sale_date', `${prevEnd}T23:59:59`),
        (supabase.from('sale_items') as any)
          .select('quantity, unit_price, cost_price, is_manual, products(name, sku, category, brand), sales!inner(sale_date)')
          .gte('sales.sale_date', `${start}T00:00:00`)
          .lte('sales.sale_date', `${end}T23:59:59`)
          .not('product_id', 'is', null),
        (supabase.from('loyalty_transactions') as any)
          .select('type, points')
          .gte('created_at', `${start}T00:00:00`)
          .lte('created_at', `${end}T23:59:59`),
      ]);

      const sales = (salesRes.data ?? []) as any[];
      const prevSales = (prevSalesRes.data ?? []) as any[];
      const items = (itemsRes.data ?? []) as any[];
      const loyaltyTxns = (loyaltyRes.data ?? []) as any[];

      // ── KPIs ──
      let revenue = 0, profit = 0;
      sales.forEach(s => {
        revenue += Number(s.total_amount);
        (s.sale_items ?? []).forEach((it: any) => {
          profit += (Number(it.unit_price) - Number(it.cost_price ?? 0)) * Number(it.quantity);
        });
      });
      const prevRevenue = prevSales.reduce((sum: number, s: any) => sum + Number(s.total_amount), 0);
      setKpi({ sales: sales.length, revenue, profit, avgOrder: sales.length ? revenue / sales.length : 0 });
      setPrevKpi({ sales: prevSales.length, revenue: prevRevenue, profit: 0, avgOrder: prevSales.length ? prevRevenue / prevSales.length : 0 });

      // ── Trend (hourly or daily) ──
      if (isToday) {
        const buckets = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), revenue: 0, count: 0 }));
        sales.forEach(s => {
          const h = new Date(s.sale_date).getHours();
          buckets[h].revenue += Number(s.total_amount);
          buckets[h].count++;
        });
        setTrend(buckets.filter((_, h) => h >= 7 && h <= 22));
      } else {
        const dayMap: Record<string, { revenue: number; count: number }> = {};
        sales.forEach(s => {
          const d = s.sale_date.split('T')[0];
          if (!dayMap[d]) dayMap[d] = { revenue: 0, count: 0 };
          dayMap[d].revenue += Number(s.total_amount);
          dayMap[d].count++;
        });
        // Fill all days in range
        const buckets: { label: string; revenue: number; count: number }[] = [];
        const cur = new Date(start);
        const endDate = new Date(end);
        while (cur <= endDate) {
          const k = cur.toISOString().split('T')[0];
          buckets.push({ label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), ...(dayMap[k] ?? { revenue: 0, count: 0 }) });
          cur.setDate(cur.getDate() + 1);
        }
        setTrend(buckets);
      }

      // ── Category / Brand / Top products ──
      const catMap: Record<string, { units: number; revenue: number; cost: number }> = {};
      const brandMap: Record<string, { units: number; revenue: number }> = {};
      const prodMap: Record<string, { name: string; sku: string; units: number; revenue: number; cost: number }> = {};

      items.forEach((it: any) => {
        const cat = it.products?.category ?? 'Unknown';
        const brand = it.products?.brand ?? 'Unknown';
        const name = it.products?.name ?? 'Unknown';
        const sku = it.products?.sku ?? '';
        const qty = Number(it.quantity);
        const rev = Number(it.unit_price) * qty;
        const cost = Number(it.cost_price ?? 0) * qty;

        if (!catMap[cat]) catMap[cat] = { units: 0, revenue: 0, cost: 0 };
        catMap[cat].units += qty; catMap[cat].revenue += rev; catMap[cat].cost += cost;

        if (!brandMap[brand]) brandMap[brand] = { units: 0, revenue: 0 };
        brandMap[brand].units += qty; brandMap[brand].revenue += rev;

        const prodKey = sku || name;
        if (!prodMap[prodKey]) prodMap[prodKey] = { name, sku, units: 0, revenue: 0, cost: 0 };
        prodMap[prodKey].units += qty; prodMap[prodKey].revenue += rev; prodMap[prodKey].cost += cost;
      });

      const catArr = Object.entries(catMap)
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.revenue - a.revenue);
      const catTotal = catArr.reduce((s, c) => s + c.revenue, 0);
      setCategoryData(catArr.map(c => ({ label: c.label, value: c.revenue, pct: catTotal > 0 ? (c.revenue / catTotal) * 100 : 0 })));

      setBrandData(Object.entries(brandMap)
        .map(([label, v]) => ({ label, ...v }))
        .sort((a, b) => b.revenue - a.revenue));

      setTopProducts(Object.values(prodMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map(p => ({ ...p, margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 })));

      // ── Payment mix ──
      const payMap: Record<string, { count: number; revenue: number }> = {};
      sales.forEach(s => {
        const m = s.payment_method ?? 'unknown';
        if (!payMap[m]) payMap[m] = { count: 0, revenue: 0 };
        payMap[m].count++;
        payMap[m].revenue += Number(s.total_amount);
      });
      const payTotal = Object.values(payMap).reduce((s, v) => s + v.revenue, 0);
      setPaymentData(Object.entries(payMap)
        .map(([method, v]) => ({ method, ...v, pct: payTotal > 0 ? (v.revenue / payTotal) * 100 : 0 }))
        .sort((a, b) => b.revenue - a.revenue));

      // ── Loyalty ──
      let earned = 0, redeemed = 0;
      loyaltyTxns.forEach((tx: any) => {
        if (tx.type === 'earn') earned += Number(tx.points);
        else if (tx.type === 'redeem') redeemed += Number(tx.points);
      });
      setLoyalty({ earned, redeemed });

    } catch (e) {
      console.error('Reports load error', e);
    } finally {
      setLoading(false);
    }
  }, [rangeId, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  function delta(cur: number, prev: number) {
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }

  function DeltaChip({ cur, prev }: { cur: number; prev: number }) {
    const d = delta(cur, prev);
    if (d === null) return null;
    const pos = d >= 0;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px',
        borderRadius: 999, fontSize: 10.5, fontWeight: 600,
        background: pos ? 'var(--accent-soft)' : 'color-mix(in oklab, var(--danger) 10%, var(--panel-2))',
        color: pos ? 'var(--accent-ink)' : 'var(--danger)',
      }}>
        {d >= 0 ? '+' : ''}{d.toFixed(1)}%
      </span>
    );
  }

  const rangeOpts: { id: RangeId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'quarter', label: 'This quarter' },
    { id: 'ytd', label: 'YTD' },
    { id: 'custom', label: 'Custom…' },
  ];

  const { start, end } = getRange(rangeId, customStart, customEnd);

  return (
    <div className="sh-outer" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ padding: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Reports & Analytics</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
              Performance from{' '}
              <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                {new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {start !== end && ` – ${new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} strokeWidth={1.7} /> Export
            </button>
          </div>
        </div>

        {/* Range selector */}
        <div className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, flexWrap: 'wrap' }}>
            {rangeOpts.map(o => {
              const isA = o.id === rangeId;
              return (
                <button key={o.id} onClick={() => { setRangeId(o.id); setShowCustom(o.id === 'custom'); }} style={{
                  padding: '5px 11px', borderRadius: 6, border: 0, cursor: 'pointer',
                  background: isA ? 'var(--panel)' : 'transparent',
                  color: isA ? 'var(--ink)' : 'var(--muted)',
                  fontSize: 12, fontWeight: isA ? 600 : 500,
                  boxShadow: isA ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}>{o.label}</button>
              );
            })}
          </div>
          {showCustom && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>From</span>
                <input type="date" value={customStart} max={customEnd}
                  onChange={e => setCustomStart(e.target.value)}
                  style={{ height: 30, padding: '0 9px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 12, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>To</span>
                <input type="date" value={customEnd} min={customStart} max={todayStr}
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{ height: 30, padding: '0 9px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--ink)', fontSize: 12, outline: 'none' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading analytics…" />
      ) : (
        <>
          {/* KPI row */}
          <div className="rpt-kpi">
            {[
              { label: 'Total Sales', value: kpi.sales.toLocaleString('en-US'), cur: kpi.sales, prev: prevKpi.sales, fmt: false },
              { label: 'Revenue', value: fmtLKR(kpi.revenue), cur: kpi.revenue, prev: prevKpi.revenue, fmt: true },
              { label: 'Gross Profit', value: fmtLKR(kpi.profit), cur: kpi.profit, prev: prevKpi.profit, fmt: true },
              { label: 'Avg Order Value', value: fmtLKR(kpi.avgOrder), cur: kpi.avgOrder, prev: prevKpi.avgOrder, fmt: true },
              { label: 'Profit Margin', value: kpi.revenue > 0 ? ((kpi.profit / kpi.revenue) * 100).toFixed(1) + '%' : '—', cur: kpi.profit / Math.max(kpi.revenue, 1), prev: prevKpi.profit / Math.max(prevKpi.revenue, 1), fmt: false },
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{k.label}</span>
                <div className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--ink)' }}>{k.value}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DeltaChip cur={k.cur} prev={k.prev} />
                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>vs prev period</span>
                </div>
              </div>
            ))}
          </div>

          {/* Trend + Category */}
          <div className="dash-grid">
            {trend.length > 0 && <TrendChart buckets={trend} isHourly={isHourly} />}
            <DonutChart
              data={categoryData}
              title="Sales by category"
              subtitle={`${categoryData.length} categories · selected period`}
            />
          </div>

          {/* Payment mix + Top products */}
          <div className="dash-grid">
            <PaymentMix data={paymentData} />
            <TopProducts data={topProducts} />
          </div>

          {/* Brand + Loyalty */}
          <div className="dash-grid">
            <DimensionTable title="Sales by brand" data={brandData} />

            {/* Loyalty summary */}
            <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={15} style={{ color: 'var(--warn)', fill: 'var(--warn)' }} />
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Loyalty points</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Earned', value: loyalty.earned.toLocaleString('en-US'), color: 'var(--accent-ink)' },
                  { label: 'Redeemed', value: loyalty.redeemed.toLocaleString('en-US'), color: 'var(--warn)' },
                  { label: 'Net balance', value: (loyalty.earned - loyalty.redeemed).toLocaleString('en-US'), color: 'var(--ink)' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 8, background: 'var(--panel-2)' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4 }}>pts</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
