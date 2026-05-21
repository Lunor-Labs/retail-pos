import { useEffect, useState } from 'react';
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, AlertTriangle, FileText, RotateCcw, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StockFilter } from '../hooks/useProducts';
import { productService, customerService, salesService } from '../services';

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
  const [activeStockTab, setActiveStockTab] = useState<'low' | 'out'>('low');
  const [topSellingItems, setTopSellingItems] = useState<any[]>([]);

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
        topSellingData
      ] = await Promise.all([
        productService.getAllProducts(),
        customerService.getCustomerCount(),
        salesService.getTodaySales(),
        salesService.getPendingReturnsCount(),
        salesService.getRecentSales(5),
        salesService.getSalesHistoryWithCost(days),
        salesService.getTopSellingItems(20)
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
      setTopSellingItems(topSellingWithColors);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-slate-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <span className="text-sm font-medium text-slate-600">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats Grid - 7 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => card.filter && onFilterNavigate?.(card.filter)}
              className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center lg:items-start lg:text-left hover:shadow-md transition-shadow group ${card.filter ? 'cursor-pointer' : ''}`}
            >
              <div className={`${card.bgColor} p-3 rounded-xl mb-3 lg:mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <h3 className="text-xl lg:text-2xl font-bold text-slate-900 mb-1">{card.value}</h3>
              <p className="text-sm font-medium text-slate-700">{card.title}</p>
              <p className="text-xs text-slate-400 mt-1">{card.subtext}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate?.('pos')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all group text-left"
        >
          <div className="bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
          </div>
          <p className="font-semibold text-slate-900">New Sale</p>
          <p className="text-xs text-slate-500 mt-1">Process transaction</p>
        </button>

        <button
          onClick={() => onNavigate?.('products')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all group text-left"
        >
          <div className="bg-emerald-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
            <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="font-semibold text-slate-900">Add Product</p>
          <p className="text-xs text-slate-500 mt-1">Update inventory</p>
        </button>

        <button
          onClick={() => onNavigate?.('customers')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-violet-500 hover:shadow-md transition-all group text-left"
        >
          <div className="bg-violet-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-violet-100 transition-colors">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <p className="font-semibold text-slate-900">Add Customer</p>
          <p className="text-xs text-slate-500 mt-1">Create profile</p>
        </button>

        <button
          onClick={() => onNavigate?.('reports')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-orange-500 hover:shadow-md transition-all group text-left"
        >
          <div className="bg-orange-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-orange-100 transition-colors">
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <p className="font-semibold text-slate-900">View Reports</p>
          <p className="text-xs text-slate-500 mt-1">Check analytics</p>
        </button>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expense Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Revenue vs Expense</h3>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-block w-3 h-1 rounded-full bg-emerald-500"></span>Revenue
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="inline-block w-3 h-1 rounded-full bg-orange-400"></span>Cost (COGS)
                </span>
              </div>
            </div>
            <select
              value={chartPeriod}
              onChange={e => setChartPeriod(e.target.value as '30' | '7')}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none focus:border-blue-500 transition-colors"
            >
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData.length > 0 ? salesData : [{ name: 'No Data', revenue: 0, cost: 0 }]}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={70}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  formatter={(value: any, name: string | undefined) => [
                    `LKR ${Number(value).toLocaleString()}`,
                    name === 'revenue' ? 'Revenue' : 'Cost (COGS)',
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="cost" stroke="#F97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Items Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Top Selling Items</h3>
            <button className="text-slate-400 hover:text-slate-600">
              <TrendingUp className="w-5 h-5" />
            </button>
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
                <span className="text-2xl font-bold text-slate-900">{topSellingItems[0].value}</span>
                <span className="text-xs text-slate-500">Units Sold</span>
              </div>
            )}
          </div>
          <div className="space-y-3 mt-6 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
            {topSellingItems.map((item) => (
              <div key={item.name} className="flex items-center gap-3 group">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className="text-sm text-slate-600 flex-1 min-w-0 leading-snug"
                  title={item.name}
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.name}
                </span>
                <span className="text-sm font-bold text-slate-900 flex-shrink-0 ml-auto pl-2">{item.value}</span>
              </div>
            ))}
            {topSellingItems.length === 0 && (
              <p className="text-center text-slate-500 py-4 text-sm">No sales data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Recent Invoices</h3>
            <button
              onClick={() => onNavigate?.('sales-history')}
              className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            <div className="space-y-4">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-3 hover:bg-slate-50 rounded-xl px-3 -mx-3 transition-all group border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">#{sale.sale_number.slice(-8)}</p>
                      <p className="text-xs text-slate-500 font-medium">{sale.customers?.name || 'Walk-in Customer'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</p>
                      <p className="text-sm font-bold text-slate-900">LKR {Number(sale.total_amount).toLocaleString()}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      sale.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                      {sale.status === 'completed' ? 'Paid' : sale.status === 'partial' ? 'Partial' : 'Credit'}
                    </span>
                  </div>
                </div>
              ))}
              {recentSales.length === 0 && (
                <div className="text-center py-8">
                  <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm">No recent sales found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stock Alert */}
        {/* Stock Alert */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">Stock Alert</h3>
              {stats.lowStockProducts + stats.outOfStockProducts > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {stats.lowStockProducts + stats.outOfStockProducts}
                </span>
              )}
            </div>
            <button
              onClick={() => onFilterNavigate?.(activeStockTab === 'low' ? 'low_stock' : 'out_of_stock')}
              className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
            <button
              onClick={() => setActiveStockTab('low')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeStockTab === 'low'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Low Stock ({stats.lowStockProducts})
            </button>
            <button
              onClick={() => setActiveStockTab('out')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeStockTab === 'out'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              Out of Stock ({stats.outOfStockProducts})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider pb-3 border-b border-slate-100 mb-2 sticky top-0 bg-white z-10">
              <span>Product Name</span>
              <span>Available</span>
            </div>

            <div className="space-y-2">
              {activeStockTab === 'low' ? (
                <>
                  {lowStockItems.slice(0, 10).map((item, index) => (
                    <div key={index}
                      onClick={() => onFilterNavigate?.('low_stock')}
                      className="flex items-center justify-between py-2.5 px-3 -mx-3 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">{item.total_stock}</span>
                    </div>
                  ))}
                  {lowStockItems.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-400 text-sm">No low stock items</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {outOfStockItems.slice(0, 10).map((item, index) => (
                    <div key={index}
                      onClick={() => onFilterNavigate?.('out_of_stock')}
                      className="flex items-center justify-between py-2.5 px-3 -mx-3 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">0</span>
                    </div>
                  ))}
                  {outOfStockItems.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-slate-400 text-sm">No out of stock items</p>
                    </div>
                  )}
                </>
              )}
            </div>
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
