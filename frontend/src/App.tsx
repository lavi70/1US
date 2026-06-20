import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Store, Search, PlusSquare, LayoutDashboard, Package, ShoppingBag, TrendingUp, MoreHorizontal, Sparkles, Zap, DollarSign, ShieldCheck, BarChart2, Wallet } from 'lucide-react';
import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Shops from './pages/Shops';
import NewListing from './pages/NewListing';
import Listings from './pages/Listings';
import Research from './pages/Research';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import BulkUpload from './pages/BulkUpload';
import Templates from './pages/Templates';
import SettingsPage from './pages/Settings';
import AIGenerator from './pages/AIGenerator';
import QuickEdit from './pages/QuickEdit';
import ProfitCalc from './pages/ProfitCalc';
import SEOAudit from './pages/SEOAudit';
import Inventory from './pages/Inventory';
import OAuthCallback from './pages/OAuthCallback';
import Finance from './pages/Finance';

function MoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const items = [
    { to: '/analytics',   icon: TrendingUp,    label: 'אנליטיקס' },
    { to: '/bulk',        icon: PlusSquare,    label: 'העלאה מרובה' },
    { to: '/templates',   icon: Package,       label: 'תבניות' },
    { to: '/ai',          icon: Sparkles,      label: 'AI Generator' },
    { to: '/quick-edit',  icon: Zap,           label: 'עריכה מהירה' },
    { to: '/profit',      icon: DollarSign,    label: 'מחשבון רווח' },
    { to: '/seo-audit',   icon: ShieldCheck,   label: 'SEO Audit' },
    { to: '/inventory',   icon: BarChart2,     label: 'מלאי' },
    { to: '/settings',    icon: Store,         label: 'הגדרות' },
  ];
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed bottom-20 left-4 right-4 bg-white rounded-2xl shadow-xl border border-etsy-border z-50 overflow-hidden">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className="flex items-center gap-3 px-4 py-3.5 border-b border-etsy-border last:border-0 active:bg-gray-50">
            <Icon size={20} className="text-etsy-gray" />
            <span className="font-medium text-sm">{label}</span>
          </NavLink>
        ))}
      </div>
    </>
  );
}

function NavBar() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const navItems = [
    { to: '/',         icon: LayoutDashboard, label: 'ראשי' },
    { to: '/shops',    icon: Store,           label: 'חנויות' },
    { to: '/listings', icon: Package,         label: 'מוצרים' },
    { to: '/orders',   icon: ShoppingBag,     label: 'הזמנות' },
    { to: '/finance',  icon: Wallet,          label: 'כסף' },
  ];

  const moreRoutes = ['/analytics', '/bulk', '/templates', '/settings', '/ai', '/quick-edit', '/profit', '/seo-audit', '/inventory'];
  const moreActive = moreRoutes.some(r => location.pathname.startsWith(r));

  return (
    <>
      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} />
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-etsy-border safe-bottom z-30">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink key={to} to={to} className="flex flex-col items-center gap-0.5 px-2 py-2 touch-manipulation min-w-0 flex-1">
                <Icon size={21} className={active ? 'text-etsy-orange' : 'text-etsy-gray'} />
                <span className={`text-xs truncate ${active ? 'text-etsy-orange font-medium' : 'text-etsy-gray'}`}>{label}</span>
              </NavLink>
            );
          })}
          <button onClick={() => setMoreOpen(!moreOpen)} className="flex flex-col items-center gap-0.5 px-2 py-2 touch-manipulation min-w-0 flex-1">
            <MoreHorizontal size={21} className={moreActive || moreOpen ? 'text-etsy-orange' : 'text-etsy-gray'} />
            <span className={`text-xs ${moreActive || moreOpen ? 'text-etsy-orange font-medium' : 'text-etsy-gray'}`}>עוד</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen pb-20 max-w-lg mx-auto">
        <Routes>
          <Route path="/oauth-callback"     element={<OAuthCallback />} />
          <Route path="/"                  element={<Dashboard />} />
          <Route path="/shops"             element={<Shops />} />
          <Route path="/listings"          element={<Listings />} />
          <Route path="/listing/new"       element={<NewListing />} />
          <Route path="/listing/:id/edit"  element={<NewListing />} />
          <Route path="/research"          element={<Research />} />
          <Route path="/orders"            element={<Orders />} />
          <Route path="/analytics"         element={<Analytics />} />
          <Route path="/bulk"              element={<BulkUpload />} />
          <Route path="/templates"         element={<Templates />} />
          <Route path="/ai"               element={<AIGenerator />} />
          <Route path="/quick-edit"        element={<QuickEdit />} />
          <Route path="/profit"            element={<ProfitCalc />} />
          <Route path="/seo-audit"         element={<SEOAudit />} />
          <Route path="/inventory"         element={<Inventory />} />
          <Route path="/settings"          element={<SettingsPage />} />
          <Route path="/finance"           element={<Finance />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  );
}
