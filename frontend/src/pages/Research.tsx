import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, Store, BarChart2, Tag, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { researchApi, shopsApi } from '../services/api';

type Tab = 'keyword' | 'competitor' | 'bulk';

export default function Research() {
  const [tab, setTab] = useState<Tab>('keyword');
  const [shopId, setShopId] = useState('');

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-4 pt-2">מחקר שוק</h1>

      {/* Shop selector */}
      <div className="mb-4">
        <select className="input text-sm" value={shopId} onChange={e => setShopId(e.target.value)}>
          <option value="">ללא חנות (IP ישיר)</option>
          {shops.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name} {s.proxy_url ? '🔒' : ''}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
        {([['keyword', 'מילות מפתח'], ['competitor', 'מתחרים'], ['bulk', 'כמה מילות']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-etsy-orange shadow-sm' : 'text-etsy-gray'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'keyword' && <KeywordTab shopId={shopId || undefined} />}
      {tab === 'competitor' && <CompetitorTab shopId={shopId || undefined} />}
      {tab === 'bulk' && <BulkTab shopId={shopId || undefined} />}
    </div>
  );
}

function KeywordTab({ shopId }: { shopId?: string }) {
  const [query, setQuery] = useState('');
  const mutation = useMutation({ mutationFn: () => researchApi.keyword(query, shopId) });
  const data = mutation.data;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="מילת מפתח לחיפוש..." value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && query && mutation.mutate()} />
        <button onClick={() => mutation.mutate()} disabled={!query || mutation.isPending} className="btn-primary px-4">
          {mutation.isPending ? '...' : <Search size={18} />}
        </button>
      </div>

      {mutation.isError && <p className="text-red-500 text-sm">{mutation.error?.message}</p>}

      {data && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Search size={14} />} label="תוצאות" value={data.listing_count?.toLocaleString()} />
            <StatCard icon={<DollarSign size={14} />} label="מחיר ממוצע" value={`$${data.avg_price?.toFixed(2)}`} />
            <StatCard icon={<BarChart2 size={14} />} label="טווח" value={`$${data.min_price?.toFixed(0)}-${data.max_price?.toFixed(0)}`} />
          </div>

          {/* Price distribution */}
          {data.price_distribution?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3">פיזור מחירים</h3>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={data.price_distribution}>
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: any) => [v, 'מוצרים']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.price_distribution.map((_: any, i: number) => (
                      <Cell key={i} fill={i === Math.floor(data.price_distribution.length / 2) ? '#F96C26' : '#FFD4B8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Tags */}
          {Object.keys(data.tag_frequency || {}).length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><Tag size={14} />תגיות נפוצות</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.tag_frequency).map(([tag, count]: any) => (
                  <span key={tag} className="flex items-center gap-1 bg-orange-50 text-etsy-orange text-xs px-2 py-1 rounded-full border border-orange-100">
                    {tag} <span className="text-gray-400">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Listings */}
          {data.top_listings?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3">מוצרים מובילים</h3>
              <div className="space-y-3">
                {data.top_listings.map((listing: any) => (
                  <ListingRow key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitorTab({ shopId }: { shopId?: string }) {
  const [shopName, setShopName] = useState('');
  const mutation = useMutation({ mutationFn: () => researchApi.competitor(shopName, shopId) });
  const data = mutation.data;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="שם חנות Etsy מתחרה..." value={shopName}
          onChange={e => setShopName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && shopName && mutation.mutate()} />
        <button onClick={() => mutation.mutate()} disabled={!shopName || mutation.isPending} className="btn-primary px-4">
          {mutation.isPending ? '...' : <Store size={18} />}
        </button>
      </div>

      {mutation.isError && <p className="text-red-500 text-sm">{mutation.error?.message}</p>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Package size={14} />} label="מוצרים" value={data.listing_count?.toLocaleString()} />
            <StatCard icon={<DollarSign size={14} />} label="ממוצע" value={`$${data.avg_price?.toFixed(2)}`} />
            <StatCard icon={<BarChart2 size={14} />} label="טווח" value={`$${data.price_range?.min?.toFixed(0)}-${data.price_range?.max?.toFixed(0)}`} />
          </div>

          {data.common_tags?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-1"><Tag size={14} />תגיות נפוצות</h3>
              <div className="flex flex-wrap gap-2">
                {data.common_tags.map((tag: string) => (
                  <span key={tag} className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full border border-blue-100">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {data.listings?.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3">מוצרים</h3>
              <div className="space-y-3">
                {data.listings.slice(0, 10).map((listing: any) => (
                  <ListingRow key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BulkTab({ shopId }: { shopId?: string }) {
  const [input, setInput] = useState('');
  const mutation = useMutation({
    mutationFn: () => {
      const keywords = input.split('\n').map(k => k.trim()).filter(Boolean).slice(0, 10);
      return researchApi.bulkKeywords(keywords, shopId);
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="label">מילות מפתח (כל אחת בשורה, עד 10)</label>
        <textarea className="input" rows={5} placeholder={"handmade jewelry\ncustom print\nwoodwork gift"} value={input} onChange={e => setInput(e.target.value)} />
      </div>
      <button onClick={() => mutation.mutate()} disabled={!input || mutation.isPending} className="btn-primary w-full">
        {mutation.isPending ? 'מנתח...' : 'נתח הכל'}
      </button>

      {mutation.data && (
        <div className="space-y-3">
          {mutation.data.map((item: any, i: number) => (
            <div key={i} className="card p-3">
              {item.error ? (
                <p className="text-red-500 text-sm">{item.keyword}: {item.error}</p>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{item.keyword}</span>
                    <span className="text-xs text-etsy-gray">{item.listing_count?.toLocaleString()} תוצאות</span>
                  </div>
                  <div className="flex gap-3 text-xs text-etsy-gray">
                    <span>ממוצע: ${item.avg_price?.toFixed(2)}</span>
                    <span>מינ: ${item.min_price?.toFixed(2)}</span>
                    <span>מקס: ${item.max_price?.toFixed(2)}</span>
                  </div>
                  {item.tag_frequency && Object.keys(item.tag_frequency).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(item.tag_frequency).slice(0, 6).map(([tag]: any) => (
                        <span key={tag} className="text-xs bg-orange-50 text-etsy-orange px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-etsy-gray mb-1">{icon}<span className="text-xs">{label}</span></div>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}

function ListingRow({ listing }: { listing: any }) {
  return (
    <a href={listing.url} target="_blank" rel="noopener noreferrer"
      className="flex items-start gap-3 py-2 border-b border-etsy-border last:border-0 active:opacity-70">
      {listing.images?.[0] && (
        <img src={listing.images[0]} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-2">{listing.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-etsy-orange font-semibold text-sm">${listing.price?.toFixed(2)}</span>
          {listing.num_favorers > 0 && <span className="text-xs text-etsy-gray">♥ {listing.num_favorers}</span>}
        </div>
        {listing.shop_name && <p className="text-xs text-etsy-gray mt-0.5">{listing.shop_name}</p>}
      </div>
    </a>
  );
}

// Fix missing import
function Package({ size, className }: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
}
