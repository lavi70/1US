import { useQuery } from '@tanstack/react-query';
import { Store, Search, PlusSquare, Package, ShoppingBag, TrendingUp, Wifi, WifiOff, ChevronRight, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shopsApi } from '../services/api';
import api from '../services/api';

function useAllListingsCounts(shopIds: string[]) {
  return useQuery({
    queryKey: ['dashboard-listings', shopIds],
    queryFn: async () => {
      const results: Record<string, number> = {};
      for (const id of shopIds) {
        try {
          const data = await api.get(`/listings/shop/${id}`).then(r => r.data);
          results[id] = data.length;
        } catch { results[id] = 0; }
      }
      return results;
    },
    enabled: shopIds.length > 0,
    staleTime: 60000,
  });
}

export default function Dashboard() {
  const { data: shops = [], isLoading } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  const connectedShops = shops.filter((s: any) => s.status === 'connected');
  const connectedIds = connectedShops.map((s: any) => s.id);
  const { data: listingCounts = {} } = useAllListingsCounts(connectedIds);

  const totalListings = Object.values(listingCounts as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-etsy-dark">Etsy Manager</h1>
          <p className="text-etsy-gray text-sm">ניהול חנויות מקצועי</p>
        </div>
        <div className="w-10 h-10 bg-etsy-orange rounded-full flex items-center justify-center shadow">
          <span className="text-white font-bold text-lg">E</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard
          icon={<Store size={18} className="text-etsy-orange" />}
          label="חנויות"
          value={String(shops.length)}
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

      {/* Setup warning */}
      {shops.length === 0 && !isLoading && (
        <div className="card p-4 mb-5 border-orange-200 bg-orange-50">
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
      <div className="mb-5">
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
        ) : shops.length === 0 ? (
          <div className="card p-5 text-center border-dashed">
            <p className="text-etsy-gray text-sm">אין חנויות עדיין</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shops.slice(0, 4).map((shop: any) => (
              <ShopRow key={shop.id} shop={shop} listingCount={listingCounts[shop.id]} />
            ))}
            {shops.length > 4 && (
              <Link to="/shops" className="block text-center text-sm text-etsy-orange py-2">
                + עוד {shops.length - 4} חנויות
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <h2 className="font-semibold text-etsy-dark mb-3">פעולות מהירות</h2>
      <div className="grid grid-cols-2 gap-3">
        <QuickAction to="/listing/new" icon={<PlusSquare size={20} className="text-etsy-orange" />} bg="bg-orange-50" title="מוצר חדש" sub="העלאה לEtsy" />
        <QuickAction to="/research" icon={<Search size={20} className="text-blue-500" />} bg="bg-blue-50" title="מחקר שוק" sub="מילות מפתח" />
        <QuickAction to="/listings" icon={<Package size={20} className="text-purple-500" />} bg="bg-purple-50" title="המוצרים שלי" sub="ניהול רשימות" />
        <QuickAction to="/orders" icon={<ShoppingBag size={20} className="text-green-500" />} bg="bg-green-50" title="הזמנות" sub="מעקב מכירות" />
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

function ShopRow({ shop, listingCount }: { shop: any; listingCount?: number }) {
  const connected = shop.status === 'connected';
  return (
    <Link to="/shops" className="card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {shop.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{shop.name}</p>
        <p className="text-xs text-etsy-gray">
          {connected ? `${listingCount ?? '...'} מוצרים` : 'לא מחובר'}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
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
