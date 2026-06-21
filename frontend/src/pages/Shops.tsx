import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Link, Unlink, ChevronDown, ChevronUp } from 'lucide-react';
import { shopsApi, authApi } from '../services/api';
import { useToast } from '../components/Toast';

export default function Shops() {
  const qc = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: shops = [], isLoading } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  useEffect(() => {
    const connected = searchParams.get('oauth_connected');
    const error = searchParams.get('oauth_error');
    if (connected) {
      qc.invalidateQueries({ queryKey: ['shops'] });
      toast.success('החנות חוברה בהצלחה לEtsy!');
      setSearchParams({}, { replace: true });
    } else if (error) {
      toast.error(`שגיאה בחיבור: ${decodeURIComponent(error)}`);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: shopsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shops'] }); setShowAdd(false); toast.success('החנות נוספה!'); },
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: shopsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }),
  });

  const connectMutation = useMutation({
    mutationFn: async (shopId: string) => {
      const { url } = await authApi.getUrl(shopId);
      window.location.href = url;
    },
    onError: (e: any) => toast.error(`שגיאה: ${e.message}`),
  });

  const disconnectMutation = useMutation({
    mutationFn: authApi.disconnect,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }),
  });

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center justify-between mb-6 pt-2">
        <h1 className="text-xl font-bold">החנויות שלי</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> הוסף
        </button>
      </div>

      {showAdd && (
        <AddShopForm
          onSubmit={createMutation.mutate}
          onCancel={() => setShowAdd(false)}
          loading={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="card p-4 h-20 animate-pulse bg-gray-100" />)}</div>
      ) : shops.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-etsy-gray mb-4">אין חנויות. הוסף את החנות הראשונה שלך!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(shops as any[]).map((shop: any) => (
            <ShopItem
              key={shop.id}
              shop={shop}
              expanded={expandedId === shop.id}
              onToggle={() => setExpandedId(expandedId === shop.id ? null : shop.id)}
              onConnect={() => connectMutation.mutate(shop.id)}
              onDisconnect={() => disconnectMutation.mutate(shop.id)}
              onDelete={() => { if (confirm(`למחוק את "${shop.name}"?`)) deleteMutation.mutate(shop.id); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddShopForm({ onSubmit, onCancel, loading }: { onSubmit: (d: any) => void; onCancel: () => void; loading: boolean }) {
  const [name, setName] = useState('');

  return (
    <div className="card p-4 mb-4">
      <h3 className="font-semibold mb-3">חנות חדשה</h3>
      <div className="space-y-3">
        <div>
          <label className="label">שם החנות *</label>
          <input className="input" placeholder="My Etsy Store" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSubmit({ name })} disabled={!name || loading} className="btn-primary flex-1">
            {loading ? 'שומר...' : 'הוסף חנות'}
          </button>
          <button onClick={onCancel} className="btn-secondary px-4">ביטול</button>
        </div>
      </div>
    </div>
  );
}

function ShopItem({ shop, expanded, onToggle, onConnect, onDisconnect, onDelete }: any) {
  const connected = shop.status === 'connected';

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center gap-3" onClick={onToggle}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {shop.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{shop.name}</p>
          <p className="text-xs text-etsy-gray">
            {connected ? `Etsy ID: ${shop.etsy_shop_id}` : 'לא מחובר'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={connected ? 'badge-green' : 'badge-gray'}>{connected ? 'מחובר' : 'מנותק'}</span>
          {expanded ? <ChevronUp size={16} className="text-etsy-gray" /> : <ChevronDown size={16} className="text-etsy-gray" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-etsy-border px-4 pb-4 pt-3">
          <div className="flex gap-2">
            {connected ? (
              <button onClick={onDisconnect} className="flex-1 flex items-center justify-center gap-1 btn-secondary text-sm text-red-600 border-red-200">
                <Unlink size={14} /> נתק
              </button>
            ) : (
              <button onClick={onConnect} className="flex-1 flex items-center justify-center gap-1 btn-primary text-sm">
                <Link size={14} /> חבר לEtsy
              </button>
            )}
            <button onClick={onDelete} className="p-2.5 rounded-lg border border-red-200 text-red-500 active:scale-95 transition-transform">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
