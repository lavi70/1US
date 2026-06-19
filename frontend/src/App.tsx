import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Store, Search, PlusSquare, LayoutDashboard, Package, ShoppingBag } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Shops from './pages/Shops';
import NewListing from './pages/NewListing';
import Listings from './pages/Listings';
import Research from './pages/Research';
import Orders from './pages/Orders';
import SettingsPage from './pages/Settings';

function NavBar() {
  const location = useLocation();
  const navItems = [
    { to: '/',         icon: LayoutDashboard, label: 'ראשי' },
    { to: '/shops',    icon: Store,           label: 'חנויות' },
    { to: '/listings', icon: Package,         label: 'מוצרים' },
    { to: '/research', icon: Search,          label: 'מחקר' },
    { to: '/orders',   icon: ShoppingBag,     label: 'הזמנות' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-etsy-border safe-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} className="flex flex-col items-center gap-0.5 px-3 py-2 touch-manipulation min-w-0">
              <Icon size={22} className={active ? 'text-etsy-orange' : 'text-etsy-gray'} />
              <span className={`text-xs truncate ${active ? 'text-etsy-orange font-medium' : 'text-etsy-gray'}`}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen pb-20 max-w-lg mx-auto">
        <Routes>
          <Route path="/"                  element={<Dashboard />} />
          <Route path="/shops"             element={<Shops />} />
          <Route path="/listings"          element={<Listings />} />
          <Route path="/listing/new"       element={<NewListing />} />
          <Route path="/listing/:id/edit"  element={<NewListing />} />
          <Route path="/research"          element={<Research />} />
          <Route path="/orders"            element={<Orders />} />
          <Route path="/settings"          element={<SettingsPage />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  );
}
