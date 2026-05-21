import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, DollarSign, Users, Package, Calendar, Star } from 'lucide-react';

interface SalesReport {
  total_sales: number;
  total_revenue: number;
  total_profit: number;
  average_order_value: number;
}

interface CommissionReport {
  agent_id: string;
  agent_name: string;
  total_sales: number;
  total_commission: number;
  pending_commission: number;
}

interface DimensionRow {
  label: string;
  units: number;
  revenue: number;
}

export function Reports() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [salesReport, setSalesReport] = useState<SalesReport>({
    total_sales: 0,
    total_revenue: 0,
    total_profit: 0,
    average_order_value: 0,
  });
  const [commissionReports, setCommissionReports] = useState<CommissionReport[]>([]);
  const [categoryReport, setCategoryReport] = useState<DimensionRow[]>([]);
  const [brandReport, setBrandReport] = useState<DimensionRow[]>([]);
  const [genderReport, setGenderReport] = useState<DimensionRow[]>([]);
  const [loyaltySummary, setLoyaltySummary] = useState({ totalEarned: 0, totalRedeemed: 0, activeCustomers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  async function loadReports() {
    try {
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, sale_items(quantity, unit_price, cost_price)')
        .gte('sale_date', `${dateRange.start}T00:00:00`)
        .lte('sale_date', `${dateRange.end}T23:59:59`);

      if (salesError) throw salesError;

      let totalRevenue = 0;
      let totalProfit = 0;

      (salesData as any[])?.forEach((sale) => {
        totalRevenue += Number(sale.total_amount);
        const saleItems = sale.sale_items as any[];
        saleItems?.forEach((item) => {
          const profit = (Number(item.unit_price) - Number(item.cost_price)) * Number(item.quantity);
          totalProfit += profit;
        });
      });

      setSalesReport({
        total_sales: salesData?.length || 0,
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        average_order_value: salesData?.length ? totalRevenue / salesData.length : 0,
      });

      const { data: commissionsData, error: commissionsError } = await supabase
        .from('referral_commissions')
        .select('referral_agent_id, sale_amount, commission_amount, status, referral_agents(name)')
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`);

      if (commissionsError) throw commissionsError;

      const commissionMap = new Map<string, CommissionReport>();

      commissionsData?.forEach((comm: any) => {
        const agentId = comm.referral_agent_id;
        const existing = commissionMap.get(agentId) || {
          agent_id: agentId,
          agent_name: comm.referral_agents?.name || 'Unknown',
          total_sales: 0,
          total_commission: 0,
          pending_commission: 0,
        };

        existing.total_sales += Number(comm.sale_amount);
        existing.total_commission += Number(comm.commission_amount);
        if (comm.status === 'pending') {
          existing.pending_commission += Number(comm.commission_amount);
        }

        commissionMap.set(agentId, existing);
      });

      setCommissionReports(Array.from(commissionMap.values()));

      // Dimension reports: sales by category, brand, gender
      const { data: itemsWithProduct } = await (supabase
        .from('sale_items') as any)
        .select('quantity, unit_price, products(category, brand, gender), sales!inner(sale_date)')
        .gte('sales.sale_date', `${dateRange.start}T00:00:00`)
        .lte('sales.sale_date', `${dateRange.end}T23:59:59`)
        .not('product_id', 'is', null);

      function aggregateDimension(key: string): DimensionRow[] {
        const map = new Map<string, { units: number; revenue: number }>();
        (itemsWithProduct || []).forEach((item: any) => {
          const label = item.products?.[key] || 'Unknown';
          const row = map.get(label) || { units: 0, revenue: 0 };
          row.units += Number(item.quantity);
          row.revenue += Number(item.unit_price) * Number(item.quantity);
          map.set(label, row);
        });
        return Array.from(map.entries())
          .map(([label, v]) => ({ label, ...v }))
          .sort((a, b) => b.revenue - a.revenue);
      }

      setCategoryReport(aggregateDimension('category'));
      setBrandReport(aggregateDimension('brand'));
      setGenderReport(aggregateDimension('gender'));

      // Loyalty summary
      const { data: loyaltyData } = await (supabase
        .from('loyalty_transactions') as any)
        .select('type, points')
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`);

      let earned = 0, redeemed = 0;
      (loyaltyData || []).forEach((tx: any) => {
        if (tx.type === 'earn') earned += Number(tx.points);
        else if (tx.type === 'redeem') redeemed += Number(tx.points);
      });
      setLoyaltySummary({ totalEarned: earned, totalRedeemed: redeemed, activeCustomers: new Set((loyaltyData || []).map((t: any) => t.customer_id)).size });

    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
        <p className="text-slate-600 mt-1">View business performance and insights</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Calendar className="w-5 h-5 text-slate-400 hidden sm:block" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none flex-1 sm:flex-none"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none flex-1 sm:flex-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Sales</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{salesReport.total_sales}</p>
            </div>
            <div className="bg-blue-500 p-3 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Revenue</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                LKR {salesReport.total_revenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-green-500 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Profit</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                LKR {salesReport.total_profit.toFixed(2)}
              </p>
            </div>
            <div className="bg-emerald-500 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Avg Order Value</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">
                LKR {salesReport.average_order_value.toFixed(2)}
              </p>
            </div>
            <div className="bg-orange-500 p-3 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Referral Commission Report</h3>
        </div>

        {commissionReports.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No commission data for the selected period
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden">
              {commissionReports.map((report) => (
                <div key={report.agent_id} className="border-b border-slate-200 last:border-b-0 p-4 space-y-2">
                  <h4 className="font-semibold text-slate-900 text-base">{report.agent_name}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-600 font-medium">Total Sales</p>
                      <p className="font-medium text-slate-900">LKR {report.total_sales.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 font-medium">Commission</p>
                      <p className="font-medium text-slate-900">LKR {report.total_commission.toFixed(2)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-slate-600 font-medium">Pending Commission</p>
                      <p className="font-medium text-orange-600">LKR {report.pending_commission.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Agent Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Total Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pending Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {commissionReports.map((report) => (
                  <tr key={report.agent_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {report.agent_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      LKR {report.total_sales.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      LKR {report.total_commission.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-orange-600 font-medium">
                      LKR {report.pending_commission.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

          </>
        )}
      </div>

      {/* Dimension Reports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {[
          { title: 'Sales by Category', data: categoryReport },
          { title: 'Sales by Brand', data: brandReport },
          { title: 'Sales by Gender', data: genderReport },
        ].map(({ title, data }) => (
          <div key={title} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {data.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-400">No data for this period.</p>
              ) : data.map((row) => (
                <div key={row.label} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{row.label}</p>
                    <p className="text-xs text-slate-400">{row.units} units</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">LKR {row.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Loyalty Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
        <div className="flex items-center gap-2 mb-5">
          <Star className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-slate-900">Loyalty Points Summary</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'Points Earned', value: loyaltySummary.totalEarned.toLocaleString(), color: 'text-emerald-600' },
            { label: 'Points Redeemed', value: loyaltySummary.totalRedeemed.toLocaleString(), color: 'text-amber-600' },
            { label: 'Loyalty Balance', value: (loyaltySummary.totalEarned - loyaltySummary.totalRedeemed).toLocaleString(), color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
