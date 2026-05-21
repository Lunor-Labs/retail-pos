import { useEffect, useState } from 'react';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, AlertTriangle, FileText, RotateCcw, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StockFilter } from '../hooks/useProducts';
import { productService, customerService, salesService, variantService } from '../services';

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

export function Dashboard({ onNavigate, onFilterNavigate }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCustomers: 0,
    todaySales: 0,
    todayRevenue: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    pendingReturns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<{ name: string; revenue: number; cost: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'30' | '7'>('30');
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [variantLowStockItems, setVariantLowStockItems] = useState<any[]>([]);
  const [activeStockTab, setActiveStockTab] = useState<'low' | 'out' | 'variants'>('low');
  const [topSellingItems, setTopSellingItems] = useState<any[]>([]);
  const [todayTopSellers, setTodayTopSellers] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    loadDashboardStats(Number(chartPeriod));
  }, [chartPeriod]);

  async function loadDashboardStats(days = 30) {
    try {
      const [
        allProducts,
        customerCount,
        todaySales,
        pendingReturnsCount,
        recentSalesData,
        salesHistoryWithCost,
        topSellingData,
        variantLowStock,
        todayTop
      ] = await Promise.all([
        productService.getAllProducts(),
        customerService.getCustomerCount(),
        salesService.getTodaySales(),
        salesService.getPendingReturnsCount(),
        salesService.getRecentSales(5),
        salesService.getSalesHistoryWithCost(days),
        salesService.getTopSellingItems(20),
        variantService.getLowStockVariants(),
        salesService.getTopSellingToday(5),
      ]);

      const lowStockList = allProducts.filter(product => {
        return product.total_stock > 0 && product.total_stock <= 5;
      });

      const outOfStockList = allProducts.filter(product => {
        return product.total_stock === 0;
      });

      // Process chart data — already grouped by day from service
      const chartData = (salesHistoryWithCost || []).map(day => ({
        name: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(day.revenue),
        cost: Math.round(day.cost),
      }));

      // Top selling items are already processed by the service
      const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'];
      const topSellingWithColors = (topSellingData as any[]).map((item, index) => ({
        ...item,
        color: colors[index % colors.length]
      }));

      setSalesData(chartData);
      setRecentSales(recentSalesData || []);
      setLowStockItems(lowStockList);
      setOutOfStockItems(outOfStockList);
      setVariantLowStockItems(variantLowStock || []);
      setTopSellingItems(topSellingWithColors);
      setTodayTopSellers(todayTop || []);

      setStats({
        totalProducts: allProducts.length,
        totalCustomers: customerCount || 0,
        todaySales: todaySales.count,
        todayRevenue: todaySales.revenue,
        lowStockProducts: lowStockList.length,
        outOfStockProducts: outOfStockList.length,
        pendingReturns: pendingReturnsCount || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts.toLocaleString(),
      subtext: 'Total Items',
      icon: Package,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toLocaleString(),
      subtext: 'Active Profiles',
      icon: Users,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      title: "Today's Sales",
      value: stats.todaySales.toLocaleString(),
      subtext: 'Invoices Created',
      icon: ShoppingCart,
      iconColor: 'text-violet-500',
      bgColor: 'bg-violet-50',
    },
    {
      title: "Today's Revenue",
      value: `LKR ${stats.todayRevenue.toLocaleString()}`,
      subtext: 'Gross Income',
      icon: DollarSign,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Low Stock',
      value: stats.lowStockProducts.toLocaleString(),
      subtext: 'Items to Reorder',
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      filter: 'low_stock' as StockFilter,
    },
    {
      title: 'Stock Out',
      value: stats.outOfStockProducts.toLocaleString(),
      subtext: 'Needs Immediate Restock',
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      filter: 'out_of_stock' as StockFilter,
    },
    {
      title: 'Returns',
      value: stats.pendingReturns.toLocaleString(),
      subtext: 'Pending Process',
      icon: RotateCcw,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10" style={{ border: '2px solid var(--line)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Dashboard</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            Store overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => onNavigate?.('pos')} className="btn btn-primary" style={{ height: 36 }}>
          New Sale
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => card.filter && onFilterNavigate?.(card.filter)}
              className="card"
              style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, cursor: card.filter ? 'pointer' : 'default', transition: 'box-shadow .12s ease' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{card.title}</span>
                <div className={`${card.bgColor} p-1.5 rounded-lg`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.05 }}>
                {card.value}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 500 }}>{card.subtext}</div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { label: 'New Sale', sub: 'Process transaction', view: 'pos', Icon: ShoppingCart, color: 'var(--accent)', bg: 'var(--accent-soft)' },
          { label: 'Add Product', sub: 'Update inventory', view: 'products', Icon: Package, color: 'var(--accent)', bg: 'var(--accent-soft)' },
          { label: 'Add Customer', sub: 'Create profile', view: 'customers', Icon: Users, color: 'var(--warn)', bg: 'var(--warn-soft)' },
          { label: 'View Reports', sub: 'Check analytics', view: 'reports', Icon: TrendingUp, color: 'var(--ink-2)', bg: 'rgba(20,22,26,0.05)' },
        ].map(({ label, sub, view, Icon, color, bg }) => (
          <button
            key={view}
            onClick={() => onNavigate?.(view)}
            className="card"
            style={{ padding: '14px 16px', textAlign: 'left', border: '1px solid var(--line)', background: 'var(--panel)', cursor: 'default' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(20,22,26,0.06)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: 'grid', placeItems: 'center', marginBottom: 10, color }}>
              <Icon size={16} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expense Chart */}
        <div className="lg:col-span-2 card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Revenue vs Cost</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 999, background: 'var(--accent)' }} />Revenue
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 999, background: 'var(--warn)' }} />Cost (COGS)
                </span>
              </div>
            </div>
            <select
              value={chartPeriod}
              onChange={e => setChartPeriod(e.target.value as '30' | '7')}
              style={{ height: 28, padding: '0 8px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', fontSize: 12, color: 'var(--ink-2)', outline: 'none' }}
            >
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
            </select>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData.length > 0 ? salesData : [{ name: 'No Data', revenue: 0, cost: 0 }]}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B6B4F" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1B6B4F" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B45309" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#B45309" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7C828B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7C828B' }} axisLine={false} tickLine={false} width={60}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 4px 16px rgba(20,22,26,0.1)', fontSize: 12, background: 'var(--panel)' }}
                  formatter={(value: any, name: string | undefined) => [
                    `LKR ${Number(value).toLocaleString()}`,
                    name === 'revenue' ? 'Revenue' : 'Cost (COGS)',
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#1B6B4F" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="cost" stroke="#B45309" strokeWidth={2} strokeDasharray="4 3" fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Items Chart */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Top Selling Items</h3>
          </div>
          <div className="h-[200px] relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topSellingItems}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topSellingItems.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [
                    `${value} units`,
                    props.payload?.name,
                  ]}
                  contentStyle={{
                    border: 'none',
                    borderRadius: '10px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.12)',
                    fontSize: '12px',
                    maxWidth: '200px',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {topSellingItems.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>{topSellingItems[0].value}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Units Sold</span>
              </div>
            )}
          </div>
          <div className="custom-scrollbar" style={{ marginTop: 16, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topSellingItems.map((item) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.color }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span className="num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>{item.value}</span>
              </div>
            ))}
            {topSellingItems.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>No sales data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Today's Top Sellers */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Today's Top Sellers</h3>
        </div>
        {todayTopSellers.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>No sales recorded today yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {todayTopSellers.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 7, transition: 'background .1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="num" style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', width: 16 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{item.name}</span>
                </div>
                <span className="chip chip-pos">{item.value} sold</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lists Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {/* Recent Invoices */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Recent Invoices</h3>
            <button onClick={() => onNavigate?.('sales-history')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', fontWeight: 500, background: 'transparent', border: 0, cursor: 'default' }}>
              View All <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 360 }} className="custom-scrollbar">
            {recentSales.map((sale) => (
              <div key={sale.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', borderBottom: '1px solid var(--line-2)', transition: 'background .1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 12, fontWeight: 600 }}>
                    {(sale.customers?.name || 'W').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>#{sale.sale_number.slice(-8)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{sale.customers?.name || 'Walk-in'}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>LKR {Number(sale.total_amount).toLocaleString()}</div>
                  <span className={`chip ${sale.status === 'completed' ? 'chip-pos' : sale.status === 'partial' ? 'chip-warn' : 'chip-neutral'}`} style={{ fontSize: 10.5, marginTop: 3 }}>
                    {sale.status === 'completed' ? 'Paid' : sale.status === 'partial' ? 'Partial' : 'Credit'}
                  </span>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                <FileText size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>No recent sales found</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Alert */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Stock Alert</h3>
              {stats.lowStockProducts + stats.outOfStockProducts > 0 && (
                <span className="chip chip-neg" style={{ fontSize: 10.5 }}>{stats.lowStockProducts + stats.outOfStockProducts}</span>
              )}
            </div>
            <button onClick={() => onFilterNavigate?.(activeStockTab === 'low' ? 'low_stock' : 'out_of_stock')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent)', fontWeight: 500, background: 'transparent', border: 0, cursor: 'default' }}>
              View All <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--panel-2)', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 12 }}>
            {(['low', 'out', 'variants'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveStockTab(tab)} style={{ flex: 1, padding: '5px 0', fontSize: 11.5, fontWeight: activeStockTab === tab ? 600 : 500, borderRadius: 6, border: 0, background: activeStockTab === tab ? 'var(--panel)' : 'transparent', color: activeStockTab === tab ? 'var(--ink)' : 'var(--muted)', cursor: 'default', boxShadow: activeStockTab === tab ? '0 1px 3px rgba(20,22,26,0.08)' : 'none', transition: 'all .1s' }}>
                {tab === 'low' ? `Low (${stats.lowStockProducts})` : tab === 'out' ? `Out (${stats.outOfStockProducts})` : `Variants (${variantLowStockItems.length})`}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320 }} className="custom-scrollbar">
            {activeStockTab === 'low' ? (
              lowStockItems.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No low stock items</p>
                : lowStockItems.slice(0, 10).map((item, i) => (
                  <div key={i} onClick={() => onFilterNavigate?.('low_stock')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{item.name}</span>
                    </div>
                    <span className="chip chip-warn" style={{ fontSize: 10.5 }}>{item.total_stock}</span>
                  </div>
                ))
            ) : activeStockTab === 'out' ? (
              outOfStockItems.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No out of stock items</p>
                : outOfStockItems.slice(0, 10).map((item, i) => (
                  <div key={i} onClick={() => onFilterNavigate?.('out_of_stock')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{item.name}</span>
                    </div>
                    <span className="chip chip-neg" style={{ fontSize: 10.5 }}>0</span>
                  </div>
                ))
            ) : (
              variantLowStockItems.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>All variants are well stocked</p>
                : variantLowStockItems.slice(0, 10).map((v: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      <div>
                        <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{v.sku}</span>
                        {(v.size || v.color) && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{[v.color, v.size].filter(Boolean).join(' · ')}</span>}
                      </div>
                    </div>
                    <span className="chip chip-warn" style={{ fontSize: 10.5 }}>{v.total_stock}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <ShoppingCart className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">New Sale</p>
            <p className="text-sm text-slate-600">Process a new transaction</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <Package className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">Add Product</p>
            <p className="text-sm text-slate-600">Create new product</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <Users className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">New Customer</p>
            <p className="text-sm text-slate-600">Add customer record</p>
          </button>
          <button className="p-4 border-2 border-slate-200 rounded-lg hover:border-slate-900 hover:bg-slate-50 transition flex flex-col items-center text-center lg:items-start lg:text-left">
            <TrendingUp className="w-8 h-8 text-slate-900 mb-2" />
            <p className="font-medium text-slate-900">View Reports</p>
            <p className="text-sm text-slate-600">Analytics & insights</p>
          </button>
        </div>
      </div> */}
    </div>
  );
}
