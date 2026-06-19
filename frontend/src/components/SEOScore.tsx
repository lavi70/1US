interface Props {
  title: string;
  description: string;
  tags: string[];
  price: number;
  images: number;
}

interface Check {
  label: string;
  pass: boolean;
  tip: string;
}

export function calcSEOScore(p: Props): { score: number; checks: Check[] } {
  const checks: Check[] = [
    {
      label: 'כותרת 80-140 תווים',
      pass: p.title.length >= 80 && p.title.length <= 140,
      tip: `${p.title.length}/140 — כותרת ארוכה מדרגת יותר בחיפוש`,
    },
    {
      label: 'כותרת מכילה מילות מפתח',
      pass: p.title.split(' ').length >= 5,
      tip: 'הכנס לפחות 5 מילות מפתח בכותרת',
    },
    {
      label: '13 תגיות',
      pass: p.tags.length === 13,
      tip: `${p.tags.length}/13 — השתמש בכל 13 תגיות`,
    },
    {
      label: 'תגיות עם 2+ מילות מפתח',
      pass: p.tags.filter(t => t.includes(' ')).length >= 5,
      tip: 'לפחות 5 תגיות צריכות להיות ביטויים (2 מילים+)',
    },
    {
      label: 'תיאור 300+ תווים',
      pass: p.description.length >= 300,
      tip: `${p.description.length}/300 — תיאור ארוך מגביר המרה`,
    },
    {
      label: 'לפחות 5 תמונות',
      pass: p.images >= 5,
      tip: `${p.images} תמונות — Etsy ממליץ על 5-10 תמונות`,
    },
    {
      label: 'מחיר הגיוני ($1-$999)',
      pass: p.price >= 1 && p.price <= 999,
      tip: 'מחיר חריג עלול להפחית חשיפה',
    },
  ];

  const score = Math.round((checks.filter(c => c.pass).length / checks.length) * 100);
  return { score, checks };
}

export default function SEOScore({ title, description, tags, price, images }: Props) {
  const { score, checks } = calcSEOScore({ title, description, tags, price, images });

  const color = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-orange-500' : 'text-red-500';
  const bgColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-orange-500' : 'bg-red-500';
  const label = score >= 80 ? 'מצוין' : score >= 50 ? 'בינוני' : 'חלש';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">ניקוד SEO</h3>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${color}`}>{score}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full text-white ${bgColor}`}>{label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div className={`h-2 rounded-full transition-all ${bgColor}`} style={{ width: `${score}%` }} />
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`text-base flex-shrink-0 ${c.pass ? 'text-green-500' : 'text-gray-300'}`}>
              {c.pass ? '✓' : '○'}
            </span>
            <div className="min-w-0">
              <p className={`text-xs font-medium ${c.pass ? 'text-green-700' : 'text-etsy-gray'}`}>{c.label}</p>
              {!c.pass && <p className="text-xs text-etsy-gray mt-0.5">{c.tip}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
