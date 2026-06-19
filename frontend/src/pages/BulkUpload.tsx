import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, XCircle, AlertCircle, Download, ChevronRight } from 'lucide-react';
import { shopsApi, listingsApi } from '../services/api';

interface CSVRow {
  title: string;
  description: string;
  price: string;
  quantity: string;
  tags: string;
  who_made: string;
  when_made: string;
  is_supply: string;
}

type RowStatus = 'pending' | 'uploading' | 'done' | 'error';

interface RowState extends CSVRow {
  idx: number;
  status: RowStatus;
  error?: string;
  listingId?: string;
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
    });
    return obj as unknown as CSVRow;
  }).filter(r => r.title);
}

const CSV_TEMPLATE = `title,description,price,quantity,tags,who_made,when_made,is_supply
"Handmade Silver Ring","Beautiful handcrafted silver ring",29.99,5,"silver ring,handmade jewelry,gift",i_did,made_to_order,false
"Custom Wood Sign","Personalized wooden sign for home",45.00,10,"wood sign,custom,home decor",i_did,made_to_order,false`;

export default function BulkUpload() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<RowState[]>([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [publish, setPublish] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list });
  const connectedShops = shops.filter((s: any) => s.status === 'connected');

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed.map((r, idx) => ({ ...r, idx, status: 'pending' })));
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    maxFiles: 1,
  });

  const runUpload = async () => {
    if (!selectedShop || rows.length === 0) return;
    setRunning(true);
    setProgress(0);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setRows(prev => prev.map(r => r.idx === row.idx ? { ...r, status: 'uploading' } : r));

      try {
        const tags = row.tags ? row.tags.split('|').map(t => t.trim()).filter(Boolean).slice(0, 13) : [];
        const listing = await listingsApi.create(selectedShop, {
          title: row.title,
          description: row.description || '',
          price: parseFloat(row.price) || 0,
          quantity: parseInt(row.quantity) || 1,
          tags,
          who_made: row.who_made || 'i_did',
          when_made: row.when_made || 'made_to_order',
          is_supply: row.is_supply === 'true',
        });

        if (publish) {
          await listingsApi.publish(listing.id);
        }

        setRows(prev => prev.map(r => r.idx === row.idx ? { ...r, status: 'done', listingId: listing.id } : r));
      } catch (err: any) {
        setRows(prev => prev.map(r => r.idx === row.idx ? { ...r, status: 'error', error: err.message } : r));
      }

      setProgress(Math.round(((i + 1) / rows.length) * 100));
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setRunning(false);
    qc.invalidateQueries({ queryKey: ['listings'] });
  };

  const doneCount = rows.filter(r => r.status === 'done').length;
  const errorCount = rows.filter(r => r.status === 'error').length;
  const pendingCount = rows.filter(r => r.status === 'pending').length;

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'etsy_listings_template.csv';
    a.click();
  };

  return (
    <div className="p-4 safe-top">
      <h1 className="text-xl font-bold mb-4 pt-2">העלאה מרובה</h1>

      {/* Template download */}
      <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-etsy-orange mb-4 card px-3 py-2 w-full">
        <Download size={15} /> הורד תבנית CSV
        <ChevronRight size={14} className="mr-auto" />
      </button>

      {/* CSV format help */}
      <div className="card p-3 mb-4 bg-blue-50 border-blue-100">
        <p className="text-xs font-medium text-blue-700 mb-1">פורמט CSV</p>
        <p className="text-xs text-blue-600">
          עמודות: <code>title, description, price, quantity, tags, who_made, when_made, is_supply</code>
          <br />תגיות מופרדות ב-| (מקף אנכי)
        </p>
      </div>

      {/* Drop zone */}
      {rows.length === 0 && (
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer mb-4 transition-colors ${isDragActive ? 'border-etsy-orange bg-orange-50' : 'border-etsy-border'}`}>
          <input {...getInputProps()} />
          <Upload size={32} className="text-etsy-gray mx-auto mb-2" />
          <p className="font-medium">גרור קובץ CSV לכאן</p>
          <p className="text-sm text-etsy-gray">או לחץ לבחירה</p>
        </div>
      )}

      {/* Rows preview */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">{rows.length} מוצרים נטענו</p>
            <button onClick={() => setRows([])} className="text-xs text-red-400">נקה</button>
          </div>

          {/* Progress bar */}
          {running && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-etsy-gray mb-1">
                <span>מעלה...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-etsy-orange h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Summary when done */}
          {!running && (doneCount > 0 || errorCount > 0) && (
            <div className="flex gap-2 mb-3">
              {doneCount > 0 && <span className="badge-green">✓ {doneCount} הועלו</span>}
              {errorCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">✗ {errorCount} נכשלו</span>}
              {pendingCount > 0 && <span className="badge-gray">{pendingCount} ממתינים</span>}
            </div>
          )}

          {/* Rows list */}
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {rows.map(row => (
              <div key={row.idx} className="card p-3 flex items-center gap-3">
                <StatusIcon status={row.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.title}</p>
                  <p className="text-xs text-etsy-gray">${row.price} · כמות {row.quantity}</p>
                  {row.error && <p className="text-xs text-red-500 mt-0.5">{row.error}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Config */}
          <div className="card p-3 mb-3">
            <div className="mb-3">
              <label className="label text-sm">חנות יעד *</label>
              <select className="input text-sm" value={selectedShop} onChange={e => setSelectedShop(e.target.value)}>
                <option value="">בחר חנות...</option>
                {connectedShops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} className="accent-etsy-orange w-4 h-4" />
              פרסם ישירות ל-Etsy (לא כטיוטה)
            </label>
          </div>

          <button
            onClick={runUpload}
            disabled={!selectedShop || running || pendingCount === 0}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            {running ? `מעלה... ${progress}%` : `העלה ${pendingCount} מוצרים`}
          </button>
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: RowStatus }) {
  if (status === 'done') return <CheckCircle size={18} className="text-green-500 flex-shrink-0" />;
  if (status === 'error') return <XCircle size={18} className="text-red-500 flex-shrink-0" />;
  if (status === 'uploading') return <div className="w-4 h-4 border-2 border-etsy-orange border-t-transparent rounded-full animate-spin flex-shrink-0" />;
  return <AlertCircle size={18} className="text-gray-300 flex-shrink-0" />;
}
