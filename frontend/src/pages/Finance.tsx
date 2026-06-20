import { useState, useEffect } from 'react';
import {
  Wallet, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  CreditCard, Building2, Globe, DollarSign, Landmark, Eye, EyeOff,
  ArrowUpCircle, ArrowDownCircle, List, ArrowLeft, TrendingUp, TrendingDown
} from 'lucide-react';
import { useToast } from '../components/Toast';

/* ─────────────── Types ─────────────── */

type AccountType = 'paypal' | 'bank_il' | 'bank_us' | 'bank_eu' | 'crypto' | 'other';

type TxType = 'income' | 'expense';

interface Transaction {
  id: string;
  accountId: string;
  type: TxType;
  amount: number;
  note: string;
  category: string;
  date: string;
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
    type: 'paypal',
    label: 'PayPal',
    icon: <Globe size={18} />,
    color: '#003087',
    currency: 'USD',
    fields: [
      { key: 'email', label: 'אימייל', placeholder: 'name@example.com' },
      { key: 'phone', label: 'טלפון (אופציונלי)', placeholder: '+972...' },
    ],
  },
  {
    type: 'bank_il',
    label: 'בנק ישראלי',
    icon: <Building2 size={18} />,
    color: '#1a56db',
    currency: 'ILS',
    fields: [
      { key: 'bank_name', label: 'שם הבנק', placeholder: 'לאומי / הפועלים / דיסקונט...' },
      { key: 'branch', label: 'מספר סניף', placeholder: '123' },
      { key: 'account', label: 'מספר חשבון', placeholder: '12345678', secret: true },
      { key: 'owner', label: 'שם בעל החשבון', placeholder: 'ישראל ישראלי' },
    ],
  },
  {
    type: 'bank_us',
    label: 'בנק אמריקאי',
    icon: <Landmark size={18} />,
    color: '#057a55',
    currency: 'USD',
    fields: [
      { key: 'bank_name', label: 'Bank Name', placeholder: 'Chase / Bank of America...' },
      { key: 'routing', label: 'Routing Number', placeholder: '021000021', secret: true },
      { key: 'account', label: 'Account Number', placeholder: '000123456789', secret: true },
      { key: 'owner', label: 'Account Holder', placeholder: 'John Doe' },
    ],
  },
  {
    type: 'bank_eu',
    label: 'בנק אירופאי',
    icon: <CreditCard size={18} />,
    color: '#7e3af2',
    currency: 'EUR',
    fields: [
      { key: 'bank_name', label: 'Bank Name', placeholder: 'N26 / Wise / Revolut...' },
      { key: 'iban', label: 'IBAN', placeholder: 'DE89 3704 0044 0532 0130 00', secret: true },
      { key: 'swift', label: 'SWIFT/BIC', placeholder: 'COBADEFFXXX' },
      { key: 'owner', label: 'Account Holder', placeholder: 'John Doe' },
    ],
  },
  {
    type: 'crypto',
    label: 'קריפטו',
    icon: <DollarSign size={18} />,
    color: '#f59e0b',
    currency: 'USD',
    fields: [
      { key: 'platform', label: 'פלטפורמה', placeholder: 'Binance / Coinbase / MetaMask...' },
      { key: 'address', label: 'כתובת ארנק', placeholder: '0x...', secret: true },
      { key: 'coin', label: 'מטבע עיקרי', placeholder: 'BTC / ETH / USDT...' },
    ],
  },
  {
    type: 'other',
    label: 'אחר',
    icon: <Wallet size={18} />,
    color: '#6b7280',
    currency: 'USD',
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
const EXPENSE_CATS = ['קניות', 'אוכל', 'תחבורה', 'שירותים', 'שכר דירה', 'בריאות', 'בידור', 'העברה', 'עמלה', 'אחר'];

const COLORS = ['#003087', '#1a56db', '#057a55', '#7e3af2', '#f59e0b', '#ef4444', '#6b7280', '#F1641E'];

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/* ─────────────── Storage ─────────────── */

function loadAccounts(): Account[] {
  try { return JSON.parse(localStorage.getItem('finance_accounts') ?? '[]'); } catch { return []; }
}
function loadTxs(): Transaction[] {
  try { return JSON.parse(localStorage.getItem('finance_txs') ?? '[]'); } catch { return []; }
}

/* ─────────────── Transaction form ─────────────── */

function TxForm({
  account,
  onSave,
  onCancel,
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

      {/* Type toggle */}
      <div className="flex rounded-lg overflow-hidden border border-etsy-border mb-3">
        <button
          onClick={() => setType('income')}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            type === 'income' ? 'bg-green-500 text-white' : 'bg-white text-etsy-gray'
          }`}
        >
          <ArrowDownCircle size={15} /> הכנסה
        </button>
        <button
          onClick={() => setType('expense')}
          className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            type === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-etsy-gray'
          }`}
        >
          <ArrowUpCircle size={15} /> הוצאה
        </button>
      </div>

      {/* Amount */}
      <div className="mb-3">
        <label className="label text-xs">סכום ({sym})</label>
        <input className="input" type="number" min="0" step="0.01" value={amount}
          onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </div>

      {/* Category */}
      <div className="mb-3">
        <label className="label text-xs">קטגוריה</label>
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                category === c ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Note + Date */}
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

