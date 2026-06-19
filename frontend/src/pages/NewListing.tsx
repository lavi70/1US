import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, X, Send, Tag, DollarSign, ArrowRight, Package } from 'lucide-react';
import { shopsApi, listingsApi } from '../services/api';
import api from '../services/api';
import SEOScore from '../components/SEOScore';

const WHO_MADE = [
  { value: 'i_did', label: 'אני הכנתי' },
  { value: 'someone_else', label: 'מישהו אחר' },
  { value: 'collective', label: 'קולקטיב' },
];

const WHEN_MADE = [
  { value: 'made_to_order', label: 'להזמנה' },
  { value: '2020_2024', label: '2020-2024' },
  { value: '2010_2019', label: '2010-2019' },
  { value: 'before_2010', label: 'לפני 2010' },
  { value: '1990_1999', label: '1990-1999' },
  { value: '1980s', label: '1980s' },
  { value: '1970s', label: '1970s' },
  { value: 'before_1970', label: 'לפני 1970' },
];

export default function NewListing() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState({
    shop_id: '',
    title: '',
    description: '',
    price: '',
    quantity: '1',
    tags: [] as string[],
    who_made: 'i_did',
    when_made: 'made_to_order',
    is_supply: false,
    shipping_profile_id: '',
  });

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const connectedShops = shops.filter((s: any) => s.status === 'connected');

  // Load existing listing for edit mode
  useEffect(() => {
    if (!editId) return;
    api.get(`/listings/shop/all`).catch(() => null);
    // Find listing across all shops
    Promise.all(shops.map((s: any) =>
      api.get(`/listings/shop/${s.id}`).then(r => r.data).catch(() => [])
    )).then(results => {
      const all = results.flat();
      const listing = all.find((l: any) => l.id === editId);
      if (!listing) return;
      setForm({
        shop_id: listing.shop_id,
        title: listing.title,
        description: listing.description || '',
        price: String(listing.price),
        quantity: String(listing.quantity),
        tags: listing.tags || [],
        who_made: listing.who_made || 'i_did',
        when_made: listing.when_made || 'made_to_order',
        is_supply: listing.is_supply === 1,
        shipping_profile_id: listing.shipping_profile_id || '',
      });
      setExistingImages(listing.images || []);
      setStep(2); // Start at details step for editing
    });
  }, [editId, shops.length]);

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.slice(0, 10 - images.length);
    setImages(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setImagePreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }, [images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    maxFiles: 10,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isEdit && editId) {
        await listingsApi.update(editId, {
          ...form,
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity),
        });
        for (const img of images) await listingsApi.uploadImage(editId, img);
        return { id: editId };
      }
      const listing = await listingsApi.create(form.shop_id, {
        ...form,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
      });
      for (const img of images) await listingsApi.uploadImage(listing.id, img);
      return listing;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      navigate('/');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const listing = await listingsApi.create(form.shop_id, {
        ...form,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity),
      });
      for (const img of images) {
        await listingsApi.uploadImage(listing.id, img);
      }
      return listingsApi.publish(listing.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      navigate('/');
    },
  });

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, ' ');
    if (tag && form.tags.length < 13 && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] });
      setTagInput('');
    }
  };

  const removeTag = (t: string) => setForm({ ...form, tags: form.tags.filter(x => x !== t) });

  const steps = [
    { n: 1, label: 'תמונות' },
    { n: 2, label: 'פרטים' },
    { n: 3, label: 'תגיות' },
    { n: 4, label: 'פרסום' },
  ];

  return (
    <div className="p-4 safe-top max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4 pt-2">
        <button onClick={() => navigate(-1)} className="p-1 text-etsy-gray"><ArrowRight size={20} /></button>
        <h1 className="text-xl font-bold">{isEdit ? 'עריכת מוצר' : 'מוצר חדש'}</h1>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 mb-6">
        {steps.map(({ n, label }, i) => (
          <div key={n} className="flex items-center flex-1">
            <button onClick={() => setStep(n)} className={`flex items-center gap-1 text-xs font-medium ${step >= n ? 'text-etsy-orange' : 'text-etsy-gray'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step > n ? 'bg-etsy-orange text-white' : step === n ? 'bg-etsy-orange text-white' : 'bg-gray-200 text-gray-500'}`}>{n}</span>
              <span className="hidden sm:block">{label}</span>
            </button>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step > n ? 'bg-etsy-orange' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Images */}
      {step === 1 && (
        <div className="space-y-4">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-etsy-orange bg-orange-50' : 'border-etsy-border'}`}>
            <input {...getInputProps()} />
            <Image size={32} className="text-etsy-gray mx-auto mb-2" />
            <p className="font-medium">גרור תמונות לכאן</p>
            <p className="text-sm text-etsy-gray">או לחץ לבחירה • עד 10 תמונות</p>
          </div>
          {(existingImages.length > 0 || imagePreviews.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {existingImages.map((src, i) => (
                <div key={`existing-${i}`} className="relative aspect-square">
                  <img src={src} className="w-full h-full object-cover rounded-lg" alt="" />
                  <button onClick={() => setExistingImages(p => p.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                    <X size={10} className="text-white" />
                  </button>
                  {i === 0 && imagePreviews.length === 0 && <span className="absolute bottom-1 left-1 text-xs bg-etsy-orange text-white px-1 rounded">ראשי</span>}
                </div>
              ))}
              {imagePreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative aspect-square">
                  <img src={src} className="w-full h-full object-cover rounded-lg" alt="" />
                  <button onClick={() => { setImages(p => p.filter((_, j) => j !== i)); setImagePreviews(p => p.filter((_, j) => j !== i)); }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                    <X size={10} className="text-white" />
                  </button>
                  {i === 0 && existingImages.length === 0 && <span className="absolute bottom-1 left-1 text-xs bg-etsy-orange text-white px-1 rounded">ראשי</span>}
                  <span className="absolute top-1 left-1 text-xs bg-blue-500 text-white px-1 rounded">חדש</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setStep(2)} className="btn-primary w-full">הבא</button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="label">כותרת המוצר *</label>
            <input className="input" placeholder="שם מוצר מפורט ומדויק..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={140} />
            <p className="text-xs text-etsy-gray mt-1">{form.title.length}/140</p>
          </div>
          <div>
            <label className="label">תיאור *</label>
            <textarea className="input" rows={4} placeholder="תאר את המוצר שלך בפירוט..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1"><DollarSign size={14} />מחיר (USD) *</label>
              <input className="input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Package size={14} />כמות</label>
              <input className="input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מי יצר?</label>
              <select className="input" value={form.who_made} onChange={e => setForm({ ...form, who_made: e.target.value })}>
                {WHO_MADE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">מתי?</label>
              <select className="input" value={form.when_made} onChange={e => setForm({ ...form, when_made: e.target.value })}>
                {WHEN_MADE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="supply" checked={form.is_supply} onChange={e => setForm({ ...form, is_supply: e.target.checked })} className="w-4 h-4 accent-etsy-orange" />
            <label htmlFor="supply" className="text-sm">זה חומר גלם / ציוד</label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">חזור</button>
            <button onClick={() => setStep(3)} disabled={!form.title || !form.price} className="btn-primary flex-1">הבא</button>
          </div>
        </div>
      )}

      {/* Step 3: Tags */}
      {step === 3 && (
        <TagStep
          tags={form.tags}
          setTags={tags => setForm(f => ({ ...f, tags }))}
          titleKeyword={form.title.split(' ').slice(0, 3).join(' ')}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {/* Step 4: Publish */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label className="label">בחר חנות *</label>
            {connectedShops.length === 0 ? (
              <div className="card p-4 text-center">
                <p className="text-sm text-etsy-gray">אין חנויות מחוברות. חבר חנות תחילה.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {connectedShops.map((s: any) => (
                  <label key={s.id} className={`flex items-center gap-3 card p-3 cursor-pointer ${form.shop_id === s.id ? 'border-etsy-orange' : ''}`}>
                    <input type="radio" name="shop" value={s.id} checked={form.shop_id === s.id}
                      onChange={() => setForm({ ...form, shop_id: s.id })} className="accent-etsy-orange" />
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-etsy-gray">{s.etsy_shop_id}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* SEO Score */}
          <SEOScore
            title={form.title}
            description={form.description}
            tags={form.tags}
            price={parseFloat(form.price) || 0}
            images={images.length + existingImages.length}
          />

          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="btn-secondary flex-1">חזור</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()} disabled={!form.shop_id || createMutation.isPending || publishMutation.isPending} className="btn-secondary flex-1">
              {createMutation.isPending ? 'שומר...' : 'שמור כטיוטה'}
            </button>
            <button onClick={() => publishMutation.mutate()} disabled={!form.shop_id || !form.title || !form.price || createMutation.isPending || publishMutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-1">
              <Send size={15} />
              {publishMutation.isPending ? 'מפרסם...' : 'פרסם עכשיו'}
            </button>
          </div>

          {(createMutation.isError || publishMutation.isError) && (
            <p className="text-red-500 text-sm text-center">
              {(createMutation.error || publishMutation.error)?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TagStep({ tags, setTags, titleKeyword, onBack, onNext }: {
  tags: string[]; setTags: (t: string[]) => void;
  titleKeyword: string; onBack: () => void; onNext: () => void;
}) {
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<{ tag: string; count: number }[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase().slice(0, 20);
    if (t && tags.length < 13 && !tags.includes(t)) setTags([...tags, t]);
  };

  const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

  const loadSuggestions = async () => {
    if (!titleKeyword) return;
    setLoadingSugg(true);
    try {
      const res = await api.post('/ai/suggest-tags', { keyword: titleKeyword, existing_tags: tags });
      setSuggestions(res.data.suggestions || []);
    } catch {}
    setLoadingSugg(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label flex items-center gap-1"><Tag size={14} />תגיות ({tags.length}/13)</label>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="הוסף תגית..." value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); setTagInput(''); } }}
            maxLength={20} />
          <button onClick={() => { addTag(tagInput); setTagInput(''); }} className="btn-secondary px-3">+</button>
        </div>
        <p className="text-xs text-etsy-gray mt-1">עד 13 תגיות, עד 20 תווים כל אחת</p>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 bg-orange-50 text-etsy-orange text-sm px-2 py-1 rounded-full border border-orange-200">
              {tag}
              <button onClick={() => removeTag(tag)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Smart suggestions */}
      <div className="card p-3 bg-blue-50 border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-blue-700">💡 הצעות חכמות מהשוק</p>
          <button onClick={loadSuggestions} disabled={loadingSugg || tags.length >= 13}
            className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-1">
            {loadingSugg ? '...' : 'טען'}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.filter(s => !tags.includes(s.tag)).slice(0, 15).map(s => (
              <button key={s.tag} onClick={() => addTag(s.tag)} disabled={tags.length >= 13}
                className="text-xs bg-white text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full hover:bg-blue-50 disabled:opacity-40">
                + {s.tag}
              </button>
            ))}
          </div>
        )}
        {suggestions.length === 0 && !loadingSugg && (
          <p className="text-xs text-blue-500">לחץ "טען" לקבלת הצעות על בסיס מחקר שוק</p>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="btn-secondary flex-1">חזור</button>
        <button onClick={onNext} className="btn-primary flex-1">הבא</button>
      </div>
    </div>
  );
}
