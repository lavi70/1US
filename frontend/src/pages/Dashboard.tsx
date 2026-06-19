import { useQuery } from '@tanstack/react-query';
import { Store, Package, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { shopsApi, listingsApi } from '../services/api';

export default function Dashboard() {
  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  const connectedShops = shops.filter((s: any) => s.status === 'connected');
  const totalShops = shops.length;

  return (
    <div className="p-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-etsy-dark">Etsy Manager</h1>
          <p className="text-etsy-gray text-sm">ניהול חנויות מקצועי</p>
        </div>
        <div className="w-10 h-10 bg-etsy-orange rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-lg">E</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Store size={16} className="text-etsy-orange" />
            <span className="text-xs text-etsy-gray">חנויות</span>
          </div>
          <p className="text-2xl font-bold">{totalShops}</p>
          <p className="text-xs text-green-600">{connectedShops.length} מחוברות</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-etsy-orange" />
            <span className="text-xs text-etsy-gray">סטטוס</span>
          </div>
          <p className="text-2xl font-bold">{connectedShops.length > 0 ? '✓' : '–'}</p>
          <p className="text-xs text-etsy-gray">API פעיל</p>
        </div>
      </div>

      {/* Shops List */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-etsy-dark">החנויות שלך</h2>
          <Link to="/shops" className="text-sm text-etsy-orange">ראה הכל</Link>
        </div>

        {shops.length === 0 ? (
          <div className="card p-6 text-center">
            <Store size={40} className="text-etsy-gray mx-auto mb-3" />
            <p className="font-medium mb-1">אין חנויות עדיין</p>
            <p className="text-sm text-etsy-gray mb-4">הוסף את החנות הראשונה שלך</p>
            <Link to="/shops" className="btn-primary inline-block">הוסף חנות</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {shops.slice(0, 5).map((shop: any) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/listing/new" className="card p-4 flex items-center gap-3 active:scale-95 transition-transform">
          <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
            <Package size={18} className="text-etsy-orange" />
          </div>
          <div>
            <p className="font-medium text-sm">מוצר חדש</p>
            <p className="text-xs text-etsy-gray">העלאה מהירה</p>
          </div>
        </Link>
        <Link to="/research" className="card p-4 flex items-center gap-3 active:scale-95 transition-transform">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <TrendingUp size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="font-medium text-sm">מחקר שוק</p>
            <p className="text-xs text-etsy-gray">ניתוח מילות מפתח</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function ShopCard({ shop }: { shop: any }) {
  const connected = shop.status === 'connected';
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${connected ? 'bg-green-50' : 'bg-gray-50'}`}>
        {connected ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{shop.name}</p>
        <p className="text-xs text-etsy-gray">{shop.etsy_shop_id ? `ID: ${shop.etsy_shop_id}` : 'לא מחובר'}</p>
      </div>
      <span className={connected ? 'badge-green' : 'badge-gray'}>
        {connected ? 'מחובר' : 'מנותק'}
      </span>
    </div>
  );
}
