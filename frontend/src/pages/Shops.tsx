import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Link, Unlink, ChevronDown, ChevronUp, Shield, CheckCircle, XCircle } from 'lucide-react';
import { shopsApi, authApi } from '../services/api';
import { useToast } from '../components/Toast';

type ProxyType = 'http' | 'https' | 'socks5' | 'socks4';

function buildProxyUrl(type: ProxyType, host: string, port: string) {
  if (!host || !port) return '';
  return `${type}://${host}:${port}`;
}

function parseProxyUrl(url: string): { type: ProxyType; host: string; port: string } {
  try {
    const u = new URL(url);
    const type = (u.protocol.replace(':', '') as ProxyType) || 'http';
    return { type, host: u.hostname, port: u.port };
  } catch {
    return { type: 'http', host: '', port: '' };
  }
}

export default function Shops() {
  const qc = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: shops = [], isLoading } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  // Handle OAuth redirect result
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

      {showAdd && <AddShopForm onSubmit={createMutation.mutate} onCancel={() => setShowAdd(false)} loading={createMutation.isPending} />}

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
  const [showProxy, setShowProxy] = useState(false);
  const [proxy, setProxy] = useState<{ type: ProxyType; host: string; port: string; username: string; password: string }>({ type: 'socks5', host: '', port: '', username: '', password: '' });

  const handleSubmit = () => {
    onSubmit({
      name,
      proxy_url: buildProxyUrl(proxy.type, proxy.host, proxy.port),
      proxy_username: proxy.username || undefined,
      proxy_password: proxy.password || undefined,
    });
  };

  return (
    <div className="card p-4 mb-4">
      <h3 className="font-semibold mb-3">חנות חדשה</h3>
      <div className="space-y-3">
        <div>
          <label className="label">שם החנות *</label>
          <input className="input" placeholder="My Etsy Store" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <button type="button" onClick={() => setShowProxy(!showProxy)}
          className="flex items-center gap-1 text-sm text-etsy-orange font-medium">
          <Shield size={14} /> פרוקסי {showProxy ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {proxy.host && <span className="text-green-600 text-xs ml-1">● פעיל</span>}
        </button>
        {showProxy && (
          <div className="border border-blue-100 rounded-xl p-3 bg-blue-50 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">הגדרות פרוקסי</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['socks5','socks4','http','https'] as ProxyType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => setProxy({ ...proxy, type: t })}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all ${proxy.type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {t === 'socks5' ? '⚡ SOCKS5' : t.toUpperCase()}
                </button>
              ))}
            </div>
            {proxy.type === 'socks5' && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-100 rounded-lg px-2 py-1.5">
                <span>✓</span> מומלץ לAdsPower — בחר SOCKS5 בהגדרות הפרופיל
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="label text-xs text-gray-500">כתובת IP</label>
                <input className="input text-sm font-mono" placeholder="192.168.1.1" value={proxy.host}
                  onChange={e => setProxy({ ...proxy, host: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs text-gray-500">פורט</label>
                <input className="input text-sm font-mono" placeholder="1080" value={proxy.port}
                  onChange={e => setProxy({ ...proxy, port: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs text-gray-500">שם משתמש</label>
                <input className="input text-sm" placeholder="אופציונלי" value={proxy.username}
                  onChange={e => setProxy({ ...proxy, username: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs text-gray-500">סיסמה</label>
                <input className="input text-sm" type="password" placeholder="אופציונלי" value={proxy.password}
                  onChange={e => setProxy({ ...proxy, password: e.target.value })} />
              </div>
            </div>
            {proxy.host && proxy.port && (
              <div className="text-xs font-mono text-gray-500 bg-white rounded px-2 py-1 border">
                {buildProxyUrl(proxy.type, proxy.host, proxy.port)}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={!name || loading} className="btn-primary flex-1">
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
  const qc = useQueryClient();

  const existing = parseProxyUrl(shop.proxy_url || '');
  const [proxy, setProxy] = useState<{ type: ProxyType; host: string; port: string; username: string; password: string }>({
    type: existing.type,
    host: existing.host,
    port: existing.port,
    username: shop.proxy_username || '',
    password: '',
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => shopsApi.update(shop.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shops'] }),
  });

  const handleSaveProxy = () => {
    updateMutation.mutate({
      proxy_url: buildProxyUrl(proxy.type, proxy.host, proxy.port),
      proxy_username: proxy.username || undefined,
      proxy_password: proxy.password || undefined,
    });
  };

  const hasProxy = !!(proxy.host && proxy.port);

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
            {hasProxy && <span className="ml-2 text-blue-500">🔒 פרוקסי</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={connected ? 'badge-green' : 'badge-gray'}>{connected ? 'מחובר' : 'מנותק'}</span>
          {expanded ? <ChevronUp size={16} className="text-etsy-gray" /> : <ChevronDown size={16} className="text-etsy-gray" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-etsy-border px-4 pb-4 pt-3 space-y-3">
          <div className="border border-blue-100 rounded-xl p-3 bg-blue-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                <Shield size={12} /> פרוקסי
              </div>
              {hasProxy
                ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> פעיל</span>
                : <span className="flex items-center gap-1 text-xs text-gray-400"><XCircle size={12} /> לא מוגדר</span>
              }
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['socks5','socks4','http','https'] as ProxyType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => setProxy({ ...proxy, type: t })}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all ${proxy.type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {t === 'socks5' ? '⚡ SOCKS5' : t.toUpperCase()}
                </button>
              ))}
            </div>
            {proxy.type === 'socks5' && (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-100 rounded-lg px-2 py-1.5">
                <span>✓</span> מומלץ לAdsPower — בחר SOCKS5 בהגדרות הפרופיל
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="label text-xs text-gray-500">כתובת IP</label>
                <input className="input text-sm font-mono" placeholder="192.168.1.1"
                  value={proxy.host} onChange={e => setProxy({ ...proxy, host: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs text-gray-500">פורט</label>
                <input className="input text-sm font-mono" placeholder="1080"
                  value={proxy.port} onChange={e => setProxy({ ...proxy, port: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs text-gray-500">שם משתמש</label>
                <input className="input text-sm" placeholder="אופציונלי"
                  value={proxy.username} onChange={e => setProxy({ ...proxy, username: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs text-gray-500">סיסמה</label>
                <input className="input text-sm" type="password" placeholder="אופציונלי"
                  value={proxy.password} onChange={e => setProxy({ ...proxy, password: e.target.value })} />
              </div>
            </div>
            {proxy.host && proxy.port && (
              <div className="text-xs font-mono text-gray-500 bg-white rounded px-2 py-1 border truncate">
                {buildProxyUrl(proxy.type, proxy.host, proxy.port)}
              </div>
            )}
            <button onClick={handleSaveProxy} disabled={updateMutation.isPending}
              className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50">
              {updateMutation.isPending ? '...' : '💾 שמור פרוקסי'}
            </button>
          </div>

          <div className="flex gap-2 pt-1">
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
