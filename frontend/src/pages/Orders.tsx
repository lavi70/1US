import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, ExternalLink, Clock, CheckCircle, Package, Truck } from 'lucide-react';
import { shopsApi } from '../services/api';
import api from '../services/api';

function useOrders(shopId: string) {
  return useQuery({
    queryKey: ['orders', shopId],
    queryFn: () => api.get(`/orders/shop/${shopId}`).then(r => r.data),
    enabled: !!shopId,
    staleTime: 60000,
  });
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  open:       { label: 'ממתין',   icon: Clock,        color: 'badge-orange' },
  paid:       { label: 'שולם',    icon: CheckCircle,  color: 'badge-green' },
  completed:  { label: 'הושלם',   icon: Package,      color: 'badge-green' },
  shipped:    { label: 'נשלח',    icon: Truck,        color: 'badge-green' },
  cancelled:  { label: 'בוטל',    icon: Clock,        color: 'badge-gray' },
};

export default function Orders() {
  const [selectedShop, setSelectedShop] = useState('');
  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const { data: orders = [], isLoading } = useOrders(selectedShop);

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const openCount = orders.filter((o: any) => o.status === 'open' || o.status === 'paid').length;

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-4 pt-2">הזמנות</h1>

      <select className="input mb-4 text-sm" value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
        <option value="">בחר חנות...</option>
        {shops.map((s: any) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {selectedShop && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold">{orders.length}</p>
            <p className="text-xs text-etsy-gray">סה"כ</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{openCount}</p>
            <p className="text-xs text-etsy-gray">ממתינות</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-etsy-gray">הכנסה</p>
          </div>
        </div>
      )}

      {!selectedShop ? (
        <div className="card p-8 text-center">
          <ShoppingBag size={40} className="text-etsy-gray mx-auto mb-3" />
          <p className="text-etsy-gray">בחר חנות לצפייה בהזמנות</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}</div>
      ) : orders.length === 0 ? (
        <div className="card p-8 text-center">
          <ShoppingBag size={36} className="text-etsy-gray mx-auto mb-2" />
          <p className="text-etsy-gray text-sm">אין הזמנות</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => <OrderCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_MAP[order.status] || STATUS_MAP.open;
  const StatusIcon = status.icon;

  return (
    <div className="card overflow-hidden">
      <div className="p-3 flex items-center gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
          <StatusIcon size={16} className="text-etsy-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">הזמנה #{order.receipt_id || order.id?.slice(0, 8)}</p>
            <span className={status.color}>{status.label}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-etsy-gray">
            <span>{order.buyer_email || order.name || 'לקוח'}</span>
            {order.total && <span className="text-etsy-orange font-medium">${order.total.toFixed(2)}</span>}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-etsy-border px-3 pb-3 pt-2 space-y-2">
          {order.transactions?.map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Package size={13} className="text-etsy-gray flex-shrink-0" />
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-etsy-gray">{t.quantity}x</span>
              <span className="font-medium">${(t.price || 0).toFixed(2)}</span>
            </div>
          ))}
          {order.shipping_address && (
            <p className="text-xs text-etsy-gray">
              {[order.shipping_address.first_line, order.shipping_address.city, order.shipping_address.country_iso].filter(Boolean).join(', ')}
            </p>
          )}
          {order.receipt_id && (
            <a href={`https://www.etsy.com/your/orders/sold/new?order_id=${order.receipt_id}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-etsy-orange">
              <ExternalLink size={12} /> פתח ב-Etsy
            </a>
          )}
        </div>
      )}
    </div>
  );
}
