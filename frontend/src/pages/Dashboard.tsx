import { useQuery } from '@tanstack/react-query';
import { Store, Search, PlusSquare, Package, ShoppingBag, TrendingUp, Wifi, WifiOff, ChevronRight, AlertCircle, AlertTriangle, XCircle, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shopsApi } from '../services/api';
import api from '../services/api';

interface ListingInfo {
  total: number;
  outOfStock: number;
  lowStock: number;
  active: number;
}

function useAllListingsInfo(shopIds: string[]) {
  return useQuery({
    queryKey: ['dashboard-listings', shopIds],
    queryFn: async () => {
      const results: Record<string, ListingInfo> = {};
      for (const id of shopIds) {
        try {
          const data: any[] = await api.get(`/listings/shop/${id}`).then(r => r.data);
          results[id] = {
            total: data.length,
            outOfStock: data.filter(l => l.quantity === 0).length,
            lowStock: data.filter(l => l.quantity > 0 && l.quantity <= 3).length,
            active: data.filter(l => l.status === 'active').length,
          };
        } catch {
          results[id] = { total: 0, outOfStock: 0, lowStock: 0, active: 0 };
        }
      }
      return results;
    },
    enabled: shopIds.length > 0,
    staleTime: 60000,
  });
}

export default function Dashboard() {
  const { data: shops = [], isLoading } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  const connectedShops = (shops as any[]).filter((s: any) => s.status === 'connected');
  const connectedIds = connectedShops.map((s: any) => s.id);
  const { data: listingInfo = {} } = useAllListingsInfo(connectedIds);

  const totalListings = Object.values(listingInfo as Record<string, ListingInfo>).reduce((a, b) => a + b.total, 0);
  const totalOut = Object.values(listingInfo as Record<string, ListingInfo>).reduce((a, b) => a + b.outOfStock, 0);
  const totalLow = Object.values(listingInfo as Record<string, ListingInfo>).reduce((a, b) => a + b.lowStock, 0);

  return (
    <div className="p-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-etsy-dark">Etsy Manager</h1>
          <p className="text-etsy-gray text-sm">ניהול חנויות מקצועי</p>
        </div>
        <div className="w-10 h-10 bg-etsy-orange rounded-full flex items-center justify-center shadow">
          <span className="text-white font-bold text-lg">E</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          icon={<Store size={18} className="text-etsy-orange" />}
          label="חנויות"
          value={String((shops as any[]).length)}
          sub={`${connectedShops.length} מחוברות`}
          subColor="text-green-600"
          bg="bg-orange-50"
        />
        <StatCard
          icon={<Package size={18} className="text-blue-500" />}
          label="מוצרים"
          value={String(totalListings)}
          sub="בסה״כ"
          subColor="text-etsy-gray"
          bg="bg-blue-50"
        />
      </div>

      {/* Alerts */}
      {(totalOut > 0 || totalLow > 0) && (
        <div className="space-y-2 mb-4">
          {totalOut > 0 && (
            <Link to="/inventory" className="card p-3 flex items-center gap-3 border-red-200 bg-red-50/50">
              <XCircle size={18} className="text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">{totalOut} מוצרים אזלו מהמלאי</p>
                <p className="text-xs text-red-500">לחץ לעדכון כמויות</p>
              </div>
              <ChevronRight size={16} className="text-red-400" />
            </Link>
          )}
          {totalLow > 0 && (
            <Link to="/inventory" className="card p-3 flex items-center gap-3 border-orange-200 bg-orange-50/50">
              <AlertTriangle size={18} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-700">{totalLow} מוצרים במלאי נמוך (≤3)</p>
                <p className="text-xs text-orange-500">מומלץ לחדש מלאי</p>
              </div>
              <ChevronRight size={16} className="text-orange-400" />
            </Link>
          )}
        </div>
      )}

      {/* Setup warning */}
      {(shops as any[]).length === 0 && !isLoading && (
        <div className="card p-4 mb-4 border-orange-200 bg-orange-50">
          <div className="flex gap-3">
            <AlertCircle size={20} className="text-etsy-orange flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">התחל כאן</p>
              <p className="text-xs text-etsy-gray mt-0.5">הוסף חנות וחבר אותה ל-Etsy</p>
              <Link to="/shops" className="btn-primary text-sm inline-block mt-2">הוסף חנות ראשונה</Link>
            </div>
          </div>
        </div>
      )}

      {/* Shops list */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-etsy-dark">החנויות שלי</h2>
          <Link to="/shops" className="text-sm text-etsy-orange flex items-center gap-0.5">
            הכל <ChevronRight size={14} />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}
          </div>
        ) : (shops as any[]).length === 0 ? (
          <div className="card p-5 text-center border-dashed">
            <p className="text-etsy-gray text-sm">אין חנויות עדיין</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(shops as any[]).slice(0, 4).map((shop: any) => (
              <ShopRow key={shop.id} shop={shop} info={listingInfo[shop.id]} />
            ))}
            {(shops as any[]).length > 4 && (
              <Link to="/shops" className="block text-center text-sm text-etsy-orange py-2">
                + עוד {(shops as any[]).length - 4} חנויות
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <h2 className="font-semibold text-etsy-dark mb-3">פעולות מהירות</h2>
      <div className="grid grid-cols-2 gap-3">
        <QuickAction to="/listing/new"  icon={<PlusSquare size={20} className="text-etsy-orange" />} bg="bg-orange-50" title="מוצר חדש"     sub="העלאה לEtsy" />
        <QuickAction to="/research"     icon={<Search size={20} className="text-blue-500" />}        bg="bg-blue-50"   title="מחקר שוק"     sub="מילות מפתח" />
        <QuickAction to="/ai"           icon={<Sparkles size={20} className="text-purple-500" />}    bg="bg-purple-50" title="AI Generator"  sub="כותרת ותגיות" />
        <QuickAction to="/quick-edit"   icon={<Zap size={20} className="text-yellow-500" />}         bg="bg-yellow-50" title="עריכה מהירה"   sub="מחיר / כמות" />
        <QuickAction to="/analytics"    icon={<TrendingUp size={20} className="text-green-500" />}   bg="bg-green-50"  title="אנליטיקס"     sub="גרפים ומגמות" />
        <QuickAction to="/orders"       icon={<ShoppingBag size={20} className="text-pink-500" />}   bg="bg-pink-50"   title="הזמנות"       sub="מעקב מכירות" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, subColor, bg }: { icon: React.ReactNode; label: string; value: string; sub: string; subColor: string; bg: string }) {
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-etsy-gray">{label}</p>
      <p className={`text-xs font-medium mt-0.5 ${subColor}`}>{sub}</p>
    </div>
  );
}

function ShopRow({ shop, info }: { shop: any; info?: ListingInfo }) {
  const connected = shop.status === 'connected';
  const hasAlert = info && (info.outOfStock > 0 || info.lowStock > 0);
  return (
    <Link to="/shops" className="card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {shop.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{shop.name}</p>
        <p className="text-xs text-etsy-gray">
          {connected ? `${info?.total ?? '...'} מוצרים` : 'לא מחובר'}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {hasAlert && <AlertTriangle size={13} className="text-orange-400" />}
        {connected
          ? <><Wifi size={13} className="text-green-500" /><span className="badge-green">פעיל</span></>
          : <><WifiOff size={13} className="text-gray-400" /><span className="badge-gray">מנותק</span></>
        }
      </div>
    </Link>
  );
}

function QuickAction({ to, icon, bg, title, sub }: { to: string; icon: React.ReactNode; bg: string; title: string; sub: string }) {
  return (
    <Link to={to} className="card p-4 flex items-center gap-3 active:scale-[0.97] transition-transform">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-etsy-gray">{sub}</p>
      </div>
    </Link>
  );
}
