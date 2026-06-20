import { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  CreditCard, Building2, Globe, DollarSign, Landmark, Eye, EyeOff,
  ArrowUpCircle, ArrowDownCircle, List, ArrowLeft, TrendingUp, TrendingDown,
  ArrowRightLeft, Search, Download, PieChart as PieIcon, BarChart2,
  Target, RefreshCw, Bell, AlertTriangle, Calendar,
  Repeat, Trophy, PiggyBank, Zap,
  Lock, Unlock, ShieldCheck, LayoutDashboard, Delete,
  Settings, Upload, FileJson, BarChart as BarChartIcon, Activity, ChevronLeft, ChevronRight,
  Users, UserCheck, UserX, Clock, SlidersHorizontal, Filter
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

interface Budget {
  id: string;
  category: string;
  amount: number;
  currency: string;
  month: string; // YYYY-MM or 'monthly' for recurring
}

type RecurFreq = 'weekly' | 'monthly' | 'yearly';

interface Recurring {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  freq: RecurFreq;
  nextDate: string;
  accountId: string;
  active: boolean;
}

interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  currency: string;
  color: string;
  deadline?: string;
  emoji: string;
}

type DebtDirection = 'owe' | 'owed'; // owe = I owe them, owed = they owe me

interface Debt {
  id: string;
  direction: DebtDirection;
  person: string;
  amount: number;
  currency: string;
  note: string;
  dueDate?: string;
  paid: boolean;
  createdAt: string;
  partialPaid: number;
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
function loadBudgets(): Budget[] {
  try { return JSON.parse(localStorage.getItem('finance_budgets') ?? '[]'); } catch { return []; }
}
function loadRecurring(): Recurring[] {
  try { return JSON.parse(localStorage.getItem('finance_recurring') ?? '[]'); } catch { return []; }
}
function loadGoals(): Goal[] {
  try { return JSON.parse(localStorage.getItem('finance_goals') ?? '[]'); } catch { return []; }
}
function loadDebts(): Debt[] {
  try { return JSON.parse(localStorage.getItem('finance_debts') ?? '[]'); } catch { return []; }
}

function thisMonth() { return new Date().toISOString().slice(0, 7); }
function addMonths(date: string, n: number) {
  const d = new Date(date + '-01');
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function nextOccurrence(from: string, freq: RecurFreq): string {
  const d = new Date(from);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const FREQ_LABELS: Record<RecurFreq, string> = { weekly: 'שבועי', monthly: 'חודשי', yearly: 'שנתי' };

/* ─────────────── Budget panel ─────────────── */

function BudgetPanel({
  txs, budgets, onSave, onDelete,
}: {
  txs: Transaction[];
  budgets: Budget[];
  onSave: (b: Omit<Budget, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ILS');
  const month = thisMonth();

  const monthBudgets = budgets.filter(b => b.month === month || b.month === 'monthly');

  const spent = (category: string, cur: string) =>
    txs.filter(t => t.type === 'expense' && t.category === category && t.date.startsWith(month))
       .reduce((s, t) => s + t.amount, 0);

  const submit = () => {
    const n = parseFloat(amount);
    if (!n) return;
    onSave({ category: cat, amount: n, currency, month });
    setAdding(false);
    setAmount('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-1.5">
          <Target size={15} className="text-etsy-orange" /> תקציב חודשי — {month.slice(5)}/{month.slice(2,4)}
        </h2>
        <button onClick={() => setAdding(!adding)}
          className="text-xs text-etsy-orange font-medium flex items-center gap-1">
          <Plus size={13} /> הוסף
        </button>
      </div>

      {adding && (
        <div className="card p-3 mb-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">קטגוריה</label>
              <select className="input text-sm" value={cat} onChange={e => setCat(e.target.value)}>
                {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="label text-xs">מטבע</label>
              <select className="input text-sm" value={currency} onChange={e => setCurrency(e.target.value)}>
                {['ILS','USD','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label text-xs">תקציב ({CURRENCY_SYMBOLS[currency] ?? currency})</label>
            <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary flex-1 py-1.5 text-sm flex items-center justify-center gap-1"><Check size={14} /> שמור</button>
            <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 text-sm flex items-center gap-1"><X size={14} /> ביטול</button>
          </div>
        </div>
      )}

      {monthBudgets.length === 0 && !adding && (
        <p className="text-center text-etsy-gray text-xs py-4">לא הוגדרו תקציבים לחודש זה</p>
      )}

      {monthBudgets.map(b => {
        const sym = CURRENCY_SYMBOLS[b.currency] ?? b.currency;
        const s = spent(b.category, b.currency);
        const pct = Math.min((s / b.amount) * 100, 100);
        const over = s > b.amount;
        return (
          <div key={b.id} className="card p-3 mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {over && <AlertTriangle size={13} className="text-red-500" />}
                <span className="text-sm font-medium">{b.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${over ? 'text-red-500' : 'text-etsy-gray'}`}>
                  {sym}{s.toLocaleString()} / {sym}{b.amount.toLocaleString()}
                </span>
                <button onClick={() => onDelete(b.id)} className="text-etsy-gray hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-green-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-etsy-gray mt-1">{Math.round(pct)}% נוצל{over ? ' — חרגת!' : ''}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── Recurring panel ─────────────── */

function RecurringPanel({
  recurring, accounts, onSave, onDelete, onPayNow,
}: {
  recurring: Recurring[];
  accounts: Account[];
  onSave: (r: Omit<Recurring, 'id'>) => void;
  onDelete: (id: string) => void;
  onPayNow: (r: Recurring) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '', amount: '', currency: 'ILS', category: EXPENSE_CATS[0],
    freq: 'monthly' as RecurFreq, nextDate: new Date().toISOString().slice(0, 10),
    accountId: accounts[0]?.id ?? '',
  });

  const submit = () => {
    if (!form.name.trim() || !parseFloat(form.amount)) return;
    onSave({ ...form, amount: parseFloat(form.amount), active: true });
    setAdding(false);
    setForm(f => ({ ...f, name: '', amount: '' }));
  };

  const sorted = [...recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-1.5">
          <RefreshCw size={15} className="text-etsy-orange" /> תשלומים קבועים
        </h2>
        <button onClick={() => setAdding(!adding)}
          className="text-xs text-etsy-orange font-medium flex items-center gap-1">
          <Plus size={13} /> הוסף
        </button>
      </div>

      {adding && (
        <div className="card p-3 mb-3 space-y-2">
          <div>
            <label className="label text-xs">שם</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="נטפליקס, שכר דירה..." />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">סכום</label>
              <input className="input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="w-20">
              <label className="label text-xs">מטבע</label>
              <select className="input text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['ILS','USD','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">תדירות</label>
              <select className="input text-sm" value={form.freq} onChange={e => setForm(f => ({ ...f, freq: e.target.value as RecurFreq }))}>
                <option value="weekly">שבועי</option>
                <option value="monthly">חודשי</option>
                <option value="yearly">שנתי</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="label text-xs">תשלום הבא</label>
              <input className="input text-sm" type="date" value={form.nextDate} onChange={e => setForm(f => ({ ...f, nextDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">קטגוריה</label>
              <select className="input text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="label text-xs">חשבון</label>
              <select className="input text-sm" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary flex-1 py-1.5 text-sm flex items-center justify-center gap-1"><Check size={14} /> שמור</button>
            <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 text-sm flex items-center gap-1"><X size={14} /> ביטול</button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !adding && (
        <p className="text-center text-etsy-gray text-xs py-4">אין תשלומים קבועים</p>
      )}

      {sorted.map(r => {
        const sym = CURRENCY_SYMBOLS[r.currency] ?? r.currency;
        const days = daysUntil(r.nextDate);
        const urgent = days <= 3;
        const acc = accounts.find(a => a.id === r.accountId);
        return (
          <div key={r.id} className={`card p-3 mb-2 border-r-4 ${urgent ? 'border-r-red-400' : 'border-r-etsy-border'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${urgent ? 'bg-red-100' : 'bg-orange-50'}`}>
                {urgent ? <Bell size={15} className="text-red-500" /> : <RefreshCw size={15} className="text-etsy-orange" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="badge-gray">{FREQ_LABELS[r.freq]}</span>
                  <span className="text-xs text-etsy-gray flex items-center gap-0.5">
                    <Calendar size={10} /> {fmtDate(r.nextDate)}
                  </span>
                  {acc && <span className="text-xs text-etsy-gray truncate">{acc.name}</span>}
                </div>
              </div>
              <div className="text-left flex-shrink-0">
                <p className="font-bold text-sm text-red-500">-{sym}{r.amount.toLocaleString()}</p>
                <p className={`text-xs ${urgent ? 'text-red-500 font-medium' : 'text-etsy-gray'}`}>
                  {days < 0 ? 'עבר!' : days === 0 ? 'היום!' : `בעוד ${days}י׳`}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => onPayNow(r)}
                className="flex-1 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg flex items-center justify-center gap-1">
                <Check size={11} /> שלם עכשיו
              </button>
              <button onClick={() => onDelete(r.id)}
                className="px-2 py-1 text-xs text-red-400 border border-etsy-border rounded-lg hover:bg-red-50">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  account, onSave, onCancel, initial,
}: {
  account: Account;
  onSave: (tx: Omit<Transaction, 'id'>) => void;
  onCancel: () => void;
  initial?: Transaction;
}) {
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;
  const [type, setType] = useState<TxType>(initial?.type ?? 'income');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;

  const submit = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    onSave({ accountId: account.id, type, amount: n, note: note.trim(), category: category || cats[cats.length - 1], date });
  };

  return (
    <div className="card p-4 mb-3">
      <h3 className="font-semibold mb-3 text-sm">{initial ? 'עריכת תנועה' : 'הוספת תנועה'} — {account.name}</h3>
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
  account, allAccounts, txs, onAddTx, onDeleteTx, onEditTx, onBack,
}: {
  account: Account;
  allAccounts: Account[];
  txs: Transaction[];
  onAddTx: (txs: Omit<Transaction, 'id'>[]) => void;
  onDeleteTx: (id: string) => void;
  onEditTx: (id: string, data: Omit<Transaction, 'id'>) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'list' | 'add' | 'transfer' | 'charts'>('list');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TxType | 'all'>('all');
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;
  const meta = ACCOUNT_TYPES.find(t => t.type === account.type)!;

  const accountTxs = txs
    .filter(t => t.accountId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const filtered = accountTxs
    .filter(t => filterType === 'all' || t.type === filterType)
    .filter(t => !search.trim() || t.note.includes(search) || t.category.includes(search));

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

      {/* Edit transaction overlay */}
      {editingTx && (
        <TxForm
          account={account}
          initial={editingTx}
          onSave={data => { onEditTx(editingTx.id, data); setEditingTx(null); }}
          onCancel={() => setEditingTx(null)}
        />
      )}

      {/* Sub-panels */}
      {!editingTx && mode === 'add' && (
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

      {/* Search + filter */}
      <div className="relative mb-2">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-etsy-gray" />
        <input className="input pr-8 text-sm" value={search}
          onChange={e => setSearch(e.target.value)} placeholder="חיפוש בתנועות..." />
      </div>
      <div className="flex gap-1.5 mb-3">
        {(['all','income','expense'] as const).map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filterType === f ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
            {f === 'all' ? `הכל (${accountTxs.length})` : f === 'income' ? 'הכנסות' : 'הוצאות'}
          </button>
        ))}
      </div>

      {/* List header */}
      <div className="flex items-center gap-2 mb-2">
        <List size={15} className="text-etsy-gray" />
        <h2 className="font-semibold text-sm">תנועות</h2>
        <span className="badge-gray">{filtered.length}</span>
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
            {!isTransfer && (
              <button onClick={() => { setEditingTx(tx); setMode('list'); }}
                className="p-1 text-etsy-gray hover:text-etsy-orange flex-shrink-0">
                <Edit2 size={13} />
              </button>
            )}
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

/* ─────────────── Goals panel ─────────────── */

const GOAL_EMOJIS = ['🏠','✈️','🚗','💍','📱','🎓','💼','🏖️','🛍️','💰','🏋️','🎸'];
const GOAL_COLORS = ['#F1641E','#1a56db','#057a55','#7e3af2','#f59e0b','#ef4444','#6b7280'];

function GoalsPanel({
  goals, onSave, onDelete, onDeposit,
}: {
  goals: Goal[];
  onSave: (g: Omit<Goal, 'id'>) => void;
  onDelete: (id: string) => void;
  onDeposit: (id: string, amount: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [depositAmt, setDepositAmt] = useState('');
  const [form, setForm] = useState({
    name: '', target: '', saved: '0', currency: 'ILS',
    color: GOAL_COLORS[0], deadline: '', emoji: GOAL_EMOJIS[0],
  });

  const submitGoal = () => {
    const t = parseFloat(form.target);
    if (!form.name.trim() || !t) return;
    onSave({ name: form.name.trim(), target: t, saved: parseFloat(form.saved) || 0, currency: form.currency, color: form.color, deadline: form.deadline || undefined, emoji: form.emoji });
    setAdding(false);
    setForm(f => ({ ...f, name: '', target: '', saved: '0', deadline: '' }));
  };

  const submitDeposit = (id: string) => {
    const n = parseFloat(depositAmt);
    if (!n) return;
    onDeposit(id, n);
    setDepositId(null);
    setDepositAmt('');
  };

  const totalByComplete = goals.filter(g => g.saved >= g.target).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-1.5">
          <PiggyBank size={15} className="text-etsy-orange" /> יעדי חיסכון
          {totalByComplete > 0 && (
            <span className="flex items-center gap-0.5 text-yellow-500 text-xs font-medium">
              <Trophy size={12} /> {totalByComplete}
            </span>
          )}
        </h2>
        <button onClick={() => setAdding(!adding)} className="text-xs text-etsy-orange font-medium flex items-center gap-1">
          <Plus size={13} /> הוסף
        </button>
      </div>

      {adding && (
        <div className="card p-3 mb-3 space-y-2">
          {/* Emoji picker */}
          <div>
            <label className="label text-xs">אמוג'י</label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_EMOJIS.map(e => (
                <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border ${form.emoji === e ? 'border-etsy-orange bg-orange-50' : 'border-etsy-border'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label text-xs">שם היעד</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="חיסכון לדירה, חופשה..." />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">יעד</label>
              <input className="input" type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="100000" />
            </div>
            <div className="flex-1">
              <label className="label text-xs">כבר חסכתי</label>
              <input className="input" type="number" value={form.saved} onChange={e => setForm(f => ({ ...f, saved: e.target.value }))} placeholder="0" />
            </div>
            <div className="w-20">
              <label className="label text-xs">מטבע</label>
              <select className="input text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['ILS','USD','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">צבע</label>
              <div className="flex gap-1.5 mt-1">
                {GOAL_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 ${form.color === c ? 'border-etsy-dark scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="label text-xs">תאריך יעד (אופציונלי)</label>
              <input className="input text-sm" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submitGoal} className="btn-primary flex-1 py-1.5 text-sm flex items-center justify-center gap-1"><Check size={14} /> שמור</button>
            <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 text-sm flex items-center gap-1"><X size={14} /> ביטול</button>
          </div>
        </div>
      )}

      {goals.length === 0 && !adding && (
        <div className="text-center py-8">
          <PiggyBank size={40} className="mx-auto text-etsy-border mb-2" />
          <p className="text-etsy-gray text-sm">אין יעדי חיסכון עדיין</p>
        </div>
      )}

      {goals.map(g => {
        const sym = CURRENCY_SYMBOLS[g.currency] ?? g.currency;
        const pct = Math.min((g.saved / g.target) * 100, 100);
        const done = g.saved >= g.target;
        const remaining = Math.max(g.target - g.saved, 0);
        const daysLeft = g.deadline ? daysUntil(g.deadline) : null;

        return (
          <div key={g.id} className="card overflow-hidden mb-3">
            <div className="h-1" style={{ background: g.color }} />
            <div className="p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-2xl">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate">{g.name}</p>
                    {done && <Trophy size={13} className="text-yellow-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-etsy-gray">
                    {sym}{g.saved.toLocaleString()} / {sym}{g.target.toLocaleString()}
                    {daysLeft !== null && (
                      <span className={`mr-2 ${daysLeft < 0 ? 'text-red-500' : daysLeft < 30 ? 'text-amber-500' : ''}`}>
                        · {daysLeft < 0 ? 'עבר!' : `${daysLeft} ימים`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-left flex-shrink-0">
                  <p className="font-bold text-sm" style={{ color: g.color }}>{Math.round(pct)}%</p>
                  {!done && <p className="text-xs text-etsy-gray">נותר {sym}{remaining.toLocaleString()}</p>}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: done ? '#f59e0b' : g.color }} />
              </div>

              {/* Deposit form */}
              {depositId === g.id ? (
                <div className="flex gap-1.5 mt-2">
                  <input className="input flex-1 py-1 text-sm" type="number" value={depositAmt}
                    onChange={e => setDepositAmt(e.target.value)} placeholder={`סכום (${sym})`} autoFocus />
                  <button onClick={() => submitDeposit(g.id)}
                    className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm flex items-center gap-1">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setDepositId(null)}
                    className="px-2 py-1 border border-etsy-border rounded-lg text-sm text-etsy-gray">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {!done && (
                    <button onClick={() => setDepositId(g.id)}
                      className="flex-1 py-1 text-xs font-medium rounded-lg border flex items-center justify-center gap-1"
                      style={{ borderColor: g.color, color: g.color, background: `${g.color}10` }}>
                      <Plus size={11} /> הוסף חיסכון
                    </button>
                  )}
                  {done && (
                    <div className="flex-1 py-1 text-xs font-medium text-yellow-600 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center justify-center gap-1">
                      <Trophy size={12} /> הושג! כל הכבוד!
                    </div>
                  )}
                  <button onClick={() => onDelete(g.id)}
                    className="px-2 py-1 text-xs text-red-400 border border-etsy-border rounded-lg hover:bg-red-50">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── Currency converter ─────────────── */

/* Hardcoded approximate rates vs USD — refreshed in UI from a free API when possible */
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, ILS: 3.7, EUR: 0.92, GBP: 0.79, JPY: 149, BTC: 0.000016, ETH: 0.00043, USDT: 1,
};

function CurrencyConverter() {
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('ILS');
  const [amount, setAmount] = useState('1');
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (res.ok) {
        const data = await res.json();
        setRates({ ...FALLBACK_RATES, ...data.rates });
        setLastUpdated(new Date().toLocaleTimeString('he-IL'));
      }
    } catch { /* use fallback */ }
    setLoading(false);
  };

  useEffect(() => { fetchRates(); }, []);

  const convert = () => {
    const n = parseFloat(amount);
    if (!n || !rates[from] || !rates[to]) return 0;
    return (n / rates[from]) * rates[to];
  };

  const result = convert();
  const convCurrencies = ['ILS','USD','EUR','GBP','JPY','USDT','BTC','ETH'];

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-1.5">
          <Zap size={15} className="text-etsy-orange" /> ממיר מטבעות
        </h2>
        <button onClick={fetchRates} disabled={loading}
          className="text-xs text-etsy-gray flex items-center gap-1">
          <Repeat size={12} className={loading ? 'animate-spin' : ''} />
          {lastUpdated ? `עודכן ${lastUpdated}` : 'רענן'}
        </button>
      </div>

      <div className="flex gap-2 items-end mb-3">
        <div className="flex-1">
          <label className="label text-xs">סכום</label>
          <input className="input" type="number" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="1" />
        </div>
        <div className="w-24">
          <label className="label text-xs">ממטבע</label>
          <select className="input" value={from} onChange={e => setFrom(e.target.value)}>
            {convCurrencies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => { setFrom(to); setTo(from); }}
          className="p-2.5 rounded-lg border border-etsy-border bg-white text-etsy-gray mb-0.5 flex-shrink-0">
          <ArrowRightLeft size={16} />
        </button>
        <div className="w-24">
          <label className="label text-xs">למטבע</label>
          <select className="input" value={to} onChange={e => setTo(e.target.value)}>
            {convCurrencies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 text-center border border-etsy-border">
        <p className="text-xs text-etsy-gray mb-1">
          {parseFloat(amount) || 1} {from} =
        </p>
        <p className="text-2xl font-bold" style={{ color: '#F1641E' }}>
          {result.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
        </p>
        <p className="text-xs text-etsy-gray mt-1">
          1 {from} = {((1 / rates[from]) * rates[to]).toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
        </p>
      </div>

      {/* Quick reference grid */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[10,100,1000].map(n => (
          <button key={n} onClick={() => setAmount(String(n))}
            className="py-1 text-xs text-etsy-gray border border-etsy-border rounded-lg bg-white">
            {n} {from}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Debts panel ─────────────── */

function DebtsPanel({
  debts, onSave, onDelete, onMarkPaid, onPartialPay,
}: {
  debts: Debt[];
  onSave: (d: Omit<Debt, 'id' | 'createdAt' | 'paid' | 'partialPaid'>) => void;
  onDelete: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onPartialPay: (id: string, amount: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [tab, setTab] = useState<'active' | 'paid'>('active');
  const [form, setForm] = useState({
    direction: 'owed' as DebtDirection,
    person: '', amount: '', currency: 'ILS', note: '', dueDate: '',
  });

  const submit = () => {
    const n = parseFloat(form.amount);
    if (!form.person.trim() || !n) return;
    onSave({ direction: form.direction, person: form.person.trim(), amount: n, currency: form.currency, note: form.note.trim(), dueDate: form.dueDate || undefined });
    setAdding(false);
    setForm(f => ({ ...f, person: '', amount: '', note: '', dueDate: '' }));
  };

  const active = debts.filter(d => !d.paid);
  const paid = debts.filter(d => d.paid);
  const displayed = tab === 'active' ? active : paid;

  const totalOwed = active.filter(d => d.direction === 'owed').reduce((s, d) => s + (d.amount - d.partialPaid), 0);
  const totalOwe = active.filter(d => d.direction === 'owe').reduce((s, d) => s + (d.amount - d.partialPaid), 0);

  return (
    <div>
      {/* Summary */}
      {active.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="card p-3 border-r-4 border-r-green-400">
            <div className="flex items-center gap-1 mb-1"><UserCheck size={13} className="text-green-500" /><span className="text-xs text-etsy-gray">חייבים לי</span></div>
            <p className="font-bold text-green-600">{totalOwed.toLocaleString()}</p>
            <p className="text-xs text-etsy-gray">{active.filter(d => d.direction === 'owed').length} חובות</p>
          </div>
          <div className="card p-3 border-r-4 border-r-red-400">
            <div className="flex items-center gap-1 mb-1"><UserX size={13} className="text-red-400" /><span className="text-xs text-etsy-gray">אני חייב</span></div>
            <p className="font-bold text-red-500">{totalOwe.toLocaleString()}</p>
            <p className="text-xs text-etsy-gray">{active.filter(d => d.direction === 'owe').length} חובות</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex rounded-lg overflow-hidden border border-etsy-border">
          <button onClick={() => setTab('active')}
            className={`px-3 py-1.5 text-xs font-medium ${tab === 'active' ? 'bg-etsy-orange text-white' : 'text-etsy-gray bg-white'}`}>
            פעילות ({active.length})
          </button>
          <button onClick={() => setTab('paid')}
            className={`px-3 py-1.5 text-xs font-medium ${tab === 'paid' ? 'bg-etsy-orange text-white' : 'text-etsy-gray bg-white'}`}>
            שולמו ({paid.length})
          </button>
        </div>
        <button onClick={() => setAdding(!adding)} className="text-xs text-etsy-orange font-medium flex items-center gap-1">
          <Plus size={13} /> הוסף
        </button>
      </div>

      {adding && (
        <div className="card p-3 mb-3 space-y-2">
          {/* Direction */}
          <div className="flex rounded-lg overflow-hidden border border-etsy-border">
            <button onClick={() => setForm(f => ({ ...f, direction: 'owed' }))}
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 ${form.direction === 'owed' ? 'bg-green-500 text-white' : 'bg-white text-etsy-gray'}`}>
              <UserCheck size={14} /> חייבים לי
            </button>
            <button onClick={() => setForm(f => ({ ...f, direction: 'owe' }))}
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 ${form.direction === 'owe' ? 'bg-red-500 text-white' : 'bg-white text-etsy-gray'}`}>
              <UserX size={14} /> אני חייב
            </button>
          </div>
          <div>
            <label className="label text-xs">שם האדם</label>
            <input className="input" value={form.person} onChange={e => setForm(f => ({ ...f, person: e.target.value }))} placeholder="ישראל ישראלי..." />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">סכום</label>
              <input className="input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="w-20">
              <label className="label text-xs">מטבע</label>
              <select className="input text-sm" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {['ILS','USD','EUR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label text-xs">הערה (אופציונלי)</label>
              <input className="input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="הלוואה לארוחת ערב..." />
            </div>
            <div className="w-32">
              <label className="label text-xs">תאריך פירעון</label>
              <input className="input text-sm" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary flex-1 py-1.5 text-sm flex items-center justify-center gap-1"><Check size={14} /> שמור</button>
            <button onClick={() => setAdding(false)} className="btn-secondary py-1.5 text-sm flex items-center gap-1"><X size={14} /> ביטול</button>
          </div>
        </div>
      )}

      {displayed.length === 0 && !adding && (
        <div className="text-center py-10">
          <Users size={36} className="mx-auto text-etsy-border mb-2" />
          <p className="text-etsy-gray text-sm">{tab === 'active' ? 'אין חובות פעילות' : 'אין חובות שהושלמו'}</p>
        </div>
      )}

      {displayed.map(d => {
        const sym = CURRENCY_SYMBOLS[d.currency] ?? d.currency;
        const remaining = d.amount - d.partialPaid;
        const pct = d.partialPaid > 0 ? Math.round((d.partialPaid / d.amount) * 100) : 0;
        const days = d.dueDate ? daysUntil(d.dueDate) : null;
        const overdue = days !== null && days < 0 && !d.paid;
        return (
          <div key={d.id} className={`card mb-2 overflow-hidden border-r-4 ${d.direction === 'owed' ? 'border-r-green-400' : 'border-r-red-400'}`}>
            <div className="p-3">
              <div className="flex items-start gap-2 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${d.direction === 'owed' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {d.direction === 'owed' ? <UserCheck size={15} className="text-green-600" /> : <UserX size={15} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{d.person}</p>
                  <p className="text-xs text-etsy-gray">
                    {d.direction === 'owed' ? 'חייב לי' : 'אני חייב'}
                    {d.note && ` · ${d.note}`}
                  </p>
                </div>
                <div className="text-left">
                  <p className={`font-bold text-sm ${d.direction === 'owed' ? 'text-green-600' : 'text-red-500'}`}>
                    {sym}{remaining.toLocaleString()}
                  </p>
                  {d.partialPaid > 0 && <p className="text-xs text-etsy-gray">מתוך {sym}{d.amount.toLocaleString()}</p>}
                </div>
              </div>

              {d.partialPaid > 0 && (
                <div className="mb-2">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.direction === 'owed' ? 'bg-green-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-etsy-gray mt-0.5">{pct}% שולם</p>
                </div>
              )}

              {d.dueDate && (
                <div className={`flex items-center gap-1 text-xs mb-2 ${overdue ? 'text-red-500 font-medium' : 'text-etsy-gray'}`}>
                  <Clock size={11} />
                  {overdue ? 'איחור! ' : ''}{fmtDate(d.dueDate)}
                  {days !== null && !d.paid && <span>({days < 0 ? `${Math.abs(days)} ימים באיחור` : days === 0 ? 'היום' : `${days} ימים`})</span>}
                </div>
              )}

              {!d.paid && (
                payId === d.id ? (
                  <div className="flex gap-1.5">
                    <input className="input flex-1 py-1 text-sm" type="number" value={payAmt}
                      onChange={e => setPayAmt(e.target.value)} placeholder={`סכום (${sym})`} autoFocus />
                    <button onClick={() => { onPartialPay(d.id, parseFloat(payAmt) || 0); setPayId(null); setPayAmt(''); }}
                      className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm"><Check size={13} /></button>
                    <button onClick={() => setPayId(null)} className="px-2 py-1 border border-etsy-border rounded-lg text-sm text-etsy-gray"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button onClick={() => onMarkPaid(d.id)}
                      className="flex-1 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg flex items-center justify-center gap-1">
                      <Check size={11} /> שולם במלואו
                    </button>
                    <button onClick={() => setPayId(d.id)}
                      className="flex-1 py-1 text-xs font-medium bg-gray-50 text-etsy-gray border border-etsy-border rounded-lg flex items-center justify-center gap-1">
                      <DollarSign size={11} /> תשלום חלקי
                    </button>
                    <button onClick={() => onDelete(d.id)} className="px-2 py-1 text-xs text-red-400 border border-etsy-border rounded-lg hover:bg-red-50">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              )}
              {d.paid && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check size={11} /> שולם</span>
                  <button onClick={() => onDelete(d.id)} className="text-xs text-etsy-gray"><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── All transactions view ─────────────── */

function AllTransactions({
  txs, accounts,
}: {
  txs: Transaction[];
  accounts: Account[];
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TxType | 'all'>('all');
  const [catFilter, setCatFilter] = useState('');
  const [accFilter, setAccFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE = 30;

  const allCats = useMemo(() => [...new Set(txs.filter(t => t.type !== 'transfer').map(t => t.category))].sort(), [txs]);

  const filtered = useMemo(() => {
    return [...txs]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .filter(t => !catFilter || t.category === catFilter)
      .filter(t => !accFilter || t.accountId === accFilter)
      .filter(t => !search.trim() || t.note.includes(search) || t.category.includes(search) ||
        accounts.find(a => a.id === t.accountId)?.name.includes(search));
  }, [txs, typeFilter, catFilter, accFilter, search, accounts]);

  const pageItems = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(filtered.length / PAGE);

  const totalIn = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      {/* Search */}
      <div className="relative mb-2">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-etsy-gray" />
        <input className="input pr-8 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="חיפוש בכל התנועות..." />
      </div>

      {/* Filter toggle */}
      <div className="flex gap-2 mb-3">
        {(['all','income','expense'] as const).map(f => (
          <button key={f} onClick={() => { setTypeFilter(f); setPage(0); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${typeFilter === f ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
            {f === 'all' ? 'הכל' : f === 'income' ? 'הכנסות' : 'הוצאות'}
          </button>
        ))}
        <button onClick={() => setShowFilters(!showFilters)}
          className={`mr-auto px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${showFilters ? 'bg-etsy-orange text-white border-etsy-orange' : 'bg-white text-etsy-gray border-etsy-border'}`}>
          <Filter size={11} /> סינון
        </button>
      </div>

      {showFilters && (
        <div className="card p-3 mb-3 flex gap-2">
          <div className="flex-1">
            <label className="label text-xs">קטגוריה</label>
            <select className="input text-sm" value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(0); }}>
              <option value="">הכל</option>
              {allCats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="label text-xs">חשבון</label>
            <select className="input text-sm" value={accFilter} onChange={e => { setAccFilter(e.target.value); setPage(0); }}>
              <option value="">הכל</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="card p-3 mb-3 flex gap-4">
          <div className="flex-1 text-center">
            <p className="text-xs text-etsy-gray">תנועות</p>
            <p className="font-bold">{filtered.length}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-etsy-gray">הכנסות</p>
            <p className="font-bold text-green-600">{totalIn.toLocaleString()}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs text-etsy-gray">הוצאות</p>
            <p className="font-bold text-red-500">{totalOut.toLocaleString()}</p>
          </div>
        </div>
      )}

      {filtered.length === 0 && <p className="text-center text-etsy-gray text-sm py-10">אין תנועות התואמות לסינון</p>}

      {/* Grouped by date */}
      {(() => {
        let lastDate = '';
        return pageItems.map(tx => {
          const acc = accounts.find(a => a.id === tx.accountId);
          const sym = acc ? (CURRENCY_SYMBOLS[acc.currency] ?? acc.currency) : '';
          const isTransfer = tx.type === 'transfer';
          const showDateHeader = tx.date !== lastDate;
          lastDate = tx.date;
          return (
            <div key={tx.id}>
              {showDateHeader && (
                <p className="text-xs text-etsy-gray font-medium py-1.5 px-1">{fmtDate(tx.date)}</p>
              )}
              <div className="card p-3 mb-1.5 flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'income' ? 'bg-green-100' : isTransfer ? 'bg-blue-100' : 'bg-red-100'}`}>
                  {tx.type === 'income' ? <ArrowDownCircle size={14} className="text-green-600" />
                    : isTransfer ? <ArrowRightLeft size={14} className="text-blue-500" />
                    : <ArrowUpCircle size={14} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.note || tx.category}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="badge-gray text-[10px]">{tx.category}</span>
                    {acc && (
                      <span className="text-[10px] text-etsy-gray flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: acc.color }} />
                        {acc.name}
                      </span>
                    )}
                  </div>
                </div>
                <p className={`font-bold text-sm flex-shrink-0 ${tx.type === 'income' ? 'text-green-600' : isTransfer ? 'text-blue-500' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : isTransfer ? '→' : '-'}{sym}{tx.amount.toLocaleString()}
                </p>
              </div>
            </div>
          );
        });
      })()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-30 flex items-center gap-1">
            <ChevronRight size={14} /> הקודם
          </button>
          <span className="text-xs text-etsy-gray">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="btn-secondary py-1.5 px-3 text-sm disabled:opacity-30 flex items-center gap-1">
            הבא <ChevronLeft size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Insights ─────────────── */

interface Insight {
  type: 'warning' | 'positive' | 'info';
  title: string;
  detail: string;
}

function InsightsPanel({ txs, budgets, recurring }: { txs: Transaction[]; budgets: Budget[]; recurring: Recurring[] }) {
  const insights: Insight[] = useMemo(() => {
    const result: Insight[] = [];
    const now = new Date();
    const thisM = thisMonth();
    const prevM = addMonths(thisM, -1).slice(0, 7);

    const monthExp = (month: string, cat?: string) =>
      txs.filter(t => t.type === 'expense' && t.date.startsWith(month) && (!cat || t.category === cat))
         .reduce((s, t) => s + t.amount, 0);
    const monthInc = (month: string) =>
      txs.filter(t => t.type === 'income' && t.date.startsWith(month)).reduce((s, t) => s + t.amount, 0);

    const curExp = monthExp(thisM);
    const prevExp = monthExp(prevM);
    const curInc = monthInc(thisM);

    // 1. Expenses higher than last month
    if (prevExp > 0 && curExp > prevExp * 1.2) {
      const pct = Math.round(((curExp - prevExp) / prevExp) * 100);
      result.push({ type: 'warning', title: `הוצאות גבוהות ב-${pct}% מהחודש שעבר`, detail: `החודש: ${curExp.toLocaleString()} | חודש שעבר: ${prevExp.toLocaleString()}` });
    }

    // 2. Good savings this month
    if (curInc > 0 && curExp < curInc * 0.7) {
      result.push({ type: 'positive', title: 'חיסכון מצוין החודש! 🎉', detail: `חסכת ${Math.round(100 - (curExp / curInc) * 100)}% מההכנסות` });
    }

    // 3. Category spikes
    const expCats = [...new Set(txs.filter(t => t.type === 'expense').map(t => t.category))];
    expCats.forEach(cat => {
      const cur = monthExp(thisM, cat);
      const prev = monthExp(prevM, cat);
      if (prev > 0 && cur > prev * 1.5 && cur > 100) {
        const pct = Math.round(((cur - prev) / prev) * 100);
        result.push({ type: 'warning', title: `${cat} — עלייה של ${pct}%`, detail: `החודש: ${cur.toLocaleString()} לעומת ${prev.toLocaleString()} בחודש שעבר` });
      }
    });

    // 4. Budget overruns
    const monthBudgets = budgets.filter(b => b.month === thisM || b.month === 'monthly');
    monthBudgets.forEach(b => {
      const spent = monthExp(thisM, b.category) // simplified, ignores currency
      if (spent > b.amount) {
        result.push({ type: 'warning', title: `חריגה בתקציב ${b.category}`, detail: `הוצאת ${spent.toLocaleString()} מתוך ${b.amount.toLocaleString()} שתוקצב` });
      } else if (spent > b.amount * 0.85) {
        result.push({ type: 'info', title: `תקציב ${b.category} — כמעט נגמר`, detail: `${Math.round((spent / b.amount) * 100)}% נוצל` });
      }
    });

    // 5. Overdue recurring
    const overdue = recurring.filter(r => daysUntil(r.nextDate) < 0);
    if (overdue.length > 0) {
      result.push({ type: 'warning', title: `${overdue.length} תשלום${overdue.length > 1 ? 'ים' : ''} באיחור`, detail: overdue.map(r => r.name).join(', ') });
    }

    // 6. No income this month
    if (curInc === 0 && now.getDate() > 10) {
      result.push({ type: 'info', title: 'לא נרשמו הכנסות החודש', detail: 'האם שכחת לרשום הכנסה?' });
    }

    // 7. Positive: expenses lower than last month
    if (prevExp > 0 && curExp < prevExp * 0.85) {
      const pct = Math.round(((prevExp - curExp) / prevExp) * 100);
      result.push({ type: 'positive', title: `חסכת ${pct}% על הוצאות לעומת החודש שעבר 💪`, detail: `${prevExp.toLocaleString()} → ${curExp.toLocaleString()}` });
    }

    return result.slice(0, 8);
  }, [txs, budgets, recurring]);

  const colors = { warning: 'border-red-200 bg-red-50', positive: 'border-green-200 bg-green-50', info: 'border-blue-200 bg-blue-50' };
  const icons = { warning: <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />, positive: <Trophy size={14} className="text-green-500 flex-shrink-0" />, info: <Bell size={14} className="text-blue-400 flex-shrink-0" /> };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Activity size={15} className="text-etsy-orange" />
        <h2 className="font-semibold text-sm">תובנות חכמות</h2>
      </div>
      {insights.length === 0 ? (
        <div className="text-center py-10">
          <ShieldCheck size={36} className="mx-auto text-green-400 mb-2" />
          <p className="font-semibold text-green-600 mb-1">הכל נראה מצוין!</p>
          <p className="text-xs text-etsy-gray">לא זוהו דגלים אדומים. הוסף יותר תנועות לניתוח עמוק יותר.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className={`card p-3 border ${colors[ins.type]}`}>
              <div className="flex items-start gap-2">
                {icons[ins.type]}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ins.title}</p>
                  <p className="text-xs text-etsy-gray mt-0.5">{ins.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Statistics ─────────────── */

const MONTH_NAMES = ['ינו','פב','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

function StatisticsPanel({ txs }: { txs: Transaction[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const yearTxs = txs.filter(t => t.type !== 'transfer' && t.date.startsWith(String(year)));

  // Monthly data for bar chart
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const prefix = `${year}-${m}`;
      const mTxs = yearTxs.filter(t => t.date.startsWith(prefix));
      return {
        month: MONTH_NAMES[i],
        הכנסות: Math.round(mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
        הוצאות: Math.round(mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
      };
    });
  }, [yearTxs, year]);

  // Top expense categories
  const topExpCats = useMemo(() => {
    const map: Record<string, number> = {};
    yearTxs.filter(t => t.type === 'expense').forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [yearTxs]);

  // Top income categories
  const topIncCats = useMemo(() => {
    const map: Record<string, number> = {};
    yearTxs.filter(t => t.type === 'income').forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 4)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [yearTxs]);

  const totalIn = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = totalIn - totalOut;
  const savingRate = totalIn > 0 ? Math.round((savings / totalIn) * 100) : 0;

  // Best and worst months
  const withNet = monthlyData.map(m => ({ ...m, net: m['הכנסות'] - m['הוצאות'] }));
  const bestMonth = withNet.reduce((b, m) => m.net > b.net ? m : b, withNet[0]);
  const worstMonth = withNet.reduce((b, m) => m.net < b.net ? m : b, withNet[0]);

  return (
    <div>
      {/* Year picker */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg border border-etsy-border bg-white">
          <ChevronRight size={16} className="text-etsy-gray" />
        </button>
        <div className="flex items-center gap-1.5">
          <Activity size={15} className="text-etsy-orange" />
          <span className="font-bold">{year}</span>
        </div>
        <button onClick={() => setYear(y => y + 1)} disabled={year >= now.getFullYear()}
          className="p-1.5 rounded-lg border border-etsy-border bg-white disabled:opacity-30">
          <ChevronLeft size={16} className="text-etsy-gray" />
        </button>
      </div>

      {yearTxs.length === 0 ? (
        <div className="text-center py-12">
          <BarChartIcon size={40} className="mx-auto text-etsy-border mb-3" />
          <p className="text-etsy-gray text-sm">אין נתונים לשנת {year}</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="card p-3 text-center">
              <p className="text-xs text-etsy-gray mb-1">הכנסות</p>
              <p className="font-bold text-green-600 text-sm">{totalIn.toLocaleString()}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs text-etsy-gray mb-1">הוצאות</p>
              <p className="font-bold text-red-500 text-sm">{totalOut.toLocaleString()}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-xs text-etsy-gray mb-1">חיסכון</p>
              <p className={`font-bold text-sm ${savings >= 0 ? 'text-etsy-orange' : 'text-red-500'}`}>{savings.toLocaleString()}</p>
            </div>
          </div>

          {/* Savings rate */}
          <div className="card p-3 mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-etsy-gray font-medium">שיעור חיסכון שנתי</span>
              <span className={`font-bold ${savingRate >= 20 ? 'text-green-600' : savingRate >= 0 ? 'text-amber-500' : 'text-red-500'}`}>{savingRate}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${savingRate >= 20 ? 'bg-green-500' : savingRate >= 0 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${Math.min(Math.abs(savingRate), 100)}%` }} />
            </div>
            <p className="text-xs text-etsy-gray mt-1">
              {savingRate >= 20 ? '✓ חיסכון מצוין' : savingRate >= 10 ? 'חיסכון סביר' : savingRate >= 0 ? 'חיסכון נמוך' : '⚠ הוצאות עולות על הכנסות'}
            </p>
          </div>

          {/* Monthly bar chart */}
          <div className="card p-3 mb-4">
            <p className="text-xs text-etsy-gray font-medium mb-3">הכנסות מול הוצאות — חודשי</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Bar dataKey="הכנסות" fill="#22c55e" radius={[2,2,0,0]} />
                <Bar dataKey="הוצאות" fill="#ef4444" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Best / worst month */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="card p-3">
              <p className="text-xs text-etsy-gray mb-1 flex items-center gap-1"><Trophy size={11} className="text-yellow-500" /> חודש הכי טוב</p>
              <p className="font-bold text-sm">{bestMonth.month}</p>
              <p className="text-xs text-green-600">+{bestMonth.net.toLocaleString()}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-etsy-gray mb-1 flex items-center gap-1"><AlertTriangle size={11} className="text-red-400" /> חודש הכי חלש</p>
              <p className="font-bold text-sm">{worstMonth.month}</p>
              <p className={`text-xs ${worstMonth.net < 0 ? 'text-red-500' : 'text-etsy-gray'}`}>{worstMonth.net.toLocaleString()}</p>
            </div>
          </div>

          {/* Top expense categories */}
          {topExpCats.length > 0 && (
            <div className="card p-3 mb-4">
              <p className="text-xs text-etsy-gray font-medium mb-3 flex items-center gap-1"><ArrowUpCircle size={12} className="text-red-400" /> הוצאות לפי קטגוריה</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={topExpCats} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={60}>
                    {topExpCats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {topExpCats.map((c, i) => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {c.name}
                    </span>
                    <span className="font-medium">{c.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top income categories */}
          {topIncCats.length > 0 && (
            <div className="card p-3 mb-4">
              <p className="text-xs text-etsy-gray font-medium mb-2 flex items-center gap-1"><ArrowDownCircle size={12} className="text-green-500" /> מקורות הכנסה</p>
              {topIncCats.map((c, i) => {
                const pct = Math.round((c.value / totalIn) * 100);
                return (
                  <div key={c.name} className="mb-2">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {c.name}
                      </span>
                      <span className="font-medium">{c.value.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────── Settings panel ─────────────── */

interface FinanceData {
  accounts: Account[];
  txs: Transaction[];
  budgets: Budget[];
  recurring: Recurring[];
  goals: Goal[];
  version: number;
}

function SettingsPanel({
  data, onImport, onClearAll, onSetPin, onRemovePin, onLock,
}: {
  data: FinanceData;
  onImport: (d: FinanceData) => void;
  onClearAll: () => void;
  onSetPin: () => void;
  onRemovePin: () => void;
  onLock: () => void;
}) {
  const toast = useToast();
  const hasPin = !!localStorage.getItem(PIN_KEY);

  const exportAll = () => {
    const json = JSON.stringify({ ...data, version: 1, exportedAt: new Date().toISOString() }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `finance-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast.success('גיבוי הורד ✓');
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as FinanceData;
        if (!Array.isArray(parsed.accounts)) throw new Error();
        if (!confirm(`לייבא ${parsed.accounts.length} חשבונות ו-${parsed.txs?.length ?? 0} תנועות? הנתונים הקיימים יוחלפו.`)) return;
        onImport(parsed);
        toast.success('הנתונים יובאו בהצלחה ✓');
      } catch {
        toast.error('קובץ לא תקין');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const stats = {
    accounts: data.accounts.length,
    txs: data.txs.length,
    budgets: data.budgets.length,
    recurring: data.recurring.length,
    goals: data.goals.length,
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <FileJson size={15} className="text-etsy-orange" /> סטטוס נתונים
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'חשבונות', val: stats.accounts },
            { label: 'תנועות', val: stats.txs },
            { label: 'יעדים', val: stats.goals },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-2">
              <p className="font-bold text-lg">{s.val}</p>
              <p className="text-xs text-etsy-gray">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Backup / Restore */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Download size={15} className="text-etsy-orange" /> גיבוי ושחזור
        </h3>
        <button onClick={exportAll}
          className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl border border-etsy-border bg-white text-sm font-medium mb-2 active:bg-gray-50">
          <Download size={15} /> ייצוא גיבוי (JSON)
        </button>
        <label className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl border border-etsy-border bg-white text-sm font-medium cursor-pointer active:bg-gray-50">
          <Upload size={15} /> ייבוא גיבוי
          <input type="file" accept=".json" className="hidden" onChange={importFile} />
        </label>
        <p className="text-xs text-etsy-gray mt-2 text-center">הגיבוי כולל חשבונות, תנועות, תקציבים, יעדים ותשלומים קבועים</p>
      </div>

      {/* PIN management */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Lock size={15} className="text-etsy-orange" /> נעילת PIN
        </h3>
        <div className="space-y-2">
          {hasPin ? (
            <>
              <button onClick={onLock}
                className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl bg-etsy-orange text-white text-sm font-medium">
                <Lock size={15} /> נעל עכשיו
              </button>
              <button onClick={onSetPin}
                className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl border border-etsy-border text-sm font-medium">
                <ShieldCheck size={15} /> שנה PIN
              </button>
              <button onClick={onRemovePin}
                className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium">
                <Unlock size={15} /> הסר PIN
              </button>
            </>
          ) : (
            <button onClick={onSetPin}
              className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl bg-etsy-orange text-white text-sm font-medium">
              <Lock size={15} /> הגדר PIN
            </button>
          )}
          <p className="text-xs text-etsy-gray text-center">ה-PIN נשמר רק על המכשיר הזה</p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card p-4 border-red-100">
        <h3 className="font-semibold text-sm mb-3 text-red-500 flex items-center gap-1.5">
          <AlertTriangle size={15} /> אזור מסוכן
        </h3>
        <button onClick={() => {
          if (!confirm('למחוק את כל הנתונים הפיננסיים? פעולה זו אינה הפיכה.')) return;
          onClearAll();
        }}
          className="w-full flex items-center gap-2 justify-center py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium">
          <Trash2 size={15} /> מחק את כל הנתונים
        </button>
      </div>
    </div>
  );
}

/* ─────────────── PIN lock ─────────────── */

const PIN_KEY = 'finance_pin';
const PIN_SESSION = 'finance_unlocked';

function PinScreen({ mode, onSuccess, onCancel }: {
  mode: 'unlock' | 'set' | 'change';
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const doShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setDigits('');
    setError('');
  };

  const press = (d: string) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    setError('');

    if (next.length === 4) {
      setTimeout(() => {
        if (mode === 'unlock') {
          const saved = localStorage.getItem(PIN_KEY);
          if (next === saved) {
            sessionStorage.setItem(PIN_SESSION, '1');
            onSuccess();
          } else {
            setError('קוד שגוי');
            doShake();
          }
        } else if (step === 'enter') {
          setConfirm(next);
          setDigits('');
          setStep('confirm');
        } else {
          if (next === confirm) {
            localStorage.setItem(PIN_KEY, next);
            sessionStorage.setItem(PIN_SESSION, '1');
            onSuccess();
          } else {
            setError('הקודים אינם תואמים');
            setStep('enter');
            setConfirm('');
            doShake();
          }
        }
      }, 120);
    }
  };

  const del = () => setDigits(d => d.slice(0, -1));

  const title = mode === 'unlock' ? 'הזן קוד PIN'
    : step === 'enter' ? (mode === 'change' ? 'קוד PIN חדש' : 'בחר קוד PIN')
    : 'אשר קוד PIN';

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-8">
      <div className="w-12 h-12 rounded-2xl bg-etsy-orange/10 flex items-center justify-center mb-4">
        <Lock size={24} className="text-etsy-orange" />
      </div>
      <h2 className="text-lg font-bold mb-1">{title}</h2>
      <p className="text-sm text-etsy-gray mb-8">ניהול כסף מאובטח</p>

      {/* Dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'animate-pulse' : ''}`}>
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
            digits.length > i ? 'bg-etsy-orange border-etsy-orange' : 'border-gray-300'
          }`} />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          k === '' ? <div key={i} /> :
          k === '⌫' ? (
            <button key={i} onClick={del}
              className="h-14 rounded-2xl flex items-center justify-center text-etsy-gray active:bg-gray-100 transition-colors">
              <Delete size={20} />
            </button>
          ) : (
            <button key={i} onClick={() => press(k)}
              className="h-14 rounded-2xl bg-gray-50 border border-etsy-border text-xl font-semibold active:bg-etsy-orange active:text-white active:border-etsy-orange transition-all">
              {k}
            </button>
          )
        ))}
      </div>

      {onCancel && (
        <button onClick={onCancel} className="mt-6 text-sm text-etsy-gray">
          ביטול
        </button>
      )}
    </div>
  );
}

/* ─────────────── Overview dashboard ─────────────── */

function Overview({
  accounts, txs, recurring, goals, effectiveBalance,
}: {
  accounts: Account[];
  txs: Transaction[];
  recurring: Recurring[];
  goals: Goal[];
  effectiveBalance: (a: Account) => number;
}) {
  const sym = (cur: string) => CURRENCY_SYMBOLS[cur] ?? cur;

  // Net worth per currency
  const netWorth = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + effectiveBalance(a);
    return acc;
  }, {});

  // Last 5 transactions across all accounts
  const recent = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 5);

  // This month income vs expense
  const month = thisMonth();
  const monthTxs = txs.filter(t => t.date.startsWith(month) && t.type !== 'transfer');
  const monthIn = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthOut = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Upcoming recurring (next 7 days)
  const upcoming = recurring.filter(r => daysUntil(r.nextDate) <= 7).sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  // Goals near completion (>= 80%)
  const nearGoals = goals.filter(g => g.saved / g.target >= 0.8 && g.saved < g.target);

  return (
    <div>
      {/* Net worth cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {Object.entries(netWorth).map(([cur, total]) => (
          <div key={cur} className="card p-3 flex-shrink-0 min-w-[130px]">
            <p className="text-xs text-etsy-gray mb-0.5">{cur} — נטו</p>
            <p className={`font-bold text-lg ${total < 0 ? 'text-red-500' : 'text-etsy-dark'}`}>
              {sym(cur)}{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      {/* This month summary */}
      <div className="card p-4 mb-4">
        <p className="text-xs text-etsy-gray font-medium mb-3">החודש — {month.slice(5)}/{month.slice(2,4)}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1 mb-1"><ArrowDownCircle size={13} className="text-green-500" /><span className="text-xs text-etsy-gray">הכנסות</span></div>
            <p className="font-bold text-green-600 text-base">+{monthIn.toLocaleString()}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1"><ArrowUpCircle size={13} className="text-red-400" /><span className="text-xs text-etsy-gray">הוצאות</span></div>
            <p className="font-bold text-red-500 text-base">-{monthOut.toLocaleString()}</p>
          </div>
        </div>
        {monthIn > 0 || monthOut > 0 ? (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-etsy-gray mb-1">
              <span>יחס הוצאות</span>
              <span>{monthIn > 0 ? Math.round((monthOut / monthIn) * 100) : 100}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${monthOut > monthIn ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min((monthOut / Math.max(monthIn, 1)) * 100, 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Upcoming payments */}
      {upcoming.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-xs font-medium text-etsy-gray mb-3 flex items-center gap-1.5">
            <Bell size={13} className="text-amber-500" /> תשלומים קרובים (7 ימים)
          </p>
          {upcoming.map(r => {
            const days = daysUntil(r.nextDate);
            return (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-etsy-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${days <= 1 ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-sm">{r.name}</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-red-500">-{CURRENCY_SYMBOLS[r.currency] ?? r.currency}{r.amount.toLocaleString()}</p>
                  <p className="text-xs text-etsy-gray">{days <= 0 ? 'היום!' : `בעוד ${days}י׳`}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Near-complete goals */}
      {nearGoals.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-xs font-medium text-etsy-gray mb-3 flex items-center gap-1.5">
            <Trophy size={13} className="text-yellow-500" /> כמעט שם!
          </p>
          {nearGoals.map(g => {
            const pct = Math.round((g.saved / g.target) * 100);
            return (
              <div key={g.id} className="flex items-center gap-2 py-1.5 border-b border-etsy-border last:border-0">
                <span className="text-xl">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                    <div className="h-full rounded-full bg-etsy-orange" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-etsy-orange">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent transactions */}
      {recent.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="text-xs font-medium text-etsy-gray mb-3 flex items-center gap-1.5">
            <List size={13} /> תנועות אחרונות
          </p>
          {recent.map(tx => {
            const acc = accounts.find(a => a.id === tx.accountId);
            const s = acc ? (CURRENCY_SYMBOLS[acc.currency] ?? acc.currency) : '';
            return (
              <div key={tx.id} className="flex items-center gap-2 py-1.5 border-b border-etsy-border last:border-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.type === 'income'
                    ? <ArrowDownCircle size={13} className="text-green-600" />
                    : <ArrowUpCircle size={13} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{tx.note || tx.category}</p>
                  <p className="text-xs text-etsy-gray">{acc?.name} · {fmtDate(tx.date)}</p>
                </div>
                <p className={`text-xs font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{s}{tx.amount.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {accounts.length === 0 && (
        <div className="text-center py-12">
          <LayoutDashboard size={40} className="mx-auto text-etsy-border mb-3" />
          <p className="text-etsy-gray text-sm">הוסף חשבונות כדי לראות את הדשבורד</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main page ─────────────── */

type MainTab = 'overview' | 'accounts' | 'budget' | 'recurring' | 'goals' | 'converter' | 'stats' | 'insights' | 'debts' | 'all-txs' | 'settings';

export default function Finance() {
  const toast = useToast();

  // PIN state
  const hasPin = !!localStorage.getItem(PIN_KEY);
  const isUnlocked = !!sessionStorage.getItem(PIN_SESSION);
  const [unlocked, setUnlocked] = useState(!hasPin || isUnlocked);
  const [pinMode, setPinMode] = useState<'unlock' | 'set' | 'change' | null>(hasPin && !isUnlocked ? 'unlock' : null);

  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [txs, setTxs] = useState<Transaction[]>(loadTxs);
  const [budgets, setBudgets] = useState<Budget[]>(loadBudgets);
  const [recurring, setRecurring] = useState<Recurring[]>(loadRecurring);
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [debts, setDebts] = useState<Debt[]>(loadDebts);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [detail, setDetail] = useState<Account | null>(null);
  const [filter, setFilter] = useState<AccountType | 'all'>('all');
  const [showTransfer, setShowTransfer] = useState(false);
  const [tab, setTab] = useState<MainTab>('overview');

  useEffect(() => { localStorage.setItem('finance_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('finance_txs', JSON.stringify(txs)); }, [txs]);
  useEffect(() => { localStorage.setItem('finance_budgets', JSON.stringify(budgets)); }, [budgets]);
  useEffect(() => { localStorage.setItem('finance_recurring', JSON.stringify(recurring)); }, [recurring]);
  useEffect(() => { localStorage.setItem('finance_goals', JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem('finance_debts', JSON.stringify(debts)); }, [debts]);

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

  const editTx = (id: string, data: Omit<Transaction, 'id'>) => {
    setTxs(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    toast.success('תנועה עודכנה ✓');
  };

  const saveBudget = (b: Omit<Budget, 'id'>) => {
    setBudgets(prev => [...prev, { ...b, id: genId() }]);
    toast.success('תקציב נשמר');
  };
  const deleteBudget = (id: string) => setBudgets(prev => prev.filter(b => b.id !== id));

  const saveRecurring = (r: Omit<Recurring, 'id'>) => {
    setRecurring(prev => [...prev, { ...r, id: genId() }]);
    toast.success('תשלום קבוע נוסף');
  };
  const deleteRecurring = (id: string) => setRecurring(prev => prev.filter(r => r.id !== id));

  const payNow = (r: Recurring) => {
    const tx: Omit<Transaction, 'id'> = {
      accountId: r.accountId, type: 'expense', amount: r.amount,
      note: r.name, category: r.category, date: new Date().toISOString().slice(0, 10),
    };
    addTxs([tx]);
    setRecurring(prev => prev.map(x => x.id === r.id
      ? { ...x, nextDate: nextOccurrence(r.nextDate, r.freq) }
      : x
    ));
    toast.success(`${r.name} שולם ✓`);
  };

  const saveGoal = (g: Omit<Goal, 'id'>) => {
    setGoals(prev => [...prev, { ...g, id: genId() }]);
    toast.success('יעד נוסף! 🎯');
  };
  const deleteGoal = (id: string) => setGoals(prev => prev.filter(g => g.id !== id));
  const saveDebt = (d: Omit<Debt, 'id' | 'createdAt' | 'paid' | 'partialPaid'>) => {
    setDebts(prev => [...prev, { ...d, id: genId(), createdAt: new Date().toISOString(), paid: false, partialPaid: 0 }]);
    toast.success('חוב נרשם');
  };
  const deleteDebt = (id: string) => setDebts(prev => prev.filter(d => d.id !== id));
  const markDebtPaid = (id: string) => setDebts(prev => prev.map(d => d.id === id ? { ...d, paid: true, partialPaid: d.amount } : d));
  const partialPayDebt = (id: string, amount: number) => setDebts(prev => prev.map(d => d.id === id ? { ...d, partialPaid: Math.min(d.partialPaid + amount, d.amount) } : d));

  const depositGoal = (id: string, amount: number) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: Math.min(g.saved + amount, g.target) } : g));
    toast.success('חיסכון עודכן ✓');
  };

  const importData = (d: FinanceData) => {
    setAccounts(d.accounts ?? []);
    setTxs(d.txs ?? []);
    setBudgets(d.budgets ?? []);
    setRecurring(d.recurring ?? []);
    setGoals(d.goals ?? []);
  };

  const clearAll = () => {
    setAccounts([]); setTxs([]); setBudgets([]); setRecurring([]); setGoals([]);
    toast.success('כל הנתונים נמחקו');
  };

  const lockApp = () => {
    sessionStorage.removeItem(PIN_SESSION);
    setUnlocked(false);
    setPinMode('unlock');
  };
  const removePin = () => {
    localStorage.removeItem(PIN_KEY);
    sessionStorage.removeItem(PIN_SESSION);
    toast.success('PIN הוסר');
  };

  /* count overdue/urgent recurring */
  const urgentCount = recurring.filter(r => daysUntil(r.nextDate) <= 3).length;

  /* PIN screens */
  if (pinMode === 'unlock') {
    return <PinScreen mode="unlock" onSuccess={() => { setUnlocked(true); setPinMode(null); }} />;
  }
  if (pinMode === 'set' || pinMode === 'change') {
    return <PinScreen mode={pinMode} onSuccess={() => { setPinMode(null); toast.success('PIN נשמר ✓'); }} onCancel={() => setPinMode(null)} />;
  }
  if (!unlocked) {
    return <PinScreen mode="unlock" onSuccess={() => { setUnlocked(true); setPinMode(null); }} />;
  }

  if (detail) {
    const live = { ...detail, balance: effectiveBalance(detail) };
    return (
      <AccountDetail
        account={live}
        allAccounts={accounts.map(a => ({ ...a, balance: effectiveBalance(a) }))}
        txs={txs}
        onAddTx={addTxs}
        onDeleteTx={deleteTx}
        onEditTx={editTx}
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
        <div className="flex gap-2 items-center">
          {tab === 'accounts' && accounts.length >= 2 && !showForm && !editing && (
            <button onClick={() => setShowTransfer(!showTransfer)}
              className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-sm">
              <ArrowRightLeft size={15} /> העבר
            </button>
          )}
          {tab === 'accounts' && !showForm && !editing && (
            <button onClick={() => setShowForm(true)}
              className="btn-primary flex items-center gap-2 py-2 px-3 text-sm">
              <Plus size={16} /> הוסף
            </button>
          )}
          {/* Lock / PIN button */}
          <button
            onClick={() => localStorage.getItem(PIN_KEY) ? lockApp() : setPinMode('set')}
            title={localStorage.getItem(PIN_KEY) ? 'נעל' : 'הגדר PIN'}
            className="p-2 rounded-lg border border-etsy-border bg-white text-etsy-gray">
            {localStorage.getItem(PIN_KEY) ? <Lock size={16} /> : <ShieldCheck size={16} />}
          </button>
        </div>
      </div>

      {/* Tab bar — three rows */}
      <div className="mb-4 space-y-1">
        <div className="flex rounded-xl overflow-hidden border border-etsy-border bg-white">
          {([
            { key: 'overview',  label: 'סקירה',    icon: <LayoutDashboard size={12} /> },
            { key: 'accounts',  label: 'חשבונות',  icon: <Wallet size={12} /> },
            { key: 'budget',    label: 'תקציב',    icon: <Target size={12} /> },
          ] as { key: MainTab; label: string; icon: React.ReactNode }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-[11px] font-medium flex flex-col items-center gap-0.5 relative transition-colors ${tab === t.key ? 'bg-etsy-orange text-white' : 'text-etsy-gray'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl overflow-hidden border border-etsy-border bg-white">
          {([
            { key: 'recurring', label: 'קבועים',   icon: <RefreshCw size={12} />, badge: urgentCount },
            { key: 'goals',     label: 'יעדים',    icon: <PiggyBank size={12} /> },
            { key: 'insights',  label: 'תובנות',   icon: <Activity size={12} /> },
            { key: 'stats',     label: 'סטטיסטיקה', icon: <BarChartIcon size={12} /> },
          ] as { key: MainTab; label: string; icon: React.ReactNode; badge?: number }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-[11px] font-medium flex flex-col items-center gap-0.5 relative transition-colors ${tab === t.key ? 'bg-etsy-orange text-white' : 'text-etsy-gray'}`}>
              {t.icon} {t.label}
              {t.badge ? (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl overflow-hidden border border-etsy-border bg-white">
          {([
            { key: 'debts',     label: 'חובות',   icon: <Users size={12} /> },
            { key: 'all-txs',   label: 'כל תנועות', icon: <Filter size={12} /> },
            { key: 'converter', label: 'ממיר',    icon: <Zap size={12} /> },
            { key: 'settings',  label: 'הגדרות',  icon: <Settings size={12} /> },
          ] as { key: MainTab; label: string; icon: React.ReactNode }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 text-[11px] font-medium flex flex-col items-center gap-0.5 transition-colors ${tab === t.key ? 'bg-etsy-orange text-white' : 'text-etsy-gray'}`}>
              {t.icon} {t.label}
            </button>
          ))}
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

      {/* Overview tab */}
      {tab === 'overview' && (
        <Overview
          accounts={accounts}
          txs={txs}
          recurring={recurring}
          goals={goals}
          effectiveBalance={effectiveBalance}
        />
      )}

      {/* Accounts tab */}
      {tab === 'accounts' && (
        <>
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
        </>
      )}

      {/* Budget tab */}
      {tab === 'budget' && (
        <BudgetPanel
          txs={txs}
          budgets={budgets}
          onSave={saveBudget}
          onDelete={deleteBudget}
        />
      )}

      {/* Recurring tab */}
      {tab === 'recurring' && (
        <RecurringPanel
          recurring={recurring}
          accounts={accounts}
          onSave={saveRecurring}
          onDelete={deleteRecurring}
          onPayNow={payNow}
        />
      )}

      {/* Goals tab */}
      {tab === 'goals' && (
        <GoalsPanel
          goals={goals}
          onSave={saveGoal}
          onDelete={deleteGoal}
          onDeposit={depositGoal}
        />
      )}

      {/* Debts tab */}
      {tab === 'debts' && (
        <DebtsPanel
          debts={debts}
          onSave={saveDebt}
          onDelete={deleteDebt}
          onMarkPaid={markDebtPaid}
          onPartialPay={partialPayDebt}
        />
      )}

      {/* All transactions tab */}
      {tab === 'all-txs' && (
        <AllTransactions txs={txs} accounts={accounts} />
      )}

      {/* Converter tab */}
      {tab === 'converter' && <CurrencyConverter />}

      {/* Insights tab */}
      {tab === 'insights' && (
        <InsightsPanel txs={txs} budgets={budgets} recurring={recurring} />
      )}

      {/* Statistics tab */}
      {tab === 'stats' && <StatisticsPanel txs={txs} />}

      {/* Settings tab */}
      {tab === 'settings' && (
        <SettingsPanel
          data={{ accounts, txs, budgets, recurring, goals, version: 1 }}
          onImport={importData}
          onClearAll={clearAll}
          onSetPin={() => setPinMode(localStorage.getItem(PIN_KEY) ? 'change' : 'set')}
          onRemovePin={removePin}
          onLock={lockApp}
        />
      )}
    </div>
  );
}
