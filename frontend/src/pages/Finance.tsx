import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  CreditCard, Building2, Globe, DollarSign, Landmark, Eye, EyeOff,
  ArrowUpCircle, ArrowDownCircle, List, ArrowLeft, TrendingUp, TrendingDown,
  ArrowRightLeft, Search, Download, PieChart as PieIcon, BarChart2
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend
} from 'recharts';
import { useToast } from '../components/Toast';

/* ─────────────── Types ─────────────── */

type AccountType = 'paypal' | 'bank_il' | 'bank_us' | 'bank_eu' | 'crypto' | 'other';
type TxType = 'income' | 'expense' | 'transfer';

interface Transaction {
  id: string;
  accountId: string;
  type: TxType;
  amount: number;
  note: string;
  category: string;
  date: string;
  transferToId?: string;
}

interface Account {
  id: string;
  type: AccountType;
  name: string;
  balance: number;
  currency: string;
  details: Record<string, string>;
  color: string;
  createdAt: string;
}

/* ─────────────── Constants ─────────────── */

const ACCOUNT_TYPES: {
  type: AccountType;
  label: string;
  icon: React.ReactNode;
  color: string;
  currency: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}[] = [
  {
    type: 'paypal', label: 'PayPal', icon: <Globe size={18} />, color: '#003087', currency: 'USD',
    fields: [
      { key: 'email', label: 'אימייל', placeholder: 'name@example.com' },
      { key: 'phone', label: 'טלפון (אופציונלי)', placeholder: '+972...' },
    ],
  },
  {
    type: 'bank_il', label: 'בנק ישראלי', icon: <Building2 size={18} />, color: '#1a56db', currency: 'ILS',
    fields: [
      { key: 'bank_name', label: 'שם הבנק', placeholder: 'לאומי / הפועלים / דיסקונט...' },
      { key: 'branch', label: 'מספר סניף', placeholder: '123' },
      { key: 'account', label: 'מספר חשבון', placeholder: '12345678', secret: true },
      { key: 'owner', label: 'שם בעל החשבון', placeholder: 'ישראל ישראלי' },
    ],
  },
  {
    type: 'bank_us', label: 'בנק אמריקאי', icon: <Landmark size={18} />, color: '#057a55', currency: 'USD',
    fields: [
      { key: 'bank_name', label: 'Bank Name', placeholder: 'Chase / Bank of America...' },
      { key: 'routing', label: 'Routing Number', placeholder: '021000021', secret: true },
      { key: 'account', label: 'Account Number', placeholder: '000123456789', secret: true },
      { key: 'owner', label: 'Account Holder', placeholder: 'John Doe' },
    ],
  },
  {
    type: 'bank_eu', label: 'בנק אירופאי', icon: <CreditCard size={18} />, color: '#7e3af2', currency: 'EUR',
    fields: [
      { key: 'bank_name', label: 'Bank Name', placeholder: 'N26 / Wise / Revolut...' },
      { key: 'iban', label: 'IBAN', placeholder: 'DE89 3704 0044 0532 0130 00', secret: true },
      { key: 'swift', label: 'SWIFT/BIC', placeholder: 'COBADEFFXXX' },
      { key: 'owner', label: 'Account Holder', placeholder: 'John Doe' },
    ],
  },
  {
    type: 'crypto', label: 'קריפטו', icon: <DollarSign size={18} />, color: '#f59e0b', currency: 'USD',
    fields: [
      { key: 'platform', label: 'פלטפורמה', placeholder: 'Binance / Coinbase / MetaMask...' },
      { key: 'address', label: 'כתובת ארנק', placeholder: '0x...', secret: true },
      { key: 'coin', label: 'מטבע עיקרי', placeholder: 'BTC / ETH / USDT...' },
    ],
  },
  {
    type: 'other', label: 'אחר', icon: <Wallet size={18} />, color: '#6b7280', currency: 'USD',
    fields: [
      { key: 'description', label: 'תיאור', placeholder: 'תיאור החשבון' },
      { key: 'details', label: 'פרטים', placeholder: 'מידע נוסף...' },
    ],
  },
];

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDT'];
const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: '₪', USD: '$', EUR: '€', GBP: '£', BTC: '₿', ETH: 'Ξ', USDT: '$',
};
const INCOME_CATS = ['משכורת', 'מכירה', 'העברה', 'החזר', 'השקעה', 'מתנה', 'אחר'];
const EXPENSE_CATS = ['קניות', 'אוכל', 'תחבורה', 'שירותים', 'שכר דירה', 'בריאות', 'בידור', 'עמלה', 'אחר'];
const COLORS = ['#003087', '#1a56db', '#057a55', '#7e3af2', '#f59e0b', '#ef4444', '#6b7280', '#F1641E'];
const PIE_COLORS = ['#F1641E', '#ef4444', '#f59e0b', '#7e3af2', '#1a56db', '#057a55', '#003087', '#6b7280'];

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function loadAccounts(): Account[] {
  try { return JSON.parse(localStorage.getItem('finance_accounts') ?? '[]'); } catch { return []; }
}
function loadTxs(): Transaction[] {
  try { return JSON.parse(localStorage.getItem('finance_txs') ?? '[]'); } catch { return []; }
}