/* ─────────────── Account detail screen ─────────────── */

function AccountDetail({
  account,
  txs,
  onAddTx,
  onDeleteTx,
  onBack,
}: {
  account: Account;
  txs: Transaction[];
  onAddTx: (tx: Omit<Transaction, 'id'>) => void;
  onDeleteTx: (id: string) => void;
  onBack: () => void;
}) {
  const [showTxForm, setShowTxForm] = useState(false);
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;
  const meta = ACCOUNT_TYPES.find(t => t.type === account.type)!;

  const accountTxs = txs
    .filter(t => t.accountId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalIn = accountTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = accountTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="p-4 safe-top">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pt-2">
        <button onClick={onBack} className="p-1.5 -ml-1 text-etsy-gray">
          <ArrowLeft size={20} />
        </button>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ background: account.color }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{account.name}</p>
          <p className="text-xs text-etsy-gray">{meta.label}</p>
        </div>
        <div className="text-left">
          <p className="font-bold text-lg">{sym}{account.balance.toLocaleString()}</p>
          <p className="text-xs text-etsy-gray">{account.currency}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} className="text-green-500" />
            <span className="text-xs text-etsy-gray">סה״כ הכנסות</span>
          </div>
          <p className="font-bold text-green-600">{sym}{totalIn.toLocaleString()}</p>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-red-400" />
            <span className="text-xs text-etsy-gray">סה״כ הוצאות</span>
          </div>
          <p className="font-bold text-red-500">{sym}{totalOut.toLocaleString()}</p>
        </div>
      </div>

      {/* Add tx button / form */}
      {showTxForm ? (
        <TxForm
          account={account}
          onSave={tx => { onAddTx(tx); setShowTxForm(false); }}
          onCancel={() => setShowTxForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowTxForm(true)}
          className="btn-primary w-full flex items-center justify-center gap-2 mb-4"
        >
          <Plus size={16} /> הוסף תנועה
        </button>
      )}

      {/* Transaction list */}
      <div className="flex items-center gap-2 mb-3">
        <List size={15} className="text-etsy-gray" />
        <h2 className="font-semibold text-sm">היסטוריית תנועות</h2>
        <span className="badge-gray">{accountTxs.length}</span>
      </div>

      {accountTxs.length === 0 && (
        <p className="text-center text-etsy-gray text-sm py-8">אין תנועות עדיין</p>
      )}

      {accountTxs.map(tx => (
        <div key={tx.id} className="card p-3 mb-2 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {tx.type === 'income'
              ? <ArrowDownCircle size={16} className="text-green-600" />
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
            <p className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
              {tx.type === 'income' ? '+' : '-'}{sym}{tx.amount.toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => onDeleteTx(tx.id)}
            className="p-1 text-etsy-gray hover:text-red-400 flex-shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Account card (list view) ─────────────── */

function AccountCard({
  account,
  onEdit,
  onDelete,
  onOpen,
  txCount,
}: {
  account: Account;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  onOpen: (a: Account) => void;
  txCount: number;
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
              style={{ background: account.color }}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{account.name}</p>
              <p className="text-xs text-etsy-gray">{meta.label} · {txCount} תנועות</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-base">{sym}{account.balance.toLocaleString()}</p>
              <p className="text-xs text-etsy-gray">{account.currency}</p>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-etsy-gray">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'הסתר' : 'פרטי חשבון'}
          </button>
          <div className="flex-1" />
          <button onClick={() => onOpen(account)}
            className="text-xs text-etsy-orange font-medium px-2 py-1 rounded-lg border border-etsy-orange/30 bg-orange-50">
            תנועות
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
              <button onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-1 text-xs text-etsy-gray">
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
                  <span className="font-mono font-medium">
                    {f.secret && !showSecrets ? '••••••••' : val}
                  </span>
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

interface FormState {
  type: AccountType; name: string; balance: string; currency: string;
  details: Record<string, string>; color: string;
}

function AccountForm({
  initial, onSave, onCancel,
}: {
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

  const setDetail = (key: string, val: string) =>
    setForm(f => ({ ...f, details: { ...f.details, [key]: val } }));

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
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                form.type === t.type ? 'border-2 border-etsy-orange bg-orange-50 text-etsy-orange' : 'border-etsy-border bg-white text-etsy-gray'
              }`}>
              <span style={{ color: form.type === t.type ? '#F1641E' : t.color }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="label text-xs">שם החשבון</label>
        <input className="input" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
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
          <select className="input" value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
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
            <input className="input" value={form.details[f.key] ?? ''}
              onChange={e => setDetail(f.key, e.target.value)} placeholder={f.placeholder} />
          </div>
        ))}
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

/* ─────────────── Main page ─────────────── */

export default function Finance() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [txs, setTxs] = useState<Transaction[]>(loadTxs);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [detail, setDetail] = useState<Account | null>(null);
  const [filter, setFilter] = useState<AccountType | 'all'>('all');

  useEffect(() => { localStorage.setItem('finance_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('finance_txs', JSON.stringify(txs)); }, [txs]);

  /* derive balances from txs on top of initial balance */
  const effectiveBalance = (acc: Account) => {
    const accountTxs = txs.filter(t => t.accountId === acc.id);
    const delta = accountTxs.reduce((s, t) => t.type === 'income' ? s + t.amount : s - t.amount, 0);
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

  const addTx = (tx: Omit<Transaction, 'id'>) => {
    setTxs(prev => [...prev, { ...tx, id: genId() }]);
    toast.success(tx.type === 'income' ? 'הכנסה נרשמה ✓' : 'הוצאה נרשמה ✓');
  };

  const deleteTx = (id: string) => {
    setTxs(prev => prev.filter(t => t.id !== id));
    toast.success('תנועה נמחקה');
  };

  /* If we're viewing an account detail */
  if (detail) {
    const live = { ...detail, balance: effectiveBalance(detail) };
    return (
      <AccountDetail
        account={live}
        txs={txs}
        onAddTx={addTx}
        onDeleteTx={deleteTx}
        onBack={() => setDetail(null)}
      />
    );
  }

  const filtered = filter === 'all' ? accounts : accounts.filter(a => a.type === filter);

  /* Totals per currency (live) */
  const totals = accounts.reduce<Record<string, number>>((acc, a) => {
    const cur = a.currency;
    acc[cur] = (acc[cur] ?? 0) + effectiveBalance(a);
    return acc;
  }, {});

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-xl font-bold">ניהול כסף</h1>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
            <Plus size={16} /> הוסף חשבון
          </button>
        )}
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

      {/* Form */}
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
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === 'all' ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'
            }`}>
            הכל ({accounts.length})
          </button>
          {ACCOUNT_TYPES.filter(t => accounts.some(a => a.type === t.type)).map(t => (
            <button key={t.type} onClick={() => setFilter(t.type)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === t.type ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && !showForm && !editing && (
        <div className="text-center py-16">
          <Wallet size={48} className="mx-auto text-etsy-border mb-4" />
          <p className="font-semibold text-etsy-gray mb-1">אין חשבונות עדיין</p>
          <p className="text-sm text-etsy-gray">לחץ "הוסף חשבון" כדי להתחיל</p>
        </div>
      )}

      {/* Account cards */}
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
