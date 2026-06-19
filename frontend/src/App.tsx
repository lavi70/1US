import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Store, Search, PlusSquare, LayoutDashboard, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Shops from './pages/Shops';
import NewListing from './pages/NewListing';
import Research from './pages/Research';
import SettingsPage from './pages/Settings';

function NavBar() {
  const location = useLocation();
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'ראשי' },
    { to: '/shops', icon: Store, label: 'חנויות' },
    { to: '/listing/new', icon: PlusSquare, label: 'מוצר חדש' },
    { to: '/research', icon: Search, label: 'מחקר' },
    { to: '/settings', icon: Settings, label: 'הגדרות' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-etsy-border safe-bottom z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} className="flex flex-col items-center gap-0.5 px-3 py-2 touch-manipulation">
              <Icon size={22} className={active ? 'text-etsy-orange' : 'text-etsy-gray'} />
              <span className={`text-xs ${active ? 'text-etsy-orange font-medium' : 'text-etsy-gray'}`}>{label}</span>
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
      <div className="min-h-screen pb-20">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/shops" element={<Shops />} />
          <Route path="/listing/new" element={<NewListing />} />
          <Route path="/listing/:id/edit" element={<NewListing />} />
          <Route path="/research" element={<Research />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        <NavBar />
      </div>
    </BrowserRouter>
  );
}
