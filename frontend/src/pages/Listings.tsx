import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package, RefreshCw, Trash2, Edit3, Send, ExternalLink,
  Search, ChevronDown, Plus, CheckSquare, Square, Copy, BarChart2
} from 'lucide-react';
import { listingsApi, shopsApi } from '../services/api';
import { calcSEOScore } from '../components/SEOScore';
import api from '../services/api';

type StatusFilter = 'all' | 'draft' | 'active' | 'inactive';

export default function Listings() {
  const qc = useQueryClient();
  const [selectedShop, setSelectedShop] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });

  const { data: listings = [], isLoading, refetch } = useQuery({
    queryKey: ['listings', selectedShop, statusFilter],
    queryFn: () => selectedShop
      ? listingsApi.list(selectedShop, statusFilter === 'all' ? undefined : statusFilter)
      : Promise.resolve([]),
    enabled: !!selectedShop,
  });

  const syncMutation = useMutation({
    mutationFn: () => listingsApi.sync(selectedShop),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      alert(`סונכרנו ${data.synced} מוצרים חדשים מ-Etsy`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => listingsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => listingsApi.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const filtered = listings.filter((l: any) => {
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((l: any) => selected.has(l.id));

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((l: any) => l.id)));
  };

  const bulkDelete = async () => {
    if (!confirm(`למחוק ${selected.size} מוצרים?`)) return;
    for (const id of selected) await deleteMutation.mutateAsync(id);
    setSelected(new Set());
  };

  const activeShop = shops.find((s: any) => s.id === selectedShop);

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-xl font-bold">מוצרים</h1>
        <Link to="/listing/new" className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> חדש
        </Link>
      </div>

      {/* Shop selector */}
      <select className="input mb-3 text-sm" value={selectedShop} onChange={e => { setSelectedShop(e.target.value); setSelected(new Set()); }}>
        <option value="">בחר חנות...</option>
        {shops.map((s: any) => (
          <option key={s.id} value={s.id}>{s.name} {s.status === 'connected' ? '✓' : ''}</option>
        ))}
      </select>

      {selectedShop && (
        <>
          {/* Filters bar */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute right-3 top-3 text-etsy-gray" />
              <input className="input pr-8 text-sm" placeholder="חפש מוצר..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input text-sm w-28" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">הכל</option>
              <option value="active">פעיל</option>
              <option value="draft">טיוטה</option>
              <option value="inactive">לא פעיל</option>
            </select>
          </div>

          {/* Actions bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={toggleAll} className="p-1">
                {allSelected ? <CheckSquare size={18} className="text-etsy-orange" /> : <Square size={18} className="text-etsy-gray" />}
              </button>
              {selected.size > 0 && (
                <button onClick={bulkDelete} className="text-red-500 text-xs flex items-center gap-1 border border-red-200 rounded px-2 py-1">
                  <Trash2 size={12} /> מחק ({selected.size})
                </button>
              )}
              <span className="text-xs text-etsy-gray">{filtered.length} מוצרים</span>
            </div>
            {activeShop?.status === 'connected' && (
              <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}
                className="flex items-center gap-1 text-xs btn-secondary py-1.5 px-3">
                <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
                סנכרן מ-Etsy
              </button>
            )}
          </div>

          {/* Listings */}
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <Package size={36} className="text-etsy-gray mx-auto mb-2" />
              <p className="text-etsy-gray text-sm">אין מוצרים</p>
              {activeShop?.status === 'connected' && (
                <button onClick={() => syncMutation.mutate()} className="btn-primary mt-3 text-sm">
                  סנכרן מ-Etsy
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((listing: any) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  shopId={selectedShop}
                  selected={selected.has(listing.id)}
                  onSelect={() => toggleSelect(listing.id)}
                  onDelete={() => { if (confirm('למחוק?')) deleteMutation.mutate(listing.id); }}
                  onPublish={() => publishMutation.mutate(listing.id)}
                  publishing={publishMutation.isPending && publishMutation.variables === listing.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!selectedShop && (
        <div className="card p-8 text-center mt-4">
          <Package size={40} className="text-etsy-gray mx-auto mb-3" />
          <p className="text-etsy-gray">בחר חנות לצפייה במוצרים</p>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing, selected, onSelect, onDelete, onPublish, publishing, shopId }: any) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { score } = calcSEOScore({
    title: listing.title || '',
    description: listing.description || '',
    tags: listing.tags || [],
    price: listing.price || 0,
    images: listing.images?.length || 0,
  });

  const scoreColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-400';

  const duplicateMutation = useMutation({
    mutationFn: () => api.post(`/listings/shop/${shopId}`, {
      title: listing.title + ' (עותק)',
      description: listing.description,
      price: listing.price,
      quantity: listing.quantity,
      tags: listing.tags,
      who_made: listing.who_made,
      when_made: listing.when_made,
      is_supply: listing.is_supply === 1,
    }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });

  const statusColor = {
    active: 'badge-green',
    draft: 'badge-gray',
    inactive: 'badge-orange',
  }[listing.status as string] || 'badge-gray';

  const statusLabel = { active: 'פעיל', draft: 'טיוטה', inactive: 'לא פעיל' }[listing.status as string] || listing.status;

  const firstImage = listing.images?.[0];

  return (
    <div className={`card overflow-hidden transition-all ${selected ? 'ring-2 ring-etsy-orange' : ''}`}>
      <div className="flex items-center gap-3 p-3">
        <button onClick={onSelect} className="flex-shrink-0">
          {selected ? <CheckSquare size={18} className="text-etsy-orange" /> : <Square size={18} className="text-etsy-gray" />}
        </button>

        {firstImage ? (
          <img src={firstImage} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-etsy-gray" />
          </div>
        )}

        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <p className="font-medium text-sm truncate">{listing.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-etsy-orange font-semibold text-sm">${listing.price?.toFixed(2)}</span>
            <span className={statusColor}>{statusLabel}</span>
            <span className={`text-xs font-medium flex items-center gap-0.5 ${scoreColor}`}>
              <BarChart2 size={10} />{score}
            </span>
          </div>
        </div>

        <button onClick={() => setExpanded(!expanded)}>
          <ChevronDown size={16} className={`text-etsy-gray transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-etsy-border px-3 pb-3 pt-2">
          {listing.description && (
            <p className="text-xs text-etsy-gray mb-2 line-clamp-2">{listing.description}</p>
          )}
          {listing.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {listing.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-orange-50 text-etsy-orange px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Link to={`/listing/${listing.id}/edit`} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1">
              <Edit3 size={13} /> ערוך
            </Link>
            {listing.status === 'draft' && (
              <button onClick={onPublish} disabled={publishing}
                className="flex-1 btn-primary text-sm flex items-center justify-center gap-1">
                <Send size={13} /> {publishing ? 'מפרסם...' : 'פרסם'}
              </button>
            )}
            <button onClick={() => duplicateMutation.mutate()} disabled={duplicateMutation.isPending}
              title="שכפל מוצר"
              className="p-2.5 rounded-lg border border-etsy-border text-etsy-gray">
              <Copy size={14} />
            </button>
            {listing.etsy_listing_id && (
              <a href={`https://www.etsy.com/listing/${listing.etsy_listing_id}`} target="_blank" rel="noopener noreferrer"
                className="p-2.5 rounded-lg border border-etsy-border text-etsy-gray">
                <ExternalLink size={14} />
              </a>
            )}
            <button onClick={onDelete} className="p-2.5 rounded-lg border border-red-200 text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
