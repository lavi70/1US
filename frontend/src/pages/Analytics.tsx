import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Package, Calendar } from 'lucide-react';
import { shopsApi } from '../services/api';
import api from '../services/api';

const COLORS = ['#F96C26', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

function useAnalytics(shopId: string, days: number) {
  return useQuery({
    queryKey: ['analytics', shopId, days],
    queryFn: () => api.get(`/analytics/shop/${shopId}?days=${days}`).then(r => r.data),
    enabled: !!shopId,
    staleTime: 120000,
  });
}

export default function Analytics() {
  const [selectedShop, setSelectedShop] = useState('');
  const [days, setDays] = useState(30);
  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const { data, isLoading } = useAnalytics(selectedShop, days);

  const connectedShops = shops.filter((s: any) => s.status === 'connected');

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-4 pt-2">אנליטיקס</h1>

      <div className="flex gap-2 mb-4">
        <select className="input flex-1 text-sm" value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
          <option value="">בחר חנות...</option>
          {connectedShops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input w-24 text-sm" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>7 ימים</option>
          <option value={30}>30 ימים</option>
          <option value={90}>90 ימים</option>
        </select>
      </div>

      {!selectedShop ? (
        <div className="card p-8 text-center">
          <TrendingUp size={40} className="text-etsy-gray mx-auto mb-3" />
          <p className="text-etsy-gray">בחר חנות לצפייה בנתונים</p>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : data ? (
        <AnalyticsContent data={data} days={days} />
      ) : null}
    </div>
  );
}

function AnalyticsContent({ data, days }: { data: any; days: number }) {
  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard icon={<DollarSign size={16} className="text-green-500" />} label="הכנסה" value={`$${data.total_revenue?.toFixed(2) || '0.00'}`} change={data.revenue_change} bg="bg-green-50" />
        <KPICard icon={<ShoppingBag size={16} className="text-blue-500" />} label="הזמנות" value={String(data.total_orders || 0)} change={data.orders_change} bg="bg-blue-50" />
        <KPICard icon={<Package size={16} className="text-purple-500" />} label="מוצרים פעילים" value={String(data.active_listings || 0)} change={null} bg="bg-purple-50" />
        <KPICard icon={<TrendingUp size={16} className="text-etsy-orange" />} label="ממוצע הזמנה" value={`$${data.avg_order_value?.toFixed(2) || '0.00'}`} change={null} bg="bg-orange-50" />
      </div>

      {/* Revenue Chart */}
      {data.revenue_by_day?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1">
            <Calendar size={14} className="text-etsy-orange" /> הכנסות ב-{days} ימים
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data.revenue_by_day}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F96C26" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F96C26" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis hide />
              <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'הכנסה']} labelFormatter={l => `תאריך: ${l}`} />
              <Area type="monotone" dataKey="revenue" stroke="#F96C26" fill="url(#revGradient)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Orders by day */}
      {data.orders_by_day?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1">
            <ShoppingBag size={14} className="text-blue-500" /> הזמנות לפי יום
          </h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.orders_by_day}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis hide />
              <Tooltip formatter={(v: any) => [v, 'הזמנות']} />
              <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top products */}
      {data.top_listings?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">מוצרים מובילים</h3>
          <div className="space-y-2">
            {data.top_listings.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-etsy-orange w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-etsy-orange h-1.5 rounded-full" style={{ width: `${(item.quantity / (data.top_listings[0]?.quantity || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">${item.revenue?.toFixed(2)}</p>
                  <p className="text-xs text-etsy-gray">{item.quantity} יח׳</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by listing pie */}
      {data.revenue_by_listing?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3">פיזור הכנסות</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.revenue_by_listing.slice(0, 6)} dataKey="revenue" nameKey="title" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: any) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.revenue_by_listing.slice(0, 6).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'הכנסה']} />
              <Legend formatter={(v: any) => v?.slice(0, 20)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon, label, value, change, bg }: { icon: React.ReactNode; label: string; value: string; change: number | null; bg: string }) {
  return (
    <div className="card p-3">
      <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-etsy-gray">{label}</p>
      {change != null && (
        <p className={`text-xs font-medium mt-0.5 ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}</div>
      <div className="card h-48 animate-pulse bg-gray-100" />
      <div className="card h-36 animate-pulse bg-gray-100" />
    </div>
  );
}
