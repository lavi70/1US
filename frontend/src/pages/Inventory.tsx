import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, AlertTriangle, XCircle, CheckCircle, Save } from 'lucide-react';
import { shopsApi, listingsApi } from '../services/api';
import { useToast } from '../components/Toast';

type StockFilter = 'all' | 'out' | 'low' | 'ok';

const LOW_THRESHOLD = 3;

function stockLevel(qty: number): 'out' | 'low' | 'ok' {
  if (qty === 0) return 'out';
  if (qty <= LOW_THRESHOLD) return 'low';
  return 'ok';
}

export default function Inventory() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedShop, setSelectedShop] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings', selectedShop],
    queryFn: () => listingsApi.list(selectedShop),
    enabled: !!selectedShop,
  });

  const all = listings as any[];
  const out = all.filter(l => l.quantity === 0);
  const low = all.filter(l => l.quantity > 0 && l.quantity <= LOW_THRESHOLD);
  const ok = all.filter(l => l.quantity > LOW_THRESHOLD);

  const visible = filter === 'out' ? out : filter === 'low' ? low : filter === 'ok' ? ok : all;

  const saveMutation = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      setSaving(s => new Set(s).add(id));
      await listingsApi.update(id, { quantity: qty });
    },
    onSuccess: (_, { id }) => {
      setSaving(s => { const n = new Set(s); n.delete(id); return n; });
      setEdits(e => { const n = { ...e }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ['listings'] });
      toast.success('כמות עודכנה');
    },
    onError: (err: any, { id }) => {
      setSaving(s => { const n = new Set(s); n.delete(id); return n; });
      toast.error(err.message);
    },
  });

  const Pill = ({ label, count, val, color }: { label: string; count: number; val: StockFilter; color: string }) => (
    <button onClick={() => setFilter(val)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === val ? `${color} text-white border-transparent` : 'border-etsy-border text-etsy-gray bg-white'}`}>
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === val ? 'bg-white/30' : 'bg-gray-100'}`}>{count}</span>
    </button>
  );

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center gap-2 mb-1 pt-2">
        <Package size={20} className="text-etsy-orange" />
        <h1 className="text-xl font-bold">ניהול מלאי</h1>
      </div>
      <p className="text-xs text-etsy-gray mb-4">מעקב מלאי והתראות על מוצרים אוזלים</p>

      <select className="input mb-4 text-sm" value={selectedShop} onChange={e => { setSelectedShop(e.target.value); setEdits({}); }}>
        <option value="">בחר חנות...</option>
        {(shops as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedShop && !isLoading && all.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="card p-3 text-center border-red-100">
              <XCircle size={16} className="text-red-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-500">{out.length}</p>
              <p className="text-xs text-etsy-gray">אזל</p>
            </div>
            <div className="card p-3 text-center border-orange-100">
              <AlertTriangle size={16} className="text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-orange-500">{low.length}</p>
              <p className="text-xs text-etsy-gray">מלאי נמוך</p>
            </div>
            <div className="card p-3 text-center border-green-100">
              <CheckCircle size={16} className="text-green-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-600">{ok.length}</p>
              <p className="text-xs text-etsy-gray">במלאי</p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            <Pill label="הכל" count={all.length} val="all" color="bg-etsy-orange" />
            <Pill label="אזל" count={out.length} val="out" color="bg-red-500" />
            <Pill label="נמוך" count={low.length} val="low" color="bg-orange-500" />
            <Pill label="תקין" count={ok.length} val="ok" color="bg-green-500" />
          </div>

          {/* Listing rows */}
          <div className="space-y-2">
            {visible.map((l: any) => {
              const level = stockLevel(l.quantity);
              const editVal = edits[l.id];
              const isDirty = editVal !== undefined && editVal !== String(l.quantity);

              const rowBorder = level === 'out' ? 'border-red-200 bg-red-50/30' : level === 'low' ? 'border-orange-200 bg-orange-50/20' : '';
              const qtyColor = level === 'out' ? 'text-red-600 bg-red-100' : level === 'low' ? 'text-orange-600 bg-orange-100' : 'text-green-700 bg-green-100';

              return (
                <div key={l.id} className={`card p-3 flex items-center gap-3 ${rowBorder}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.title}</p>
                    <p className="text-xs text-etsy-gray">${l.price}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {level === 'out' && <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                    {level === 'low' && <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={editVal ?? l.quantity}
                        onChange={e => setEdits(p => ({ ...p, [l.id]: e.target.value }))}
                        className={`w-16 text-center text-sm font-bold rounded-lg px-2 py-1 border ${isDirty ? 'border-etsy-orange' : 'border-transparent'} ${qtyColor}`}
                      />
                      {isDirty && (
                        <button
                          onClick={() => saveMutation.mutate({ id: l.id, qty: parseInt(editVal) })}
                          disabled={saving.has(l.id)}
                          className="p-1.5 bg-etsy-orange text-white rounded-lg">
                          {saving.has(l.id) ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visible.length === 0 && (
            <div className="card p-8 text-center mt-2">
              <CheckCircle size={36} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-etsy-gray">אין מוצרים בקטגוריה זו</p>
            </div>
          )}
        </>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="card h-14 animate-pulse bg-gray-100" />)}
        </div>
      )}

      {!selectedShop && (
        <div className="card p-8 text-center mt-4">
          <Package size={40} className="text-etsy-gray mx-auto mb-3" />
          <p className="text-etsy-gray text-sm">בחר חנות לניהול מלאי</p>
        </div>
      )}
    </div>
  );
}
