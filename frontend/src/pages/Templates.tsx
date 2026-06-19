import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import api from '../services/api';

interface Template {
  id: string;
  name: string;
  title: string;
  description: string;
  price: number;
  tags: string[];
  who_made: string;
  when_made: string;
  is_supply: number;
  created_at: number;
}

function useTemplates() {
  return useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
  });
}

export default function Templates() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useTemplates();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState({
    name: '', title: '', description: '', price: '',
    tags: [] as string[], who_made: 'i_did', when_made: 'made_to_order', is_supply: false,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/templates', { ...form, price: parseFloat(form.price) || 0 }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setShowForm(false); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });

  const resetForm = () => setForm({ name: '', title: '', description: '', price: '', tags: [], who_made: 'i_did', when_made: 'made_to_order', is_supply: false });

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && form.tags.length < 13 && !form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag] }));
      setTagInput('');
    }
  };

  const loadTemplate = (tpl: Template) => {
    setForm({
      name: tpl.name + ' (עותק)',
      title: tpl.title,
      description: tpl.description,
      price: String(tpl.price),
      tags: tpl.tags,
      who_made: tpl.who_made,
      when_made: tpl.when_made,
      is_supply: tpl.is_supply === 1,
    });
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-xl font-bold">תבניות</h1>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="btn-primary flex items-center gap-1 text-sm">
          <Plus size={16} /> חדשה
        </button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4">
          <h3 className="font-semibold mb-3">תבנית חדשה</h3>
          <div className="space-y-3">
            <div>
              <label className="label">שם התבנית *</label>
              <input className="input" placeholder="למשל: תכשיטים כסף" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">כותרת מוצר</label>
              <input className="input" placeholder="כותרת בסיסית..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={140} />
            </div>
            <div>
              <label className="label">תיאור</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">מחיר ברירת מחדל</label>
                <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="label">מי יצר</label>
                <select className="input" value={form.who_made} onChange={e => setForm(f => ({ ...f, who_made: e.target.value }))}>
                  <option value="i_did">אני</option>
                  <option value="someone_else">אחר</option>
                  <option value="collective">קולקטיב</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-1"><Tag size={13} />תגיות ({form.tags.length}/13)</label>
              <div className="flex gap-2 mb-2">
                <input className="input flex-1 text-sm" placeholder="הוסף תגית..." value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                <button onClick={addTag} className="btn-secondary px-3 text-sm">+</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.tags.map(tag => (
                  <span key={tag} onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                    className="flex items-center gap-1 bg-orange-50 text-etsy-orange text-xs px-2 py-1 rounded-full cursor-pointer border border-orange-100">
                    {tag} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="btn-primary flex-1">
                {createMutation.isPending ? 'שומר...' : 'שמור תבנית'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary px-4">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-gray-100" />)}</div>
      ) : templates.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-etsy-gray text-sm mb-2">אין תבניות עדיין</p>
          <p className="text-xs text-etsy-gray">צור תבנית כדי לחסוך זמן בהעלאת מוצרים דומים</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tpl => (
            <div key={tpl.id} className="card overflow-hidden">
              <div className="p-3 flex items-center gap-3" onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}>
                <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center text-sm font-bold text-etsy-orange flex-shrink-0">
                  {tpl.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{tpl.name}</p>
                  <p className="text-xs text-etsy-gray">{tpl.tags?.length || 0} תגיות · ${tpl.price || 0}</p>
                </div>
                {expandedId === tpl.id ? <ChevronUp size={15} className="text-etsy-gray" /> : <ChevronDown size={15} className="text-etsy-gray" />}
              </div>

              {expandedId === tpl.id && (
                <div className="border-t border-etsy-border px-3 pb-3 pt-2 space-y-2">
                  {tpl.title && <p className="text-sm text-etsy-gray line-clamp-1">כותרת: {tpl.title}</p>}
                  {tpl.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tpl.tags.map(tag => (
                        <span key={tag} className="text-xs bg-orange-50 text-etsy-orange px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => loadTemplate(tpl)} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1">
                      <Copy size={13} /> שכפל
                    </button>
                    <button onClick={() => { if (confirm('למחוק?')) deleteMutation.mutate(tpl.id); }}
                      className="p-2.5 rounded-lg border border-red-200 text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
