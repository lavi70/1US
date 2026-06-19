import { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface Fees {
  listing: number;
  transaction: number;
  payment: number;
  shipping_transaction: number;
  offsite_ads: number;
  total: number;
}

function calcFees(price: number, shippingCharge: number, cogs: number, offsiteAds: boolean): { fees: Fees; profit: number; margin: number } {
  const listing = 0.20;
  const transaction = (price + shippingCharge) * 0.065;
  const payment = price * 0.03 + 0.25;
  const shipping_transaction = shippingCharge * 0.065;
  const offsite_ads = offsiteAds ? price * 0.12 : 0;

  const fees: Fees = {
    listing,
    transaction,
    payment,
    shipping_transaction,
    offsite_ads,
    total: listing + transaction + payment + offsite_ads,
  };

  const profit = price - fees.total - cogs;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  return { fees, profit, margin };
}

export default function ProfitCalc() {
  const [price, setPrice] = useState('29.99');
  const [shipping, setShipping] = useState('5.00');
  const [cogs, setCogs] = useState('5.00');
  const [offsiteAds, setOffsiteAds] = useState(false);

  const p = parseFloat(price) || 0;
  const s = parseFloat(shipping) || 0;
  const c = parseFloat(cogs) || 0;

  const { fees, profit, margin } = useMemo(() => calcFees(p, s, c, offsiteAds), [p, s, c, offsiteAds]);

  const profitColor = profit > 0 ? 'text-green-600' : 'text-red-500';
  const marginColor = margin >= 30 ? 'text-green-600' : margin >= 10 ? 'text-orange-500' : 'text-red-500';

  const FeeRow = ({ label, value, note }: { label: string; value: number; note?: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm text-etsy-gray">{label}</p>
        {note && <p className="text-xs text-gray-400">{note}</p>}
      </div>
      <span className="text-sm text-red-500">-${value.toFixed(2)}</span>
    </div>
  );

  return (
    <div className="p-4 safe-top">
      <div className="flex items-center gap-2 mb-1 pt-2">
        <DollarSign size={20} className="text-etsy-orange" />
        <h1 className="text-xl font-bold">מחשבון רווח</h1>
      </div>
      <p className="text-xs text-etsy-gray mb-4">חישוב רווח נקי אחרי עמלות Etsy</p>

      {/* Inputs */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">מחיר מוצר ($)</label>
            <input className="input" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">עלות משלוח ($)</label>
            <input className="input" type="number" step="0.01" value={shipping} onChange={e => setShipping(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">עלות ייצור (COGS)</label>
            <input className="input" type="number" step="0.01" value={cogs} onChange={e => setCogs(e.target.value)} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={offsiteAds} onChange={e => setOffsiteAds(e.target.checked)}
                className="w-4 h-4 accent-orange-500" />
              <span className="text-sm">Offsite Ads<br/><span className="text-xs text-etsy-gray">(12%)</span></span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4 text-center">
          <p className="text-xs text-etsy-gray mb-1">רווח נקי</p>
          <p className={`text-2xl font-bold ${profitColor}`}>${profit.toFixed(2)}</p>
          {profit > 0 ? <TrendingUp size={14} className="text-green-500 mx-auto mt-1" /> : <TrendingDown size={14} className="text-red-500 mx-auto mt-1" />}
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-etsy-gray mb-1">מרג'ין</p>
          <p className={`text-2xl font-bold ${marginColor}`}>{margin.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{margin >= 30 ? 'מצוין' : margin >= 10 ? 'סביר' : 'נמוך מדי'}</p>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="card p-4 mb-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-1">
          פירוט עמלות
          <Info size={13} className="text-etsy-gray" />
        </h2>
        <FeeRow label="Listing Fee" value={fees.listing} note="$0.20 לכל פריסום (4 חודשים)" />
        <FeeRow label="Transaction Fee" value={fees.transaction} note={`6.5% מ-$${(p + s).toFixed(2)}`} />
        <FeeRow label="Payment Processing" value={fees.payment} note="3% + $0.25" />
        {s > 0 && <FeeRow label="Shipping Transaction" value={fees.shipping_transaction} note="6.5% מעלות משלוח" />}
        {offsiteAds && <FeeRow label="Offsite Ads" value={fees.offsite_ads} note="12% על מכירות מפרסום" />}
        <FeeRow label="עלות ייצור (COGS)" value={c} />
        <div className="flex justify-between pt-2 mt-1 border-t border-etsy-border">
          <p className="font-semibold text-sm">סה"כ הוצאות</p>
          <span className="font-bold text-red-500">-${(fees.total + c).toFixed(2)}</span>
        </div>
      </div>

      {/* Break-even */}
      <div className="card p-4 bg-blue-50 border-blue-100">
        <p className="text-xs font-semibold text-blue-700 mb-2">💡 מחיר מינימלי לרווחיות</p>
        <div className="space-y-1 text-xs text-blue-600">
          <div className="flex justify-between">
            <span>Break-even (0% רווח):</span>
            <span className="font-semibold">${((c + 0.20 + 0.25) / (1 - 0.065 - 0.03)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>לרווח 20%:</span>
            <span className="font-semibold">${((c + 0.20 + 0.25) / (1 - 0.065 - 0.03 - 0.20)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>לרווח 30%:</span>
            <span className="font-semibold">${((c + 0.20 + 0.25) / (1 - 0.065 - 0.03 - 0.30)).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
