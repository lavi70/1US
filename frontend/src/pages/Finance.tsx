import { useState, useEffect } from 'react';
import {
  Wallet, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  CreditCard, Building2, Globe, DollarSign, Landmark, Eye, EyeOff
} from 'lucide-react';
import { useToast } from '../components/Toast';

type AccountType =
  | 'paypal'
  | 'bank_il'
  | 'bank_us'
  | 'bank_eu'
  | 'crypto'
  | 'other';

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
      {
        key: 'bank_name',
        label: 'שם הבנק',
        placeholder: 'לאומי / הפועלים / דיסקונט...',
      },
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
    label: 'ארנק קריפטו',
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
  ILS: '₪',
  USD: '$',
  EUR: '€',
  GBP: '£',
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '$',
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const meta = ACCOUNT_TYPES.find((t) => t.type === account.type)!;
  const sym = CURRENCY_SYMBOLS[account.currency] ?? account.currency;

  return (
    <div className="card overflow-hidden mb-3">
      <div
        className="h-1.5"
        style={{ background: account.color }}
      />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
            style={{ background: account.color }}
          >
            {meta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{account.name}</p>
            <p className="text-xs text-etsy-gray">{meta.label}</p>
          </div>
          <div className="text-left">
            <p className="font-bold text-base">
              {sym}
              {account.balance.toLocaleString()}
            </p>
            <p className="text-xs text-etsy-gray">{account.currency}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-etsy-gray"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'הסתר' : 'פרטים'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onEdit(account)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-etsy-gray"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-etsy-border space-y-2">
            <div className="flex justify-end">
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="flex items-center gap-1 text-xs text-etsy-gray"
              >
                {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
                {showSecrets ? 'הסתר מידע רגיש' : 'הצג מידע רגיש'}
              </button>
            </div>
            {meta.fields.map((f) => {
              const val = account.details[f.key];
              if (!val) return null;
              const masked = f.secret && !showSecrets ? '••••••••' : val;
              return (
                <div key={f.key} className="flex justify-between text-xs">
                  <span className="text-etsy-gray">{f.label}</span>
                  <span className="font-mono font-medium">{masked}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface FormState {
  type: AccountType;
  name: string;
  balance: string;
  currency: string;
  details: Record<string, string>;
  color: string;
}

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Account;
  onSave: (a: Omit<Account, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}) {
  const defaultType = ACCOUNT_TYPES[0];
  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      return {
        type: initial.type,
        name: initial.name,
        balance: String(initial.balance),
        currency: initial.currency,
        details: { ...initial.details },
        color: initial.color,
      };
    }
    return {
      type: defaultType.type,
      name: '',
      balance: '0',
      currency: defaultType.currency,
      details: {},
      color: defaultType.color,
    };
  });

  const meta = ACCOUNT_TYPES.find((t) => t.type === form.type)!;

  const setType = (type: AccountType) => {
    const m = ACCOUNT_TYPES.find((t) => t.type === type)!;
    setForm((f) => ({
      ...f,
      type,
      currency: m.currency,
      color: m.color,
      details: {},
    }));
  };

  const setDetail = (key: string, val: string) =>
    setForm((f) => ({ ...f, details: { ...f.details, [key]: val } }));

  const submit = () => {
    if (!form.name.trim()) return;
    onSave({
      type: form.type,
      name: form.name.trim(),
      balance: parseFloat(form.balance) || 0,
      currency: form.currency,
      details: form.details,
      color: form.color,
    });
  };

  return (
    <div className="card p-4 mb-4">
      <h2 className="font-semibold mb-4">
        {initial ? 'עריכת חשבון' : 'הוספת חשבון'}
      </h2>

      {/* Type selector */}
      <div className="mb-4">
        <label className="label text-xs">סוג חשבון</label>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => setType(t.type)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                form.type === t.type
                  ? 'border-2 border-etsy-orange bg-orange-50 text-etsy-orange'
                  : 'border-etsy-border bg-white text-etsy-gray'
              }`}
            >
              <span
                style={{ color: form.type === t.type ? '#F1641E' : t.color }}
              >
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="mb-3">
        <label className="label text-xs">שם החשבון</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={`למשל: ${meta.label} ראשי`}
        />
      </div>

      {/* Balance + Currency */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="label text-xs">יתרה</label>
          <input
            className="input"
            type="number"
            value={form.balance}
            onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="w-28">
          <label className="label text-xs">מטבע</label>
          <select
            className="input"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Color */}
      <div className="mb-4">
        <label className="label text-xs">צבע</label>
        <div className="flex gap-2 flex-wrap">
          {['#003087', '#1a56db', '#057a55', '#7e3af2', '#f59e0b', '#ef4444', '#6b7280', '#F1641E'].map((c) => (
            <button
              key={c}
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                form.color === c ? 'border-etsy-dark scale-110' : 'border-transparent'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Dynamic fields */}
      <div className="space-y-3 mb-4">
        {meta.fields.map((f) => (
          <div key={f.key}>
            <label className="label text-xs">{f.label}</label>
            <input
              className="input"
              type={f.secret ? 'text' : 'text'}
              value={form.details[f.key] ?? ''}
              onChange={(e) => setDetail(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={submit} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Check size={16} />
          שמור
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
          <X size={16} />
          ביטול
        </button>
      </div>
    </div>
  );
}

export default function Finance() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('finance_accounts') ?? '[]');
    } catch {
      return [];
    }
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [filter, setFilter] = useState<AccountType | 'all'>('all');

  useEffect(() => {
    localStorage.setItem('finance_accounts', JSON.stringify(accounts));
  }, [accounts]);

  const save = (data: Omit<Account, 'id' | 'createdAt'>) => {
    if (editing) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === editing.id ? { ...a, ...data } : a))
      );
      toast.success('החשבון עודכן');
      setEditing(null);
    } else {
      setAccounts((prev) => [
        ...prev,
        { ...data, id: genId(), createdAt: new Date().toISOString() },
      ]);
      toast.success('חשבון נוסף!');
      setShowForm(false);
    }
  };

  const remove = (id: string) => {
    if (!confirm('למחוק את החשבון?')) return;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success('החשבון נמחק');
  };

  const filtered =
    filter === 'all' ? accounts : accounts.filter((a) => a.type === filter);

  // Totals per currency
  const totals = accounts.reduce<Record<string, number>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? 0) + a.balance;
    return acc;
  }, {});

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="text-xl font-bold">ניהול כסף</h1>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2 py-2 px-3 text-sm"
          >
            <Plus size={16} />
            הוסף חשבון
          </button>
        )}
      </div>

      {/* Summary cards */}
      {Object.keys(totals).length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          {Object.entries(totals).map(([cur, total]) => (
            <div
              key={cur}
              className="card p-3 flex-shrink-0 min-w-[120px] text-center"
            >
              <p className="text-xs text-etsy-gray mb-1">{cur}</p>
              <p className="font-bold text-lg">
                {CURRENCY_SYMBOLS[cur] ?? ''}
                {total.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {(showForm || editing) && (
        <AccountForm
          initial={editing ?? undefined}
          onSave={save}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Filter tabs */}
      {accounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          <button
            onClick={() => setFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === 'all'
                ? 'bg-etsy-orange text-white border-etsy-orange'
                : 'bg-white text-etsy-gray border-etsy-border'
            }`}
          >
            הכל ({accounts.length})
          </button>
          {ACCOUNT_TYPES.filter((t) =>
            accounts.some((a) => a.type === t.type)
          ).map((t) => (
            <button
              key={t.type}
              onClick={() => setFilter(t.type)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === t.type
                  ? 'bg-etsy-orange text-white border-etsy-orange'
                  : 'bg-white text-etsy-gray border-etsy-border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Accounts list */}
      {filtered.length === 0 && !showForm && !editing && (
        <div className="text-center py-16">
          <Wallet size={48} className="mx-auto text-etsy-border mb-4" />
          <p className="font-semibold text-etsy-gray mb-1">אין חשבונות עדיין</p>
          <p className="text-sm text-etsy-gray">לחץ "הוסף חשבון" כדי להתחיל</p>
        </div>
      )}

      {filtered.map((a) =>
        editing?.id === a.id ? null : (
          <AccountCard
            key={a.id}
            account={a}
            onEdit={(acc) => {
              setShowForm(false);
              setEditing(acc);
            }}
            onDelete={remove}
          />
        )
      )}
    </div>
  );
}
