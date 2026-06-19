import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Copy, Check, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';

interface Generated {
  title: string;
  description: string;
  tags: string[];
  price_suggestion: { min: number; max: number; recommended: number };
  seo_notes: string[];
}

export default function AIGenerator() {
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [style, setStyle] = useState('');
  const [material, setMaterial] = useState('');
  const [audience, setAudience] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post('/ai/generate', { keyword, style, material, audience }).then(r => r.data),
    onError: (err: any) => toast.error(err.message),
  });

  const data: Generated | null = mutation.data;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('הועתק!');
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = () => {
    if (!data) return;
    const text = `TITLE:\n${data.title}\n\nDESCRIPTION:\n${data.description}\n\nTAGS:\n${data.tags.join(', ')}`;
    navigator.clipboard.writeText(text);
    toast.success('הכל הועתק!');
  };

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center gap-2 mb-1 pt-2">
        <Sparkles size={20} className="text-etsy-orange" />
        <h1 className="text-xl font-bold">AI Generator</h1>
      </div>
      <p className="text-xs text-etsy-gray mb-4">יוצר כותרת, תיאור ותגיות מותאמי-SEO לEtsy</p>

      <div className="space-y-3 mb-4">
        <div>
          <label className="label">מוצר / מילת מפתח *</label>
          <input className="input" placeholder="למשל: handmade silver ring, wooden gift box..." value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && keyword && mutation.mutate()} />
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-sm text-etsy-orange">
          הגדרות מתקדמות {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">סגנון</label>
              <input className="input text-sm" placeholder="minimalist, boho, vintage..." value={style} onChange={e => setStyle(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">חומר</label>
              <input className="input text-sm" placeholder="gold, leather, wood..." value={material} onChange={e => setMaterial(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">קהל יעד</label>
              <input className="input text-sm" placeholder="women, men, couples, kids..." value={audience} onChange={e => setAudience(e.target.value)} />
            </div>
          </div>
        )}

        <button onClick={() => mutation.mutate()} disabled={!keyword || mutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <Wand2 size={16} />
          {mutation.isPending ? 'יוצר...' : 'צור listing'}
        </button>
      </div>

      {mutation.isPending && (
        <div className="card p-8 text-center">
          <div className="w-10 h-10 border-2 border-etsy-orange border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-etsy-gray text-sm">מנתח שוק ויוצר תוכן מותאם...</p>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">תוצאות</h2>
            <button onClick={copyAll} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
              <Copy size={12} /> העתק הכל
            </button>
          </div>

          {/* Title */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-etsy-orange uppercase tracking-wide">כותרת</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-etsy-gray">{data.title.length}/140</span>
                <button onClick={() => copyText(data.title, 'title')}
                  className="p-1 rounded text-etsy-gray">
                  {copied === 'title' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{data.title}</p>
          </div>

          {/* Tags */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-etsy-orange uppercase tracking-wide">תגיות ({data.tags.length}/13)</span>
              <button onClick={() => copyText(data.tags.join(', '), 'tags')}
                className="p-1 rounded text-etsy-gray">
                {copied === 'tags' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.tags.map(tag => (
                <span key={tag} onClick={() => copyText(tag, tag)}
                  className="text-xs bg-orange-50 text-etsy-orange px-2 py-1 rounded-full border border-orange-100 cursor-pointer active:scale-95 transition-transform">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="card p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-etsy-orange uppercase tracking-wide">תיאור</span>
              <button onClick={() => copyText(data.description, 'desc')}
                className="p-1 rounded text-etsy-gray">
                {copied === 'desc' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-etsy-gray whitespace-pre-line leading-relaxed">{data.description}</p>
          </div>

          {/* Price suggestion */}
          <div className="card p-3 bg-green-50 border-green-100">
            <p className="text-xs font-semibold text-green-700 mb-1">💰 הצעת מחיר (לפי שוק)</p>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-green-600">מינימום</p>
                <p className="font-bold text-green-700">${data.price_suggestion.min}</p>
              </div>
              <div className="flex-1 text-center bg-green-100 rounded-lg p-2">
                <p className="text-xs text-green-600">מומלץ</p>
                <p className="text-xl font-bold text-green-700">${data.price_suggestion.recommended}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-green-600">מקסימום</p>
                <p className="font-bold text-green-700">${data.price_suggestion.max}</p>
              </div>
            </div>
          </div>

          {/* SEO notes */}
          {data.seo_notes?.length > 0 && (
            <div className="card p-3 bg-blue-50 border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-1">💡 טיפי SEO</p>
              <ul className="space-y-1">
                {data.seo_notes.map((note, i) => (
                  <li key={i} className="text-xs text-blue-600 flex gap-1">
                    <span>•</span>{note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
