import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, DollarSign, Package, Tag, Percent, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { shopsApi, listingsApi } from '../services/api';
import { useToast } from '../components/Toast';

type EditMode = 'price' | 'quantity' | 'tags' | 'price_pct';

export default function QuickEdit() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedShop, setSelectedShop] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<EditMode>('price');
  const [value, setValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings', selectedShop],
    queryFn: () => listingsApi.list(selectedShop),
    enabled: !!selectedShop,
  });

  const allSelected = listings.length > 0 && listings.every((l: any) => selected.has(l.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(listings.map((l: any) => l.id)));
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      setSaving(true);
      const ids = Array.from(selected);
      for (const id of ids) {
        const listing = listings.find((l: any) => l.id === id);
        if (!listing) continue;

        if (mode === 'price') {
          await listingsApi.update(id, { price: parseFloat(value) });
        } else if (mode === 'price_pct') {
          const pct = parseFloat(value) / 100;
          const newPrice = listing.price * (1 + pct);
          await listingsApi.update(id, { price: Math.round(newPrice * 100) / 100 });
        } else if (mode === 'quantity') {
          await listingsApi.update(id, { quantity: parseInt(value) });
        } else if (mode === 'tags') {
          const existingTags: string[] = listing.tags || [];
          const merged = Array.from(new Set([...existingTags, ...tagsToAdd])).slice(0, 13);
          await listingsApi.update(id, { tags: merged });
        }
      }
    },
    onSuccess: () => {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ['listings'] });
      toast.success(`עודכנו ${selected.size} מוצרים`);
      setSelected(new Set());
      setValue('');
      setTagsToAdd([]);
    },
    onError: (err: any) => {
      setSaving(false);
      toast.error(err.message);
    },
  });

  const exportCSV = () => {
    const rows = listings.map((l: any) => [
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${(l.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      l.price,
      l.quantity,
      `"${(l.tags || []).join('|')}"`,
      l.who_made || '',
      l.when_made || '',
      l.status || '',
      l.etsy_listing_id || '',
    ].join(','));
    const header = 'title,description,price,quantity,tags,who_made,when_made,status,etsy_listing_id';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `listings_${selectedShop}_${Date.now()}.csv`;
    a.click();
    toast.success('ייצוא הצליח!');
  };

  const MODES = [
    { key: 'price',     icon: DollarSign, label: 'קבע מחיר' },
    { key: 'price_pct', icon: Percent,    label: 'שנה % מחיר' },
    { key: 'quantity',  icon: Package,    label: 'קבע כמות' },
    { key: 'tags',      icon: Tag,        label: 'הוסף תגיות' },
  ] as const;

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-4 pt-2">עריכה מהירה</h1>

      <select className="input mb-4 text-sm" value={selectedShop} onChange={e => { setSelectedShop(e.target.value); setSelected(new Set()); }}>
        <option value="">בחר חנות...</option>
        {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedShop && (
        <>
          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {MODES.map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setMode(key)}
                className={`card p-3 flex items-center gap-2 text-sm font-medium transition-colors ${mode === key ? 'border-etsy-orange text-etsy-orange bg-orange-50' : 'text-etsy-gray'}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Value input */}
          <div className="card p-3 mb-3">
            {(mode === 'price' || mode === 'price_pct' || mode === 'quantity') && (
              <div>
                <label className="label text-sm">
                  {mode === 'price' ? 'מחיר חדש ($)' : mode === 'price_pct' ? 'שינוי באחוזים (למשל: 10 להעלאה, -5 להורדה)' : 'כמות חדשה'}
                </label>
                <input className="input" type="number" value={value} onChange={e => setValue(e.target.value)}
                  placeholder={mode === 'price' ? '29.99' : mode === 'price_pct' ? '10' : '5'} />
              </div>
            )}
            {mode === 'tags' && (
              <div>
                <label className="label text-sm">תגיות להוספה ({tagsToAdd.length})</label>
                <div className="flex gap-2 mb-2">
                  <input className="input flex-1 text-sm" placeholder="תגית חדשה..." value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const t = tagInput.trim();
                        if (t && !tagsToAdd.includes(t)) setTagsToAdd(p => [...p, t]);
                        setTagInput('');
                      }
                    }} />
                  <button onClick={() => { const t = tagInput.trim(); if (t && !tagsToAdd.includes(t)) { setTagsToAdd(p => [...p, t]); setTagInput(''); } }} className="btn-secondary px-3">+</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tagsToAdd.map(t => (
                    <span key={t} onClick={() => setTagsToAdd(p => p.filter(x => x !== t))}
                      className="text-xs bg-orange-50 text-etsy-orange px-2 py-1 rounded-full cursor-pointer border border-orange-100">
                      {t} ×
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Listings */}
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card h-14 animate-pulse bg-gray-100" />)}</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-etsy-gray">
                  {allSelected ? <CheckSquare size={16} className="text-etsy-orange" /> : <Square size={16} />}
                  בחר הכל ({listings.length})
                </button>
                <div className="flex gap-2">
                  <button onClick={exportCSV} disabled={listings.length === 0}
                    className="btn-secondary text-xs py-1.5 px-3">ייצוא CSV</button>
                  {selected.size > 0 && (
                    <button onClick={() => applyMutation.mutate()}
                      disabled={saving || (mode !== 'tags' ? !value : tagsToAdd.length === 0)}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                      <Save size={12} />
                      {saving ? 'שומר...' : `עדכן (${selected.size})`}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {listings.map((listing: any) => (
                  <div key={listing.id} onClick={() => {
                    const next = new Set(selected);
                    if (next.has(listing.id)) next.delete(listing.id); else next.add(listing.id);
                    setSelected(next);
                  }} className={`card p-3 flex items-center gap-3 cursor-pointer transition-colors ${selected.has(listing.id) ? 'border-etsy-orange bg-orange-50/30' : ''}`}>
                    {selected.has(listing.id)
                      ? <CheckSquare size={16} className="text-etsy-orange flex-shrink-0" />
                      : <Square size={16} className="text-etsy-gray flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{listing.title}</p>
                      <p className="text-xs text-etsy-gray">${listing.price} · כמות {listing.quantity}</p>
                    </div>
                    <span className={listing.status === 'active' ? 'badge-green' : 'badge-gray'}>
                      {listing.status === 'active' ? 'פעיל' : 'טיוטה'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!selectedShop && (
        <div className="card p-8 text-center mt-4">
          <Package size={40} className="text-etsy-gray mx-auto mb-3" />
          <p className="text-etsy-gray text-sm">בחר חנות לעריכה מהירה</p>
        </div>
      )}
    </div>
  );
}
