import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { shopsApi, listingsApi } from '../services/api';
import { calcSEOScore } from '../components/SEOScore';
import { useNavigate } from 'react-router-dom';

export default function SEOAudit() {
  const navigate = useNavigate();
  const [selectedShop, setSelectedShop] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score_asc' | 'score_desc'>('score_asc');

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['listings', selectedShop],
    queryFn: () => listingsApi.list(selectedShop),
    enabled: !!selectedShop,
  });

  const scored = (listings as any[]).map((l: any) => ({
    ...l,
    ...calcSEOScore({
      title: l.title || '',
      description: l.description || '',
      tags: l.tags || [],
      price: l.price || 0,
      images: l.images?.length || 0,
    }),
  }));

  const sorted = [...scored].sort((a, b) =>
    sortBy === 'score_asc' ? a.score - b.score : b.score - a.score
  );

  const avg = scored.length ? Math.round(scored.reduce((s, l) => s + l.score, 0) / scored.length) : 0;
  const critical = scored.filter(l => l.score < 50).length;
  const good = scored.filter(l => l.score >= 80).length;

  const scoreColor = (s: number) => s >= 80 ? 'text-green-600 bg-green-50' : s >= 50 ? 'text-orange-500 bg-orange-50' : 'text-red-500 bg-red-50';
  const barColor = (s: number) => s >= 80 ? 'bg-green-500' : s >= 50 ? 'bg-orange-500' : 'bg-red-400';

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center gap-2 mb-1 pt-2">
        <ShieldCheck size={20} className="text-etsy-orange" />
        <h1 className="text-xl font-bold">SEO Audit</h1>
      </div>
      <p className="text-xs text-etsy-gray mb-4">סריקת כל המוצרים וזיהוי נקודות לשיפור SEO</p>

      <select className="input mb-4 text-sm" value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
        <option value="">בחר חנות...</option>
        {(shops as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {selectedShop && !isLoading && scored.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-etsy-orange">{avg}</p>
              <p className="text-xs text-etsy-gray">ממוצע</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-red-500">{critical}</p>
              <p className="text-xs text-etsy-gray">קריטי</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xl font-bold text-green-600">{good}</p>
              <p className="text-xs text-etsy-gray">מצוין</p>
            </div>
          </div>

          {/* Sort */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSortBy('score_asc')}
              className={`text-xs px-3 py-1.5 rounded-full border ${sortBy === 'score_asc' ? 'bg-etsy-orange text-white border-etsy-orange' : 'border-etsy-border text-etsy-gray'}`}>
              הכי חלש קודם
            </button>
            <button onClick={() => setSortBy('score_desc')}
              className={`text-xs px-3 py-1.5 rounded-full border ${sortBy === 'score_desc' ? 'bg-etsy-orange text-white border-etsy-orange' : 'border-etsy-border text-etsy-gray'}`}>
              הכי חזק קודם
            </button>
          </div>

          {/* Listings */}
          <div className="space-y-2">
            {sorted.map((l: any) => (
              <div key={l.id} className="card overflow-hidden">
                <div className="p-3 cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`text-sm font-bold px-2 py-1 rounded-lg min-w-[44px] text-center ${scoreColor(l.score)}`}>
                      {l.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium">{l.title || 'ללא כותרת'}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                        <div className={`h-1.5 rounded-full ${barColor(l.score)}`} style={{ width: `${l.score}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {l.score < 50 && <AlertTriangle size={14} className="text-red-400" />}
                      {expanded === l.id ? <ChevronUp size={16} className="text-etsy-gray" /> : <ChevronDown size={16} className="text-etsy-gray" />}
                    </div>
                  </div>
                </div>

                {expanded === l.id && (
                  <div className="border-t border-etsy-border px-3 pb-3">
                    <div className="pt-3 space-y-1.5">
                      {l.checks.map((c: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`text-sm flex-shrink-0 ${c.pass ? 'text-green-500' : 'text-red-400'}`}>
                            {c.pass ? '✓' : '✗'}
                          </span>
                          <div>
                            <p className={`text-xs ${c.pass ? 'text-green-700' : 'text-red-600'} font-medium`}>{c.label}</p>
                            {!c.pass && <p className="text-xs text-etsy-gray">{c.tip}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => navigate(`/listing/${l.id}/edit`)}
                      className="btn-primary text-xs w-full mt-3 flex items-center justify-center gap-1">
                      <TrendingUp size={12} /> תקן עכשיו
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}
        </div>
      )}

      {!selectedShop && (
        <div className="card p-8 text-center mt-4">
          <ShieldCheck size={40} className="text-etsy-gray mx-auto mb-3" />
          <p className="text-etsy-gray text-sm">בחר חנות לסריקת SEO</p>
        </div>
      )}
    </div>
  );
}