/* ─────────────── Transfer form ─────────────── */

function TransferForm({
  accounts,
  onSave,
  onCancel,
}: {
  accounts: Account[];
  onSave: (txs: [Omit<Transaction, 'id'>, Omit<Transaction, 'id'>]) => void;
  onCancel: () => void;
}) {
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '');
  const [toId, setToId] = useState(accounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const fromAcc = accounts.find(a => a.id === fromId);
  const toAcc = accounts.find(a => a.id === toId);

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0 || fromId === toId) return;
    const base = { type: 'transfer' as TxType, amount: n, note: note.trim() || 'העברה', category: 'העברה', date };
    onSave([
      { ...base, accountId: fromId, transferToId: toId },
      { ...base, accountId: toId, type: 'income', transferToId: fromId },
    ]);
  };

  return (
    <div className="card p-4 mb-4">
      <h2 className="font-semibold mb-4 flex items-center gap-2">
        <ArrowRightLeft size={16} className="text-etsy-orange" /> העברה בין חשבונות
      </h2>
      <div className="flex gap-2 mb-3 items-end">
        <div className="flex-1">
          <label className="label text-xs">מחשבון</label>
          <select className="input" value={fromId} onChange={e => setFromId(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <ArrowRightLeft size={18} className="text-etsy-gray mb-2.5 flex-shrink-0" />
        <div className="flex-1">
          <label className="label text-xs">לחשבון</label>
          <select className="input" value={toId} onChange={e => setToId(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>
      {fromAcc && toAcc && fromAcc.currency !== toAcc.currency && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          שים לב: החשבונות במטבעות שונים ({fromAcc.currency} → {toAcc.currency})
        </p>
      )}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="label text-xs">סכום {fromAcc ? `(${CURRENCY_SYMBOLS[fromAcc.currency] ?? fromAcc.currency})` : ''}</label>
          <input className="input" type="number" min="0" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="flex-1">
          <label className="label text-xs">הערה</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="תיאור..." />
        </div>
      </div>
      <div className="mb-4">
        <label className="label text-xs">תאריך</label>
        <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={fromId === toId}
          className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
          <Check size={16} /> בצע העברה
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
          <X size={16} /> ביטול
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Transaction form ─────────────── */

function TxForm({
  account, onSave, onCancel,
}: {
  account: Account;
  onSave: (tx: Omit<Transaction, 'id'>) => void;
  onCancel: () => void;
}) {
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;
  const [type, setType] = useState<TxType>('income');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onSave({ accountId: account.id, type, amount: n, note: note.trim(), category: category || cats[cats.length - 1], date });
  };

  return (
    <div className="card p-4 mb-3">
      <h3 className="font-semibold mb-3 text-sm">הוספת תנועה — {account.name}</h3>
      <div className="flex rounded-lg overflow-hidden border border-etsy-border mb-3">
        <button onClick={() => setType('income')}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${type === 'income' ? 'bg-green-500 text-white' : 'bg-white text-etsy-gray'}`}>
          <ArrowDownCircle size={15} /> הכנסה
        </button>
        <button onClick={() => setType('expense')}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-etsy-gray'}`}>
          <ArrowUpCircle size={15} /> הוצאה
        </button>
      </div>
      <div className="mb-3">
        <label className="label text-xs">סכום ({sym})</label>
        <input className="input" type="number" min="0" step="0.01" value={amount}
          onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="mb-3">
        <label className="label text-xs">קטגוריה</label>
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${category === c ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="label text-xs">הערה</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="תיאור קצר..." />
        </div>
        <div className="w-32">
          <label className="label text-xs">תאריך</label>
          <input className="input text-sm" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Check size={16} /> שמור
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
          <X size={16} /> ביטול
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Chart view ─────────────── */

function ChartView({ txs, currency, sym }: { txs: Transaction[]; currency: string; sym: string }) {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [mode, setMode] = useState<'expense' | 'income'>('expense');

  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    txs.filter(t => t.type === mode).forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [txs, mode]);

  const monthData = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    txs.filter(t => t.type !== 'transfer').forEach(t => {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { income: 0, expense: 0 };
      if (t.type === 'income') map[m].income += t.amount;
      else map[m].expense += t.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({
        month: month.slice(5) + '/' + month.slice(2, 4),
        הכנסות: Math.round(v.income),
        הוצאות: Math.round(v.expense),
      }));
  }, [txs]);

  if (txs.length === 0) return null;

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setChartType('pie')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${chartType === 'pie' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
          <PieIcon size={13} /> עוגה
        </button>
        <button onClick={() => setChartType('bar')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${chartType === 'bar' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
          <BarChart2 size={13} /> חודשי
        </button>
        {chartType === 'pie' && (
          <div className="flex-1 flex justify-end gap-1">
            <button onClick={() => setMode('expense')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${mode === 'expense' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-etsy-gray border-etsy-border'}`}>
              הוצאות
            </button>
            <button onClick={() => setMode('income')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${mode === 'income' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-etsy-gray border-etsy-border'}`}>
              הכנסות
            </button>
          </div>
        )}
      </div>

      {chartType === 'pie' ? (
        catData.length === 0 ? (
          <p className="text-center text-etsy-gray text-xs py-4">אין נתונים</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={false}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${sym}${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {catData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-etsy-gray">{d.name}</span>
                  </div>
                  <span className="font-medium">{sym}{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        monthData.length === 0 ? (
          <p className="text-center text-etsy-gray text-xs py-4">אין נתונים</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${sym}${v.toLocaleString()}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="הכנסות" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="הוצאות" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      )}
    </div>
  );
}

/* ─────────────── Account detail screen ─────────────── */

function AccountDetail({
  account, allAccounts, txs, onAddTx, onDeleteTx, onBack,
}: {
  account: Account;
  allAccounts: Account[];
  txs: Transaction[];
  onAddTx: (txs: Omit<Transaction, 'id'>[]) => void;
  onDeleteTx: (id: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'list' | 'add' | 'transfer' | 'charts'>('list');
  const [search, setSearch] = useState('');
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;
  const meta = ACCOUNT_TYPES.find(t => t.type === account.type)!;

  const accountTxs = txs
    .filter(t => t.accountId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const filtered = search.trim()
    ? accountTxs.filter(t => t.note.includes(search) || t.category.includes(search))
    : accountTxs;

  const totalIn = accountTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = accountTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const exportCsv = () => {
    const rows = [['תאריך', 'סוג', 'קטגוריה', 'סכום', 'הערה']];
    accountTxs.forEach(t => rows.push([
      t.date, t.type === 'income' ? 'הכנסה' : t.type === 'expense' ? 'הוצאה' : 'העברה',
      t.category, String(t.amount), t.note
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${account.name}-תנועות.csv`;
    a.click();
  };

  const otherAccounts = allAccounts.filter(a => a.id !== account.id);

  return (
    <div className="p-4 safe-top">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pt-2">
        <button onClick={onBack} className="p-1.5 -ml-1 text-etsy-gray"><ArrowLeft size={20} /></button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ background: account.color }}>{meta.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{account.name}</p>
          <p className="text-xs text-etsy-gray">{meta.label}</p>
        </div>
        <div className="text-left">
          <p className="font-bold text-lg">{sym}{account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-etsy-gray">{account.currency}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingDown size={14} className="text-green-500" /><span className="text-xs text-etsy-gray">הכנסות</span></div>
          <p className="font-bold text-green-600">{sym}{totalIn.toLocaleString()}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={14} className="text-red-400" /><span className="text-xs text-etsy-gray">הוצאות</span></div>
          <p className="font-bold text-red-500">{sym}{totalOut.toLocaleString()}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode(mode === 'add' ? 'list' : 'add')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${mode === 'add' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
          <Plus size={15} /> תנועה
        </button>
        {otherAccounts.length > 0 && (
          <button onClick={() => setMode(mode === 'transfer' ? 'list' : 'transfer')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${mode === 'transfer' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
            <ArrowRightLeft size={15} /> העברה
          </button>
        )}
        <button onClick={() => setMode(mode === 'charts' ? 'list' : 'charts')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${mode === 'charts' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
          <PieIcon size={15} /> גרפים
        </button>
        <button onClick={exportCsv} title="ייצוא CSV"
          className="px-3 py-2 rounded-lg border border-etsy-border bg-white text-etsy-gray">
          <Download size={15} />
        </button>
      </div>

      {/* Sub-panels */}
      {mode === 'add' && (
        <TxForm account={account}
          onSave={tx => { onAddTx([tx]); setMode('list'); }}
          onCancel={() => setMode('list')} />
      )}
      {mode === 'transfer' && (
        <TransferForm
          accounts={[account, ...otherAccounts]}
          onSave={pair => { onAddTx(pair); setMode('list'); }}
          onCancel={() => setMode('list')} />
      )}
      {mode === 'charts' && (
        <ChartView txs={accountTxs} currency={account.currency} sym={sym} />
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-etsy-gray" />
        <input className="input pr-8 text-sm" value={search}
          onChange={e => setSearch(e.target.value)} placeholder="חיפוש בתנועות..." />
      </div>

      {/* List header */}
      <div className="flex items-center gap-2 mb-2">
        <List size={15} className="text-etsy-gray" />
        <h2 className="font-semibold text-sm">תנועות</h2>
        <span className="badge-gray">{accountTxs.length}</span>
      </div>

      {filtered.length === 0 && <p className="text-center text-etsy-gray text-sm py-8">אין תנועות</p>}

      {filtered.map(tx => {
        const isTransfer = tx.type === 'transfer';
        return (
          <div key={tx.id} className="card p-3 mb-2 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              tx.type === 'income' ? 'bg-green-100' : isTransfer ? 'bg-blue-100' : 'bg-red-100'
            }`}>
              {tx.type === 'income' ? <ArrowDownCircle size={16} className="text-green-600" />
                : isTransfer ? <ArrowRightLeft size={16} className="text-blue-500" />
                : <ArrowUpCircle size={16} className="text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{tx.note || tx.category}</p>
              <div className="flex gap-2 mt-0.5">
                <span className="badge-gray">{tx.category}</span>
                <span className="text-xs text-etsy-gray">{fmtDate(tx.date)}</span>
              </div>
            </div>
            <div className="text-left">
              <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : isTransfer ? 'text-blue-500' : 'text-red-500'}`}>
                {tx.type === 'income' ? '+' : isTransfer ? '→' : '-'}{sym}{tx.amount.toLocaleString()}
              </p>
            </div>
            <button onClick={() => onDeleteTx(tx.id)} className="p-1 text-etsy-gray hover:text-red-400 flex-shrink-0">
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── Account card ─────────────── */

function AccountCard({
  account, onEdit, onDelete, onOpen, txCount,
}: {
  account: Account; onEdit: (a: Account) => void; onDelete: (id: string) => void;
  onOpen: (a: Account) => void; txCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const meta = ACCOUNT_TYPES.find(t => t.type === account.type)!;
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;

  return (
    <div className="card overflow-hidden mb-3">
      <div className="h-1.5" style={{ background: account.color }} />
      <div className="p-4">
        <button className="w-full text-right" onClick={() => onOpen(account)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ background: account.color }}>{meta.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{account.name}</p>
              <p className="text-xs text-etsy-gray">{meta.label} · {txCount} תנועות</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-base">{sym}{account.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-etsy-gray">{account.currency}</p>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-etsy-gray">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'הסתר' : 'פרטי חשבון'}
          </button>
          <div className="flex-1" />
          <button onClick={() => onOpen(account)}
            className="text-xs text-etsy-orange font-medium px-2 py-1 rounded-lg border border-etsy-orange/30 bg-orange-50">
            פתח
          </button>
          <button onClick={() => onEdit(account)} className="p-1.5 rounded-lg hover:bg-gray-100 text-etsy-gray">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(account.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
            <Trash2 size={14} />
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-etsy-border space-y-2">
            <div className="flex justify-end">
              <button onClick={() => setShowSecrets(!showSecrets)} className="flex items-center gap-1 text-xs text-etsy-gray">
                {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
                {showSecrets ? 'הסתר מידע רגיש' : 'הצג מידע רגיש'}
              </button>
            </div>
            {meta.fields.map(f => {
              const val = account.details[f.key];
              if (!val) return null;
              return (
                <div key={f.key} className="flex justify-between text-xs">
                  <span className="text-etsy-gray">{f.label}</span>
                  <span className="font-mono font-medium">{f.secret && !showSecrets ? '••••••••' : val}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Account form ─────────────── */

interface FormState { type: AccountType; name: string; balance: string; currency: string; details: Record<string, string>; color: string; }

function AccountForm({ initial, onSave, onCancel }: {
  initial?: Account;
  onSave: (a: Omit<Account, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const def = ACCOUNT_TYPES[0];
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? { type: initial.type, name: initial.name, balance: String(initial.balance), currency: initial.currency, details: { ...initial.details }, color: initial.color }
      : { type: def.type, name: '', balance: '0', currency: def.currency, details: {}, color: def.color }
  );
  const meta = ACCOUNT_TYPES.find(t => t.type === form.type)!;
  const setType = (type: AccountType) => {
    const m = ACCOUNT_TYPES.find(t => t.type === type)!;
    setForm(f => ({ ...f, type, currency: m.currency, color: m.color, details: {} }));
  };
  const setDetail = (key: string, val: string) => setForm(f => ({ ...f, details: { ...f.details, [key]: val } }));
  const submit = () => {
    if (!form.name.trim()) return;
    onSave({ type: form.type, name: form.name.trim(), balance: parseFloat(form.balance) || 0, currency: form.currency, details: form.details, color: form.color });
  };

  return (
    <div className="card p-4 mb-4">
      <h2 className="font-semibold mb-4">{initial ? 'עריכת חשבון' : 'הוספת חשבון'}</h2>
      <div className="mb-4">
        <label className="label text-xs">סוג חשבון</label>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_TYPES.map(t => (
            <button key={t.type} onClick={() => setType(t.type)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${form.type === t.type ? 'border-2 border-etsy-orange bg-orange-50 text-etsy-orange' : 'border-etsy-border bg-white text-etsy-gray'}`}>
              <span style={{ color: form.type === t.type ? '#F1641E' : t.color }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label className="label text-xs">שם החשבון</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder={`למשל: ${meta.label} ראשי`} />
      </div>
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="label text-xs">יתרה התחלתית</label>
          <input className="input" type="number" value={form.balance}
            onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0" />
        </div>
        <div className="w-28">
          <label className="label text-xs">מטבע</label>
          <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="label text-xs">צבע</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-etsy-dark scale-110' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="space-y-3 mb-4">
        {meta.fields.map(f => (
          <div key={f.key}>
            <label className="label text-xs">{f.label}</label>
            <input className="input" value={form.details[f.key] ?? ''} onChange={e => setDetail(f.key, e.target.value)} placeholder={f.placeholder} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} className="btn-primary flex-1 flex items-center justify-center gap-2"><Check size={16} /> שמור</button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2"><X size={16} /> ביטול</button>
      </div>
    </div>
  );
}

/* ─────────────── Main page ─────────────── */

export default function Finance() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [txs, setTxs] = useState<Transaction[]>(loadTxs);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [detail, setDetail] = useState<Account | null>(null);
  const [filter, setFilter] = useState<AccountType | 'all'>('all');
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => { localStorage.setItem('finance_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('finance_txs', JSON.stringify(txs)); }, [txs]);

  const effectiveBalance = (acc: Account) => {
    const delta = txs.filter(t => t.accountId === acc.id)
      .reduce((s, t) => t.type === 'income' ? s + t.amount : t.type === 'expense' ? s - t.amount : s - t.amount, 0);
    return acc.balance + delta;
  };

  const saveAccount = (data: Omit<Account, 'id' | 'createdAt'>) => {
    if (editing) {
      setAccounts(prev => prev.map(a => a.id === editing.id ? { ...a, ...data } : a));
      toast.success('החשבון עודכן');
      setEditing(null);
    } else {
      setAccounts(prev => [...prev, { ...data, id: genId(), createdAt: new Date().toISOString() }]);
      toast.success('חשבון נוסף!');
      setShowForm(false);
    }
  };

  const removeAccount = (id: string) => {
    if (!confirm('למחוק את החשבון וכל תנועותיו?')) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
    setTxs(prev => prev.filter(t => t.accountId !== id));
    toast.success('החשבון נמחק');
  };

  const addTxs = (newTxs: Omit<Transaction, 'id'>[]) => {
    const withIds = newTxs.map(t => ({ ...t, id: genId() }));
    setTxs(prev => [...prev, ...withIds]);
    if (newTxs.length > 1) toast.success('העברה בוצעה ✓');
    else toast.success(newTxs[0].type === 'income' ? 'הכנסה נרשמה ✓' : 'הוצאה נרשמה ✓');
  };

  const deleteTx = (id: string) => {
    setTxs(prev => prev.filter(t => t.id !== id));
    toast.success('תנועה נמחקה');
  };

  if (detail) {
    const live = { ...detail, balance: effectiveBalance(detail) };
    return (
      <AccountDetail
        account={live}
        allAccounts={accounts.map(a => ({ ...a, balance: effectiveBalance(a) }))}
        txs={txs}
        onAddTx={addTxs}
        onDeleteTx={deleteTx}
        onBack={() => setDetail(null)}
      />
    );
  }

  const filtered = filter === 'all' ? accounts : accounts.filter(a => a.type === filter);
  const totals = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + effectiveBalance(a);
    return acc;
  }, {});

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-xl font-bold">ניהול כסף</h1>
        <div className="flex gap-2">
          {accounts.length >= 2 && !showForm && !editing && (
            <button onClick={() => setShowTransfer(!showTransfer)}
              className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-sm">
              <ArrowRightLeft size={15} /> העבר
            </button>
          )}
          {!showForm && !editing && (
            <button onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
              <Plus size={16} /> הוסף
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {Object.keys(totals).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          {Object.entries(totals).map(([cur, total]) => (
            <div key={cur} className="card p-3 flex-shrink-0 min-w-[120px] text-center">
              <p className="text-xs text-etsy-gray mb-1">{cur}</p>
              <p className="font-bold text-lg">{CURRENCY_SYMBOLS[cur] ?? ''}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
      )}

      {/* Global transfer form */}
      {showTransfer && (
        <TransferForm
          accounts={accounts}
          onSave={pair => { addTxs(pair); setShowTransfer(false); }}
          onCancel={() => setShowTransfer(false)}
        />
      )}

      {/* Add/Edit account form */}
      {(showForm || editing) && (
        <AccountForm
          initial={editing ?? undefined}
          onSave={saveAccount}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Filter tabs */}
      {accounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          <button onClick={() => setFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filter === 'all' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
            הכל ({accounts.length})
          </button>
          {ACCOUNT_TYPES.filter(t => accounts.some(a => a.type === t.type)).map(t => (
            <button key={t.type} onClick={() => setFilter(t.type)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filter === t.type ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && !showForm && !editing && (
        <div className="text-center py-16">
          <Wallet size={48} className="mx-auto text-etsy-border mb-4" />
          <p className="font-semibold text-etsy-gray mb-1">אין חשבונות עדיין</p>
          <p className="text-sm text-etsy-gray">לחץ "הוסף" כדי להתחיל</p>
        </div>
      )}

      {filtered.map(a =>
        editing?.id === a.id ? null : (
          <AccountCard
            key={a.id}
            account={{ ...a, balance: effectiveBalance(a) }}
            txCount={txs.filter(t => t.accountId === a.id).length}
            onEdit={acc => { setShowForm(false); setEditing(acc); }}
            onDelete={removeAccount}
            onOpen={setDetail}
          />
        )
      )}
    </div>
  );
}
